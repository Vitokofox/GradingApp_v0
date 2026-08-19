
import axios from 'axios';
import {
    seedMasterData,
    getPendingInspections,
    deletePendingInspection,
    saveHistoricalInspections
} from './db';

const normalizeBaseUrl = (url) => {
    if (!url) return '';
    let formatted = String(url).trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
        formatted = `http://${formatted}`;
    }

    try {
        const parsed = new URL(formatted);
        let basePath = (parsed.pathname || '').replace(/\/+$/, '');
        const removableSuffixes = [
            '/api/sync/full-dump',
            '/api/sync/upload',
            '/api/sync/import-inspections',
            '/sync/full-dump',
            '/api/sync',
            '/sync',
            '/token',
            '/api/token',
        ];

        for (const suffix of removableSuffixes) {
            if (basePath.toLowerCase().endsWith(suffix)) {
                basePath = basePath.slice(0, basePath.length - suffix.length);
                break;
            }
        }

        return `${parsed.protocol}//${parsed.host}${basePath}`;
    } catch (e) {
        if (formatted.endsWith('/')) {
            formatted = formatted.slice(0, -1);
        }
        return formatted;
    }
};

const getBaseUrl = () => normalizeBaseUrl(localStorage.getItem('server_url') || '');

const buildBaseUrlCandidates = (baseUrl) => {
    const normalized = normalizeBaseUrl(baseUrl);
    if (!normalized) return [];

    const candidates = [normalized];

    try {
        const parsed = new URL(normalized);
        const host = parsed.hostname;
        const protocol = parsed.protocol || 'http:';
        const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
        const originOnly = `${protocol}//${host}${parsed.port ? `:${parsed.port}` : ''}`;

        const pushIfMissing = (url) => {
            const safe = normalizeBaseUrl(url);
            if (safe && !candidates.includes(safe)) candidates.push(safe);
        };

        // Try both the configured base path and plain origin.
        if (originOnly !== normalized) {
            pushIfMissing(originOnly);
        }

        if (parsed.port === '8080') {
            pushIfMissing(`${protocol}//${host}:8000${path}`);
            pushIfMissing(`${protocol}//${host}:8000`);
        } else if (parsed.port === '8000') {
            pushIfMissing(`${protocol}//${host}:8080${path}`);
            pushIfMissing(`${protocol}//${host}:8080`);
        } else if (!parsed.port) {
            pushIfMissing(`${protocol}//${host}:8080${path}`);
            pushIfMissing(`${protocol}//${host}:8000${path}`);
            pushIfMissing(`${protocol}//${host}:8080`);
            pushIfMissing(`${protocol}//${host}:8000`);
        }
    } catch (e) {
        // If URL parsing fails, keep original only.
    }

    return candidates;
};

const isRetriableHttpStatus = (status) => status === 404 || status === 405 || status === 422;

const normalizeUser = (rawUser) => {
    if (!rawUser || typeof rawUser !== 'object') return null;

    const username = String(
        rawUser.username ?? rawUser.user_name ?? rawUser.user ?? rawUser.login ?? ''
    ).trim();

    if (!username) return null;

    return {
        ...rawUser,
        username,
        password_hash: rawUser.password_hash ?? rawUser.password ?? rawUser.passwd ?? null,
    };
};

