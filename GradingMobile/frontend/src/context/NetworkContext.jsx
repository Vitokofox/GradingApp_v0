
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Network } from '@capacitor/network';
import { getPendingInspections, deletePendingInspection } from '../services/db';
import api, { createInspection } from '../api';

export const NetworkContext = createContext();

export const NetworkProvider = ({ children }) => {
    const [status, setStatus] = useState({ connected: true, connectionType: 'unknown' });
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const loadStatus = async () => {
            const currentStatus = await Network.getStatus();
            setStatus(currentStatus);
            checkPending();
        };
        loadStatus();

        Network.addListener('networkStatusChange', async (newStatus) => {
            setStatus(newStatus);
            if (newStatus.connected) {
                syncInspections();
            }
        });
    }, []);

    const checkPending = async () => {
        const pending = await getPendingInspections();
        setPendingCount(pending.length);
    };

    const syncInspections = useCallback(async () => {
        if (isSyncing) return;

        const pending = await getPendingInspections();
        if (pending.length === 0) {
            console.log("No pending inspections to sync");
            return;
        }

        setIsSyncing(true);
        console.log('Starting sync of', pending.length, 'items');

        for (const item of pending) {
            try {
                // Separate results from the main payload
                const { id, temp_created_at, isOffline, results, ...payload } = item;

                console.log(`Syncing item ${id}`, payload);

                // 1. Create the Inspection on Server
                // We use api directly to bypass the "offline check" in createInspection wrapper if needed,
                // but since we are in syncInspections we assume we are online. 
                // However, createInspection in api.js checks network status.
                // Let's use api.post directly to be safe and explicit.
                const response = await api.post('/api/inspections', payload);
                const realId = response.data.id;
                console.log(`Created inspection on server. Real ID: ${realId}`);

                // 2. Sync Results if any
                if (results && results.length > 0) {
                    console.log(`Syncing ${results.length} results for inspection ${realId}`);
                    // Transform results if necessary, ensuring proper structure
                    // The results stored locally should match { grade_id, defect_id, pieces_count }
                    await api.post(`/api/inspections/${realId}/sync_results`, results);
                }

                // 3. Delete from Local DB
                await deletePendingInspection(id);
                console.log(`Successfully synced and removed local item ${id}`);

            } catch (e) {
                console.error("Sync failed for item", item, e);
                // Continue to next item even if one fails
            }
        }
        await checkPending();
        setIsSyncing(false);
        // Optional: Notify user of success/failure
    }, [isSyncing]);

    return (
        <NetworkContext.Provider value={{ status, pendingCount, syncInspections, checkPending }}>
            {children}
        </NetworkContext.Provider>
    );
};
