/**
 * Local Data Service (Formerly api.js)
 * 
 * This module replaces the Axios-based API with a direct bridge to IndexedDB.
 * It strictly adheres to the "Pure Offline" architecture.
 */

import {
    getCachedMasterData,
    saveInspectionOffline,
    getPendingInspections,
    getHistoricalInspections, // New Import
    getPendingInspectionById,
    updateOfflineInspection,
    deletePendingInspection,
    getOfflineUser
} from './services/db';

// Helper to simulate "request" delay if needed (optional)
const mockDelay = async (ms = 50) => new Promise(r => setTimeout(r, ms));

// --- CONSTANTS ---
export const isOfflineMode = () => true; // Always true in this architecture
export const setBaseUrl = (url) => { /* No-op */ };

const buildIdMap = (items = []) => {
    const map = {};
    for (const item of Array.isArray(items) ? items : []) {
        if (!item || item.id === undefined || item.id === null) continue;
        const rawId = item.id;
        const strId = String(rawId).trim();
        map[rawId] = item;
        map[strId] = item;

        const numId = Number(strId);
        if (Number.isFinite(numId)) {
            map[numId] = item;
        }
    }
    return map;
};

const resolveProductIdFromInspection = async (inspection) => {
    if (!inspection) return null;

    if (inspection.product_id !== undefined && inspection.product_id !== null && String(inspection.product_id).trim() !== '') {
        return inspection.product_id;
    }

    const rawProductName = inspection.product_name || inspection.product?.name || inspection.product;
    if (!rawProductName) return null;

    const normalizedName = String(rawProductName).trim().toLowerCase();
    if (!normalizedName) return null;

    const products = await getProducts();
    const hit = products.find((p) => String(p?.name || '').trim().toLowerCase() === normalizedName);
    return hit?.id ?? null;
};

const getFromIdMap = (map, rawId) => {
    if (!map || rawId === undefined || rawId === null) return null;

    if (map[rawId]) return map[rawId];

    const strId = String(rawId).trim();
    if (map[strId]) return map[strId];

    const numId = Number(strId);
    if (Number.isFinite(numId) && map[numId]) return map[numId];

    return null;
};

const resolveCatalogName = (directValue, idValue, map) => {
    if (typeof directValue === 'string' && directValue.trim()) return directValue.trim();
    if (directValue && typeof directValue === 'object' && typeof directValue.name === 'string') {
        return directValue.name;
    }
    if (idValue === undefined || idValue === null || !map) return null;
    const hit = map[idValue] || map[String(idValue)];
    return hit?.name || null;
};

const parseFlexibleDate = (value) => {
    if (!value) return 0;
    const raw = String(value).trim();
    if (!raw) return 0;

    const direct = Date.parse(raw);
    if (!Number.isNaN(direct)) return direct;

    const parts = raw.split(/[\/\-]/).map(p => p.trim());
    if (parts.length >= 3) {
        const d = Number(parts[0]);
        const m = Number(parts[1]);
        const y = Number(parts[2]);
        if (Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y)) {
            const alt = Date.parse(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
            if (!Number.isNaN(alt)) return alt;
        }
    }
    return 0;
};

const normalizeInspectionRecord = (inspection, maps = {}) => {
    if (!inspection) return inspection;

    const normalized = { ...inspection };

    const marketObj = (normalized.market && typeof normalized.market === 'object')
        ? normalized.market
        : (maps.markets?.[normalized.market_id] || maps.markets?.[String(normalized.market_id)] || null);

    const totalPieces = Number(
        normalized.pieces_inspected ?? normalized.total_pieces ?? normalized.pieces_count ?? 0
    ) || 0;

    normalized.market = marketObj;
    normalized.type = normalized.type || normalized.inspection_type || 'line_grading';
    normalized.date = normalized.date || normalized.inspection_date || normalized.created_at || normalized.temp_created_at || null;
    normalized.product_name = normalized.product_name || normalized.product?.name || normalized.product || normalized.product_label || 'N/A';
    normalized.lot = normalized.lot || normalized.lot_number || normalized.batch || '-';
    normalized.pieces_inspected = totalPieces;
    normalized.responsible = normalized.responsible || normalized.responsable || normalized.user_name || normalized.username || normalized.created_by || 'N/A';

    normalized.shift = resolveCatalogName(normalized.shift, normalized.shift_id, maps.shifts) || normalized.shift || 'N/A';
    normalized.journey = resolveCatalogName(normalized.journey, normalized.journey_id, maps.journeys) || normalized.journey || 'N/A';
    normalized.origin = resolveCatalogName(normalized.origin, normalized.origin_id, maps.origins) || normalized.origin || 'N/A';
    normalized.supervisor = resolveCatalogName(normalized.supervisor, normalized.supervisor_id, maps.supervisors) || normalized.supervisor || 'N/A';
    normalized.termination = resolveCatalogName(normalized.termination, normalized.termination_id, maps.terminations) || normalized.termination || 'N/A';

    return normalized;
};

