import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

import { seedMasterData, saveUserOffline, getOfflineUser } from '../services/db';
import seedData from '../seed_data.json';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            // api interceptor already handles token from localStorage, 
            // but we might need to fetch user on load.
            fetchUser();
        } else {
            // AUTO-LOGIN BYPASS
            console.log("No token found, auto-logging in as offline user...");
            loginOffline();
            setLoading(false);
        }
    }, []);

    const fetchUser = async () => {
        try {
            const response = await api.get('/users/me');
            setUser(response.data);
        } catch (error) {
            console.error("Failed to fetch user", error);
            logout();
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const response = await api.post('/token', formData);
            const { access_token } = response.data;

            localStorage.setItem('token', access_token);
            // Interceptor in api.js reads 'token' from localStorage automatically.
            await fetchUser();
        } catch (error) {
            console.log("Online login failed, trying offline...", error);
            try {
                const offlineUser = await getOfflineUser(username);
                if (offlineUser && offlineUser.password === password) {
                    setUser({ ...offlineUser, isOffline: true });
                    localStorage.setItem('offline_mode', 'true');
                    return; // Success
                }
            } catch (dbError) {
                console.error("Offline login failed", dbError);
            }
            throw error; // Re-throw original error if offline fails
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    const register = async (userData) => {
        try {
            await api.post('/users/', userData);
        } catch (error) {
            console.log("Online registration failed, saving locally...", error);
            // Save locally if network error or server down
            await saveUserOffline(userData);
            // We treat this as success for the UI
        }
    };

    const loginOffline = () => {
        const offlineUser = {
            id: 'offline-user',
            username: 'offline_user',
            first_name: 'Modo',
            last_name: 'Offline',
            position: 'Operador Local',
            level: 'user',
            process_type: 'offline'
        };
        setUser(offlineUser);
        localStorage.setItem('offline_mode', 'true');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, register, loginOffline, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
