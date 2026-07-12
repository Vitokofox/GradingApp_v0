
import { openDB } from 'idb';

const DB_NAME = 'grading-app-db';
const STORE_INSPECTIONS = 'pending_inspections';
const STORE_INSPECTIONS_HISTORY = 'inspections_history'; // New store for uploaded/historical data
const STORE_MASTER_DATA = 'master_data';
const STORE_USERS = 'users';

export async function initDB() {
    return openDB(DB_NAME, 3, { // Increment version to force upgrade
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_INSPECTIONS)) {
                db.createObjectStore(STORE_INSPECTIONS, { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(STORE_INSPECTIONS_HISTORY)) {
                db.createObjectStore(STORE_INSPECTIONS_HISTORY, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_MASTER_DATA)) {
                db.createObjectStore(STORE_MASTER_DATA);
            }
            if (!db.objectStoreNames.contains(STORE_USERS)) {
                db.createObjectStore(STORE_USERS, { keyPath: 'username' });
            }
        },
    });
}

// --- Pending / Offline Inspections (Created on Device) ---

export async function saveInspectionOffline(data) {
    const db = await initDB();
    const id = await db.add(STORE_INSPECTIONS, { ...data, temp_created_at: new Date().toISOString(), results: [] });
    return { ...data, id: `TEMP_${id}`, isOffline: true };
}

export async function updateOfflineInspection(tempId, data) {
    const db = await initDB();
    const id = parseInt(tempId.split('_')[1]);
    const inspection = await db.get(STORE_INSPECTIONS, id);
    if (!inspection) throw new Error("Inspection not found locally");

    const updated = { ...inspection, ...data };
    await db.put(STORE_INSPECTIONS, updated);
    return updated;
}

export async function getPendingInspections() {
    const db = await initDB();
    return db.getAll(STORE_INSPECTIONS);
}

export async function deletePendingInspection(key) {
    const db = await initDB();
    return db.delete(STORE_INSPECTIONS, key);
}

export async function getPendingInspectionById(tempId) {
    const db = await initDB();
    const id = parseInt(tempId.split('_')[1]);
    return db.get(STORE_INSPECTIONS, id);
}

// --- Historical Inspections (Imported from DB) ---

export const saveHistoricalInspections = async (inspections) => {
    const db = await initDB();
    // Use a transaction for bulk add
    const tx = db.transaction(STORE_INSPECTIONS_HISTORY, 'readwrite');
    // Clear old history if needed? Or append? Assuming append/overwrite by ID.
    // If we want to fully replace history on new import, we should clear.
    // Let's decided to clear because imports are usually "full state".
    await tx.store.clear();

    for (const insp of inspections) {
        await tx.store.put(insp);
    }
    await tx.done;
};

export const getHistoricalInspections = async () => {
    const db = await initDB();
    return db.getAll(STORE_INSPECTIONS_HISTORY);
};

// --- Master Data Cache ---

export async function cacheMasterData(key, data) {
    const db = await initDB();
    return db.put(STORE_MASTER_DATA, data, key);
}

export async function getCachedMasterData(key) {
    const db = await initDB();
    return db.get(STORE_MASTER_DATA, key);
}

export async function saveMasterDataItem(category, item) {
    const db = await initDB();
    const current = await db.get(STORE_MASTER_DATA, category) || [];
    if (!current.find(i => i.id === item.id)) {
        current.push(item);
        await db.put(STORE_MASTER_DATA, current, category);
    }
}

export async function seedMasterData(seedData, overwrite = false) {
    console.log("Seeding local DB...", overwrite ? "(Overwriting)" : "(Safe mode)");
    const db = await initDB();

    for (const [key, items] of Object.entries(seedData)) {
        // Skip keys that are handled separately if passed here by mistake
        if (key === 'inspections') continue;

        if (key === 'users') {
            // Special handling for users to enable offline login
            const tx = db.transaction(STORE_USERS, 'readwrite');
            await tx.store.clear();
            for (const user of items) {
                await tx.store.put(user);
            }
            await tx.done;
            console.log(`Seeded ${items.length} users into STORE_USERS.`);
            continue;
        }

        const existing = await db.get(STORE_MASTER_DATA, key);
        if (overwrite || !existing || existing.length === 0) {
            await db.put(STORE_MASTER_DATA, items, key);
            console.log(`Seeded ${key} with ${items.length} items.`);
        }
    }
}

// --- Users ---

export async function saveUserOffline(user) {
    const db = await initDB();
    return db.put(STORE_USERS, user);
}

export async function getOfflineUser(username) {
    const db = await initDB();
    const normalizedInput = String(username || '').trim();
    if (!normalizedInput) return null;

    // Fast path: exact key lookup.
    const exactMatch = await db.get(STORE_USERS, normalizedInput);
    if (exactMatch) return exactMatch;

    // Fallback: case-insensitive lookup to tolerate username casing differences.
    const users = await db.getAll(STORE_USERS);
    const target = normalizedInput.toLowerCase();
    return users.find((u) => String(u?.username || '').trim().toLowerCase() === target) || null;
}