// --- CORE MASTER DATA ---

// Helper to resolve singular/plural mismatches for Catalog Items
const KEY_CATALOG_MAPPING = {
    'shift': 'shifts',
    'journey': 'journeys',
    'area': 'areas',
    'machine': 'machines',
    'origin': 'origins',
    'state': 'states',
    'termination': 'terminations',
    'supervisor': 'supervisors',
    // ... add more if needed
};

/**
 * Generic getter for master data from IndexedDB
 */
const getLocalMasterData = async (key) => {
    try {
        const data = await getCachedMasterData(key);
        return Array.isArray(data) ? data : []; // Robust check
    } catch (e) {
        console.error(`Error reading ${key} from DB`, e);
        return [];
    }
};

export const getMarkets = async () => getLocalMasterData('markets');
export const getProducts = async () => getLocalMasterData('products');
export const getDefects = async () => getLocalMasterData('defects');

export const getCatalogItems = async (category) => {
    // Determine the storage key (e.g., 'shift' -> 'shifts')
    const key = KEY_CATALOG_MAPPING[category] || category + 's';
    return getLocalMasterData(key);
};

export const getGradesByProduct = async (productId) => {
    // In sqliteImporter we save grades with key "grades_{id}"
    const key = `grades_${productId}`;
    return getLocalMasterData(key);
};

export const getDefectsByGrade = async (gradeId) => {
    return getLocalMasterData('defects');
};

// --- INSPECTIONS ---

// Helper to hydrate an inspection with master data objects
const hydrateInspection = async (inspection) => {
    if (!inspection) return inspection;

    // Clone to avoid mutation issues
    const hydrated = { ...inspection };

    // Hydrate Market
    if (hydrated.market_id && !hydrated.market) {
        try {
            const markets = await getMarkets();
            const market = markets.find(m => m.id == hydrated.market_id);
            if (market) hydrated.market = market;
        } catch (e) { console.warn("Error hydrating market", e); }
    }

    // Hydrate Product (if needed/missing)
    // Note: Pending inspections save 'product_name' mostly, but if 'product_id' is present:
    /* if (hydrated.product_id && !hydrated.product) {
         // Logic similar to market if needed
    } */

    return hydrated;
};

export const createInspection = async (data) => {
    console.log("Saving inspection locally:", data);
    return await saveInspectionOffline(data);
};

export const getInspectionsList = async () => {
    const [markets, shifts, journeys, origins, supervisors, terminations] = await Promise.all([
        getMarkets(),
        getCatalogItems('shift'),
        getCatalogItems('journey'),
        getCatalogItems('origin'),
        getCatalogItems('supervisor'),
        getCatalogItems('termination'),
    ]);

    const maps = {
        markets: buildIdMap(markets),
        shifts: buildIdMap(shifts),
        journeys: buildIdMap(journeys),
        origins: buildIdMap(origins),
        supervisors: buildIdMap(supervisors),
        terminations: buildIdMap(terminations),
    };

    // 1. Get Pending (Drafts/New) and Hydrate
    const pending = await getPendingInspections();

    const pendingMapped = pending.map(p => {
        const marketObj = p.market_id ? (maps.markets[p.market_id] || maps.markets[String(p.market_id)]) : null;
        return {
            ...normalizeInspectionRecord(p, maps),
            id: String(p.id).startsWith('TEMP_') ? p.id : `TEMP_${p.id}`,
            status: 'pending_sync',
            market: marketObj || p.market // Use found object or keep existing if any
        };
    });

    // 2. Get History (Imported from DB, Read-Only mostly)
    // These are already hydrated by sqliteImporter now
    const history = await getHistoricalInspections();
    const historyMapped = history.map(h => ({
        ...normalizeInspectionRecord(h, maps),
        status: 'synced', // Mark as historical/synced
        isHistory: true
    }));

    // 3. Merge reverse chronological (assuming date field exists)
    return [...pendingMapped, ...historyMapped].sort((a, b) => parseFlexibleDate(b.date) - parseFlexibleDate(a.date));
};

