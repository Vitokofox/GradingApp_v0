
import { openDB } from 'idb';

const DB_NAME = 'grading-app-db';
const STORE_INSPECTIONS = 'pending_inspections';
const STORE_MASTER_DATA = 'master_data';
const STORE_USERS = 'users';

export async function initDB() {
    return openDB(DB_NAME, 2, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_INSPECTIONS)) {
                db.createObjectStore(STORE_INSPECTIONS, { keyPath: 'id', autoIncrement: true });
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

    // Update fields (e.g. results)
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

// Caché de Datos Maestros
// Caché de Datos Maestros
export async function cacheMasterData(key, data) {
    const db = await initDB();
    return db.put(STORE_MASTER_DATA, data, key);
}

export async function getCachedMasterData(key) {
    const db = await initDB();
    return db.get(STORE_MASTER_DATA, key);
}

// Nueva función para guardar items individuales (para seeding)
export async function saveMasterDataItem(category, item) {
    const db = await initDB();
    // Guardamos como un array en la key de la categoría
    const current = await db.get(STORE_MASTER_DATA, category) || [];
    if (!current.find(i => i.id === item.id)) {
        current.push(item);
        await db.put(STORE_MASTER_DATA, current, category);
    }
}

export async function seedMasterData(seedData, overwrite = false) {
    console.log("Seeding local DB...", overwrite ? "(Overwriting)" : "(Safe mode)");
    const db = await initDB();

    // Iterar keys del json (turnos, jornadas, etc)
    for (const [key, items] of Object.entries(seedData)) {
        // Verificar si ya existen datos para no sobrescribir si el usuario ya sincronizó algo más nuevo
        // A MENOS QUE overwrite sea verdadero
        const existing = await db.get(STORE_MASTER_DATA, key);

        if (overwrite || !existing || existing.length === 0) {
            await db.put(STORE_MASTER_DATA, items, key);
            console.log(`Seeded ${key} with ${items.length} items.`);
        }
    }
}

export async function saveUserOffline(user) {
    const db = await initDB();
    return db.put(STORE_USERS, user);
}

export async function getOfflineUser(username) {
    const db = await initDB();
    return db.get(STORE_USERS, username);
}
