// ─── Configuración desde .env ───────────────────────────────────────────────
const API_URL = (import.meta.env.VITE_API_IA_DOCUMENTAL_URL || '').trim();
const TIMEOUT_MS = Number(import.meta.env.VITE_API_IA_DOCUMENTAL_TIMEOUT_MS) || 15000;

// En producción (build) se usa la URL absoluta configurada en .env.
// En desarrollo (npm run dev) Vite proxy reenvía /consultar al servidor FastAPI,
// por lo que se puede usar una ruta relativa para evitar CORS.
const IS_DEV = import.meta.env.DEV;
const ENDPOINT_BASE = IS_DEV ? '' : API_URL;

// ─── Utilidades internas ─────────────────────────────────────────────────────
const sanitize = (value) => (typeof value === 'string' ? value.trim() : '');

const parseTopK = (topK) => {
    const n = Number.parseInt(topK, 10);
    return Number.isInteger(n) && n > 0 ? n : 5;
};

/**
 * Convierte el error capturado en un mensaje amigable para el usuario.
 * Cubre: timeout (AbortController), CORS (TypeError sin status),
 * errores HTTP y API caída.
 */
const toUserMessage = (error, status, detail = '') => {
    const detailText = sanitize(detail).toLowerCase();

    if (detailText.includes('indice') || detailText.includes('índice') || detailText.includes('reconstruir')) {
        return 'Debe reconstruir el índice documental.';
    }

    if (detailText.includes('documentos') && (detailText.includes('no hay') || detailText.includes('no se encontraron'))) {
        return 'No hay documentos cargados.';
    }

    if (error.name === 'AbortError') {
        return 'La API local de normas tardó demasiado en responder.';
    }

    // TypeError sin status = fallo de red / CORS / API caída
    if (error instanceof TypeError) {
        return 'No se pudo conectar con la API local de normas.';
    }

    if (status === 404) {
        return 'No se pudo conectar con la API local de normas.';
    }

    if (status >= 500) {
        return detail || 'La API local de normas presentó un error interno.';
    }

    if (status) {
        return `Error API: ${status}`;
    }

    return error.message || 'No fue posible completar la consulta documental.';
};

// ─── Servicio público ─────────────────────────────────────────────────────────

/**
 * Consulta la API documental IA enviando una pregunta en lenguaje natural.
 *
 * @param {string} pregunta  Pregunta sobre normas o criterios de calidad de madera.
 * @param {number} topK      Cantidad de fragmentos documentales a recuperar (default 5).
 * @returns {{ pregunta: string, respuesta: string, evidencias: Array }}
 */
export async function consultarNormasIA(pregunta, topK = 5) {
    if (!pregunta?.trim()) {
        throw new Error('La pregunta está vacía.');
    }

    if (!API_URL) {
        throw new Error('Falta configurar VITE_API_IA_DOCUMENTAL_URL en el archivo .env.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let status;
    let errorDetail = '';

    try {
        // Preparado para autenticación futura: agregar Authorization header si existe token.
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${ENDPOINT_BASE}/consultar`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ pregunta: sanitize(pregunta), top_k: parseTopK(topK) }),
            signal: controller.signal,
        });

        status = response.status;

        if (!response.ok) {
            try {
                const errorPayload = await response.json();
                errorDetail = sanitize(errorPayload?.detail || errorPayload?.message || errorPayload?.respuesta);
            } catch {
                errorDetail = sanitize(await response.text());
            }
            throw new Error(errorDetail || `Error API: ${status}`);
        }

        const data = await response.json();

        const evidencias = Array.isArray(data?.evidencias)
            ? data.evidencias
                .filter((ev) => ev && (ev.documento || ev.fragmento))
                .map((ev) => ({
                    documento: sanitize(ev.documento) || 'Documento sin nombre',
                    fragmento: sanitize(ev.fragmento),
                    score: typeof ev.score === 'number' ? ev.score : null,
                }))
            : [];

        return {
            pregunta: sanitize(data?.pregunta) || sanitize(pregunta),
            respuesta: sanitize(data?.respuesta),
            fuentePrincipal: sanitize(data?.fuente_principal),
            versionUtilizada: sanitize(data?.version_utilizada),
            normaVigente: Boolean(data?.norma_vigente),
            evidencias,
        };
    } catch (error) {
        throw new Error(toUserMessage(error, status, errorDetail || error?.message));
    } finally {
        clearTimeout(timeoutId);
    }
}
