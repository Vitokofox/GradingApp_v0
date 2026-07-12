import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { getOfflineUser, saveUserOffline } from '../services/db';
import bcrypt from 'bcryptjs';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for existing session
        const storedUser = localStorage.getItem('user_session');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Session parse error", e);
                localStorage.removeItem('user_session');
            }
        }
        setLoading(false);
    }, []);

    const normalizeBaseUrl = (url) => {
        if (!url) return '';
        let formatted = String(url).trim();
        if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
            formatted = `http://${formatted}`;
        }

        try {
            const parsed = new URL(formatted);
            return `${parsed.protocol}//${parsed.host}`;
        } catch (e) {
            return formatted.endsWith('/') ? formatted.slice(0, -1) : formatted;
        }
    };

    const tryOnlineLogin = async (username, password, offlineUser) => {
        const baseUrl = normalizeBaseUrl(localStorage.getItem('server_url'));
        if (!baseUrl) return null;

        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', password);

        let tokenResponse;
        let lastError;
        for (const path of ['/token', '/api/token']) {
            try {
                tokenResponse = await axios.post(`${baseUrl}${path}`, params, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    timeout: 12000,
                });
                break;
            } catch (error) {
                lastError = error;
                if (![404, 405].includes(error?.response?.status)) {
                    break;
                }
            }
        }

        if (!tokenResponse?.data?.access_token) {
            if (lastError?.response?.status === 401) {
                throw new Error('Usuario o contraseña incorrectos.');
            }
            return null;
        }

        const accessToken = tokenResponse.data.access_token;
        const meResponse = await axios.get(`${baseUrl}/users/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 12000,
        });

        const serverUser = meResponse.data || {};
        const cachedUser = {
            ...offlineUser,
            ...serverUser,
            username: serverUser.username || username,
            password,
            isOffline: false,
        };

        await saveUserOffline(cachedUser);
        localStorage.setItem('token', accessToken);
        localStorage.setItem('user_session', JSON.stringify(cachedUser));
        setUser(cachedUser);
        return cachedUser;
    };

    const login = async (username, password) => {
        setLoading(true);
        try {
            // 1. Fetch user from Local DB
            const offlineUser = await getOfflineUser(username);

            // 1a. Prefer online auth when server is available so first login works even if hash format differs.
            const onlineSession = await tryOnlineLogin(username, password, offlineUser);
            if (onlineSession) {
                return onlineSession;
            }

            if (!offlineUser) {
                throw new Error("Usuario no encontrado en la base de datos.");
            }

            // 2. Verify Credential
            const dbPass = offlineUser.password || offlineUser.password_hash;

            // Check if it's a Bcrypt hash (starts with $2)
            let isValid = false;

            if (dbPass && dbPass.startsWith('$2')) {
                // Use bcrypt compare
                isValid = await bcrypt.compare(password, dbPass);
            } else {
                // Fallback to plain text (legacy or non-hashed dev DB)
                isValid = String(dbPass) === String(password);
            }

            if (!isValid) {
                throw new Error("Contraseña incorrecta.");
            }

            // 3. Set Session
            const sessionUser = { ...offlineUser, isOffline: true };
            setUser(sessionUser);
            localStorage.setItem('user_session', JSON.stringify(sessionUser));

            return sessionUser;

        } catch (error) {
            console.error("Login failed", error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('user_session');
        setUser(null);
    };

    // No registration in strict offline mode
    const register = async () => {
        throw new Error("Registro no disponible en modo Offline.");
    };

    // Legacy support (optional, can render nothing or 'local' badge)
    const loginOffline = () => { /* No-op or debug helper */ };

    return (
        <AuthContext.Provider value={{ user, login, logout, register, loginOffline, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
