// Se importa específicamente la versión WASM para evitar problemas con Vite/Bundlers
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import { seedMasterData, saveUserOffline, saveHistoricalInspections } from './db';

/**
 * Imports data from a SQLite .db file (grading.db) into the local IndexedDB.
 * @param {File} file - The .db file selected by the user.
 * @returns {Promise<{success: boolean, message: string, counts: object}>}
 */
export async function importDatabaseFile(file) {
    try {
        console.log("Starting DB Import...", file.name);

        // 1. Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // 2. Initialize sql.js
        console.log("Initializing SQL.js...");
        const SQLFunc = initSqlJs.default || initSqlJs;
        const SQL = await SQLFunc({
            locateFile: file => `/assets/${file}`
        });

        // 3. Open Database
        const db = new SQL.Database(new Uint8Array(arrayBuffer));

        // 4. Extract Data & Map Correctly
        const counts = { users: 0, products: 0, grades: 0, defects: 0, catalog: 0, markets: 0, inspections: 0, details: 0 };
        const masterDataPayload = {};

        // Helper to get data from table and map to specific key
        const extractTable = (tableName, targetKey) => {
            try {
                // Try reading specific table
                const res = db.exec(`SELECT * FROM ${tableName}`);
                if (res.length > 0) {
                    const cols = res[0].columns;
                    const items = res[0].values.map(row => {
                        const obj = {};
                        cols.forEach((c, i) => obj[c] = row[i]);
                        return obj;
                    });

                    if (targetKey) {
                        masterDataPayload[targetKey] = items;
                    }
                    return items;
                }
            } catch (e) {
                console.warn(`Table ${tableName} not found or empty.`);
            }
            return [];
        };

        // --- SPECIFIC TABLE MAPPING (Spanish SQL -> English App Keys) ---

        // 1. Users (Special handling for Auth)
        const users = extractTable('users', null);
        for (const u of users) {
            const normalizedUsername = String(
                u.username ?? u.user_name ?? u.user ?? u.login ?? ''
            ).trim();

            if (!normalizedUsername) {
                continue;
            }

            await saveUserOffline({
                username: normalizedUsername,
                password_hash: u.password_hash || u.password || u.passwd, // Support common variants
                level: u.level || u.role || 'user',
                first_name: u.first_name,
                last_name: u.last_name
            });
            counts.users++;
        }

        // 2. Core Entities
        const products = extractTable('products', 'products');
        counts.products = products.length;

        // Defects: Read them all first
        const allDefects = extractTable('defects', 'defects');
        const defectMap = allDefects.reduce((acc, d) => {
            acc[d.id] = d;
            acc[String(d.id)] = d;
            return acc;
        }, {});
        counts.defects = allDefects.length;

        // Markets with logging
        const markets = extractTable('markets', 'markets');
        console.log("DEBUG: All Imported Markets:", markets);
        const marketMap = markets.reduce((acc, m) => {
            acc[m.id] = m;
            acc[String(m.id)] = m;
            return acc;
        }, {});
        counts.markets = markets.length;

        // 3. Grades & Relationships
        const grades = extractTable('grades', null);
        const gradeMapById = {}; // Helper for hydration
        const gradeDefects = extractTable('grade_defects', null); // Read junction table

        const gradeMap = {};

        // Helper to find defects for a grade
        const getDefectsForGrade = (gradeId) => {
            // Find IDs in junction
            const defectIds = gradeDefects
                .filter(gd => String(gd.grade_id) === String(gradeId))
                .map(gd => gd.defect_id);
            // Map to full defect objects
            const defectIdSet = new Set(defectIds.map(id => String(id)));
            return allDefects.filter(d => defectIdSet.has(String(d.id)));
        };

        grades.forEach(g => {
            const key = `grades_${g.product_id}`;
            if (!gradeMap[key]) gradeMap[key] = [];

            // Attach defects to grade object
            const gWithDefects = {
                ...g,
                defects: getDefectsForGrade(g.id)
            };

            gradeMap[key].push(gWithDefects);
            gradeMapById[g.id] = gWithDefects; // Store for lookup
            gradeMapById[String(g.id)] = gWithDefects;
        });
        Object.assign(masterDataPayload, gradeMap);
        // Also store a flat 'grades' list for fallback lookup (needed by API sync path too)
        masterDataPayload['grades'] = grades.map(g => ({ ...g, defects: getDefectsForGrade(g.id) }));
        counts.grades = grades.length;

        // 4. Catalog Items (Polymorphic table)
        try {
            const catRes = db.exec("SELECT * FROM catalog_items");
            if (catRes.length > 0) {
                const cols = catRes[0].columns;
                const items = catRes[0].values.map(row => {
                    const obj = {};
                    cols.forEach((c, i) => obj[c] = row[i]);
                    return obj;
                });

                // STRICT MAPPING DICTIONARY
                const categoryToKey = {
                    'shift': 'shifts',
                    'turno': 'shifts',
                    'turnos': 'shifts',

                    'journey': 'journeys',
                    'jornada': 'journeys',
                    'jornadas': 'journeys',

                    'area': 'areas',
                    'maquina': 'machines',
                    'machine': 'machines',
                    'equipo': 'machines',

                    'origin': 'origins',
                    'origen': 'origins',

                    'state': 'states',
                    'estado': 'states',

                    'termination': 'terminations',
                    'terminacion': 'terminations',

                    'supervisor': 'supervisors'
                };

                items.forEach(item => {
                    const catRaw = (item.category || '').toLowerCase();
                    const targetKey = categoryToKey[catRaw];

                    if (targetKey) {
                        if (!masterDataPayload[targetKey]) masterDataPayload[targetKey] = [];
                        masterDataPayload[targetKey].push(item);
                        counts.catalog++;
                    } else {
                        console.warn(`Unknown catalog category: ${catRaw}`);
                    }
                });
            }
        } catch (e) {
            console.warn("Error reading catalog_items", e);
        }

        // FIX: Historical Inspections & Details
        try {
            // 1. Inspections Header
            const inspections = extractTable('inspections', null);
            console.log(`DEBUG: Extracted ${inspections.length} inspections`);

            // 2. Inspection Results (The details!)
            const results = extractTable('inspection_results', null);

            if (inspections.length > 0) {
                // Attach results to inspections to match app structure
                // AND Hydrate relationships (Market, Grade, Defect)
                const inspectionsWithResults = inspections.map(insp => {

                    // Helper strict parser
                    const mId = insp.market_id;

                    // Hydrate Market - AGGRESSIVE LOGGING FOR FIRST 5 failures
                    let marketObj = null;
                    if (mId !== null && mId !== undefined && marketMap[mId]) {
                        marketObj = marketMap[mId];
                    } else {
                        // Fallback: try finding by name if id matches nothing? No, name isn't on insp.
                        // Try loose type matching
                        if (mId && marketMap[String(mId)]) marketObj = marketMap[String(mId)];
                        if (mId && marketMap[Number(mId)]) marketObj = marketMap[Number(mId)];
                    }

                    if (!marketObj && inspections.indexOf(insp) < 5) {
                        console.warn(`DEBUG: Failed to finding market for inspection ${insp.id}. market_id=${mId} (Type: ${typeof mId}). Keys available:`, Object.keys(marketMap));
                    }

                    // Find results for this inspection
                    const myResults = results
                        .filter(r => String(r.inspection_id) === String(insp.id))
                        .map(r => ({
                            ...r,
                            // Hydrate Grade
                            grade: r.grade_id ? (gradeMapById[r.grade_id] || gradeMapById[String(r.grade_id)] || null) : null,
                            // Hydrate Defect
                            defect: r.defect_id ? (defectMap[r.defect_id] || defectMap[String(r.defect_id)] || null) : null
                        }));

                    return {
                        ...insp,
                        market: marketObj, // Attach nested market
                        results: myResults
                    };
                });

                await saveHistoricalInspections(inspectionsWithResults);
                counts.inspections = inspections.length;
                counts.details = results.length;
            }
        } catch (e) {
            console.warn("Could not import historical inspections", e);
        }

        // 5. Seed to IndexedDB
        console.log("Seeding Master Data Keys:", Object.keys(masterDataPayload));
        await seedMasterData(masterDataPayload, true); // Overwrite = true

        db.close();
        return {
            success: true,
            message: `Importación OK: ${counts.users} Usr, ${counts.markets} Mkts, ${counts.inspections} Insp (${counts.details} det).`,
            counts
        };

    } catch (error) {
        console.error("Fatal error importing DB:", error);
        return { success: false, message: error.message };
    }
}