export const getInspection = async (id) => {
    const [markets, shifts, journeys, origins, supervisors, terminations] = await Promise.all([
        getMarkets(),
        getCatalogItems('shift'),
        getCatalogItems('journey'),
        getCatalogItems('origin'),
        getCatalogItems('supervisor'),
        getCatalogItems('termination'),
    ]);

    const maps = {
        markets: buildIdMap(markets),
        shifts: buildIdMap(shifts),
        journeys: buildIdMap(journeys),
        origins: buildIdMap(origins),
        supervisors: buildIdMap(supervisors),
        terminations: buildIdMap(terminations),
    };

    // Check if it's a temp ID
    if (String(id).startsWith('TEMP_')) {
        const local = await getPendingInspectionById(id);
        if (!local) throw new Error("Inspección pendiente no encontrada");
        const hydrated = await hydrateInspection(local);
        return normalizeInspectionRecord(hydrated, maps);
    }

    // Otherwise check history
    const history = await getHistoricalInspections(); // Inefficient for single lookup but correct for offline scope
    const found = history.find(h => String(h.id) === String(id));
    if (found) return normalizeInspectionRecord(found, maps);

    throw new Error("Inspección no encontrada");
};

export const deleteInspection = async (id) => {
    if (String(id).startsWith('TEMP_')) {
        await deletePendingInspection(id);
        return { success: true };
    }
    throw new Error("No se pueden eliminar inspecciones históricas en modo offline.");
};

export const updateInspection = async (id, data) => {
    if (String(id).startsWith('TEMP_')) {
        return await updateOfflineInspection(id, data);
    }
    throw new Error("No se pueden editar inspecciones históricas en modo offline.");
};

export const addInspectionResult = async (inspectionId, gradeId, defectId, count) => {
    if (!String(inspectionId).startsWith('TEMP_')) throw new Error("Solo se pueden modificar inspecciones nuevas.");

    const inspection = await getPendingInspectionById(inspectionId);
    if (!inspection) throw new Error("Inspection not found");

    const newResult = {
        grade_id: gradeId,
        defect_id: defectId,
        pieces_count: count,
        timestamp: new Date().toISOString()
    };

    const updatedResults = [...(inspection.results || []), newResult];
    await updateOfflineInspection(inspectionId, { results: updatedResults });

    return { success: true, results: updatedResults };
};

