import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Configure axios base URL
    // In production, we leave baseURL empty so it automatically uses the current host and port smoothly.
    axios.defaults.baseURL = import.meta.env.MODE === 'development' ? 'http://127.0.0.1:8000' : '';

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            fetchUser();
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUser = async () => {
        try {
            const response = await axios.get('/users/me');
            setUser(response.data);
            return response.data;
        } catch (error) {
            console.error("Failed to fetch user", error);
            logout();
            return null;
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        setLoading(true);
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('password', password);

        try {
            const response = await axios.post('/token', params);
            const { access_token } = response.data;

            localStorage.setItem('token', access_token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            const authenticatedUser = await fetchUser();

            if (!authenticatedUser) {
                throw new Error('No se pudo recuperar el usuario autenticado.');
            }
        } catch (error) {
            setLoading(false);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
    };

    const register = async (userData) => {
        await axios.post('/users/', userData);
        // Automatically login after register? Or redirect to login? 
        // Usually redirect to login is safer / explicit.
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, register, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