export const syncService = {
    /**
     * Downloads full master data + history dump from server
     */
    downloadData: async () => {
        const url = getBaseUrl();
        if (!url) throw new Error("Servidor no configurado");

        const baseCandidates = buildBaseUrlCandidates(url);
        const endpointAttempts = [
            { method: 'get', endpoint: '/api/sync/full-dump' },
            { method: 'get', endpoint: '/api/sync/full-dump/' },
            { method: 'get', endpoint: '/sync/full-dump' },
            { method: 'get', endpoint: '/sync/full-dump/' },
            { method: 'post', endpoint: '/api/sync/full-dump' },
            { method: 'post', endpoint: '/api/sync/full-dump/' },
        ];

        let response;
        let lastError;
        const attemptLog = [];

        for (const base of baseCandidates) {
            for (const attempt of endpointAttempts) {
                try {
                    const fullUrl = `${base}${attempt.endpoint}`;
                    response = attempt.method === 'get'
                        ? await axios.get(fullUrl, { timeout: 10000 })
                        : await axios.post(fullUrl, {}, { timeout: 10000 });

                    if (base !== url) {
                        localStorage.setItem('server_url', base);
                    }
                    break;
                } catch (error) {
                    lastError = error;
                    const status = error?.response?.status;
                    attemptLog.push(`${attempt.method.toUpperCase()} ${base}${attempt.endpoint} -> ${status || 'ERR'}`);

                    if (!isRetriableHttpStatus(status)) {
                        throw error;
                    }
                }
            }
            if (response) break;
        }

        if (!response) {
            throw new Error(`No se pudo descargar datos del servidor. Intentos: ${attemptLog.join(' | ')}`);
        }

        const data = response.data;

        // Ensure users are normalized before seeding so offline login has stable keys.
        const rawUsers = Array.isArray(data?.users) ? data.users : [];
        const normalizedUsers = rawUsers.map(normalizeUser).filter(Boolean);

        if (normalizedUsers.length === 0) {
            throw new Error("La sincronizacion no trajo usuarios. Verifique servidor/red o cargue grading.db manualmente.");
        }

        const normalizedData = {
            ...data,
            users: normalizedUsers,
        };

        // 1. Seed Master Data (Products, Grades, Defects, Catalogs, Users)
        await seedMasterData(normalizedData, true); // Overwrite = true

        // 2. Clear and Save History
        if (normalizedData.inspections) {
            await saveHistoricalInspections(normalizedData.inspections);
        }

        return {
            success: true,
            message: "Datos sincronizados correctamente",
            counts: {
                users: normalizedData.users?.length || 0,
                products: normalizedData.products?.length || 0,
                inspections: normalizedData.inspections?.length || 0
            }
        };
    },

    /**
     * Uploads pending inspections from local IndexedDB to server
     */
    uploadPending: async () => {
        const url = getBaseUrl();
        if (!url) throw new Error("Servidor no configurado");

        const pending = await getPendingInspections();
        if (pending.length === 0) return { success: true, message: "No hay inspecciones pendientes", uploaded: 0 };

        // Only upload inspections that actually contain captured detail rows.
        const readyToUpload = pending.filter((insp) => {
            const rows = Array.isArray(insp?.results) ? insp.results : [];
            return rows.some((r) => Number(r?.pieces_count || 0) > 0);
        });

        // Force creation on web backend to avoid server-side dedupe skipping valid new records.
        const readyToUploadForced = readyToUpload.map((insp) => ({
            ...insp,
            force_new: true,
        }));

        if (readyToUpload.length === 0) {
            return {
                success: true,
                message: `Hay ${pending.length} inspecciones pendientes sin detalle; no se enviaron.`,
                uploaded: 0,
                skippedIncomplete: pending.length,
            };
        }

        let response;
        let lastError;
        const attemptLog = [];
        const baseCandidates = buildBaseUrlCandidates(url);

        // Try both known backends and both payload shapes to avoid 404/405 mismatches.
        const attempts = [
            { endpoint: '/api/sync/import-inspections', body: { inspections: readyToUploadForced } },
            { endpoint: '/api/sync/import-inspections/', body: { inspections: readyToUploadForced } },
            { endpoint: '/api/sync/upload', body: readyToUploadForced },
            { endpoint: '/api/sync/upload', body: { inspections: readyToUploadForced } },
            { endpoint: '/api/sync/upload/', body: readyToUploadForced },
            { endpoint: '/api/sync/upload/', body: { inspections: readyToUploadForced } },
            // Compatibility for deployments where API is exposed without /api prefix.
            { endpoint: '/sync/import-inspections', body: { inspections: readyToUploadForced } },
            { endpoint: '/sync/upload', body: readyToUploadForced },
        ];

        for (const base of baseCandidates) {
            for (const attempt of attempts) {
                try {
                    response = await axios.post(
                        `${base}${attempt.endpoint}`,
                        attempt.body,
                        { timeout: 15000 }
                    );

                    if (base !== url) {
                        localStorage.setItem('server_url', base);
                    }
                    break;
                } catch (error) {
                    lastError = error;
                    const status = error?.response?.status;
                    attemptLog.push(`POST ${base}${attempt.endpoint} -> ${status || 'ERR'}`);
                    if (!isRetriableHttpStatus(status)) {
                        throw error;
                    }
                }
            }
            if (response) break;
        }

        if (!response) {
            throw new Error(`No se pudo subir inspecciones al servidor. Intentos: ${attemptLog.join(' | ')}`);
        }

        if (response.data.status === 'success') {
            // Delete uploaded items from local DB
            for (const item of readyToUpload) {
                await deletePendingInspection(item.id);
            }

            const skippedIncomplete = pending.length - readyToUpload.length;
            const skippedServer = Number(response?.data?.skipped || 0);
            const notes = [];
            if (skippedIncomplete > 0) notes.push(`${skippedIncomplete} sin detalle quedaron pendientes`);
            if (skippedServer > 0) notes.push(`${skippedServer} omitidos por duplicado en servidor`);
            const suffix = notes.length > 0 ? ` (${notes.join(' | ')})` : '';
            return {
                success: true,
                message: `Subida exitosa: ${response.data.imported} registros${suffix}`,
                uploaded: response.data.imported,
                skippedIncomplete,
                skippedServer,
            };
        }

        throw new Error(response?.data?.detail || lastError?.message || "Respuesta inesperada del servidor");
    }
};