export const getInspectionResults = async (inspectionId) => {
    // Need to hydrate results too (grades, defects) for pending inspections!
    // Historicals are hydrated in importer.

    if (String(inspectionId).startsWith('TEMP_')) {
        const inspection = await getPendingInspectionById(inspectionId);
        if (!inspection) return [];
        const rawResults = inspection.results || [];

        // Manual hydration for pending
        // We need product ID to know which grade key to look up, or just search all?
        // Actually, we can fetch all defects (easy). Grades are per product.
        // Let's try to do it efficiently.

        try {
            const defects = await getDefects();

            // Grades: We need to know the product to get the grades list efficiently, 
            // OR we iterate the inspection's product_id if available.
            let gradeMap = {};
            const productIdP = await resolveProductIdFromInspection(inspection);
            const gradeSourceP = productIdP
                ? await getGradesByProduct(productIdP)
                : [];
            const gradesForMapP = gradeSourceP.length > 0 ? gradeSourceP : (await getLocalMasterData('grades') || []);
            gradeMap = buildIdMap(gradesForMapP);

            const defectsMap = buildIdMap(defects);

            return rawResults.map(r => ({
                ...r,
                grade: r.grade || getFromIdMap(gradeMap, r.grade_id) || { name: r.grade_name || 'Unknown', id: r.grade_id },
                defect: r.defect_id ? (r.defect || getFromIdMap(defectsMap, r.defect_id) || { name: r.defect_name || 'Unknown Defect', id: r.defect_id }) : null
            }));

        } catch (e) {
            console.warn("Error hydrating pending results", e);
            return rawResults;
        }
    }

    // Historical
    const inspection = await getInspection(inspectionId);
    const historicalResults = Array.isArray(inspection?.results) ? inspection.results : [];

    try {
        const defects = await getDefects();
        const defectsMap = buildIdMap(defects);

        let gradeMap = {};
        const productIdH = await resolveProductIdFromInspection(inspection);
        const gradeSourceH = productIdH
            ? await getGradesByProduct(productIdH)
            : [];
        const gradesForMapH = gradeSourceH.length > 0 ? gradeSourceH : (await getLocalMasterData('grades') || []);
        gradeMap = buildIdMap(gradesForMapH);

        return historicalResults.map(r => ({
            ...r,
            grade: r.grade || getFromIdMap(gradeMap, r.grade_id) || { name: r.grade_name || 'Unknown', id: r.grade_id },
            defect: r.defect_id ? (r.defect || getFromIdMap(defectsMap, r.defect_id) || { name: r.defect_name || 'Unknown Defect', id: r.defect_id }) : null
        }));
    } catch (e) {
        console.warn('Error hydrating historical results', e);
        return historicalResults;
    }
};

export const syncInspectionResults = async (inspectionId, results) => {
    if (String(inspectionId).startsWith('TEMP_')) {
        return await updateOfflineInspection(inspectionId, { results });
    }
    // For history, maybe we just allow viewing? Ignored for now.
    return { success: false };
};

// --- USERS & AUTH ---

export const getUsers = async () => {
    const { initDB } = await import('./services/db');
    const db = await initDB();
    return db.getAll('users');
};

// --- UNSUPPORTED WRITE OPERATIONS ---

const notSupported = async () => { throw new Error("Operación no disponible en Modo Offline"); };

export const createMarket = notSupported;
export const createUser = notSupported;
export const updateUser = notSupported;
export const deleteUser = notSupported;
export const createCatalogItem = notSupported;
export const deleteCatalogItem = notSupported;
export const createDefect = notSupported;
export const deleteDefect = notSupported;
export const uploadMasterData = notSupported;
export const createProduct = notSupported;
export const deleteProduct = notSupported;
export const deleteMarket = notSupported;
export const addDefectToGrade = notSupported;
export const removeDefectFromGrade = notSupported;
export const downloadTemplate = notSupported;
export const downloadMasterDataCsv = notSupported;
export const downloadInspectionDetailsCsv = notSupported;
export const createGrade = notSupported;
export const deleteGrade = notSupported;
export const updateInspectionResult = notSupported;
export const getBrokenPieceStudies = async () => [];
export const getScannerSteps = async () => [];
export const createScannerStep = notSupported;
export const getScannerStep = notSupported;
export const addScannerItem = notSupported;
export const getScannerStats = notSupported;
export const syncDownload = notSupported;

export const getTruckStudies = async () => [];
export const createTruckStudy = notSupported;
export const downloadTruckStudiesCsv = notSupported;
export const deleteTruckStudy = notSupported;
export const getTruckStudyReport = async () => ({ logs: [] });
export const getTruckStudy = async () => null;

export const getSiniestradaStudies = async () => [];
export const createSiniestradaStudy = notSupported;
export const deleteSiniestradaStudy = notSupported;
export const downloadSiniestradaCsv = notSupported;
export const getSiniestradaStudy = async () => null;

// Export default for compatibility
const api = {
    get: async () => { throw new Error("Direct API access removed"); },
    post: async () => { throw new Error("Direct API access removed"); },
    put: async () => { throw new Error("Direct API access removed"); },
    delete: async () => { throw new Error("Direct API access removed"); }
};
export default api;
