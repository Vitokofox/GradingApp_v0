import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, LogIn } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            console.error("Login Error:", err);
            if (err.response) {
                // The server responded with a status code that falls out of the range of 2xx
                setError(`Error ${err.response.status}: ${err.response.data.detail || 'Error de servidor'}`);
            } else if (err.request) {
                // The request was made but no response was received
                setError('No se pudo conectar con el servidor. Verifica que el backend esté corriendo.');
            } else {
                // Something happened in setting up the request that triggered an Error
                setError(`Error: ${err.message}`);
            }
        }
    };

    return (
        <div className="ga-app" style={{ justifyContent: 'center', alignItems: 'center', background: 'var(--ga-primary-dark)' }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="ga-card"
                style={{ width: '100%', maxWidth: '400px' }}
            >
                <div className="ga-card__body ga-stack">
                    <div className="u-center u-mb-4">
                        <img
                            src="../public/logo-arauco-blanco.png"
                            className="u-mb-2"
                            style={{ height: '50px', margin: '0 auto' }}
                            alt="Logo"
                        />
                        <h2 className="ga-card__title">Bienvenido a Grading App</h2>
                        <p className="u-muted">Inicia sesión para acceder</p>
                    </div>

                    {error && (
                        <div className="ga-alert ga-alert--error">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="ga-stack">
                        <div>
                            <label className="ga-label">Usuario</label>
                            <div style={{ position: 'relative' }}>
                                <User style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ga-muted)' }} size={18} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="ga-control"
                                    style={{ paddingLeft: '2.5rem' }}
                                    placeholder="Ingresa tu usuario"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="ga-label">Contraseña</label>
                            <div style={{ position: 'relative' }}>
                                <Lock style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ga-muted)' }} size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="ga-control"
                                    style={{ paddingLeft: '2.5rem' }}
                                    placeholder="Ingresa tu contraseña"
                                    required
                                />
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            className="ga-btn ga-btn--accent"
                            style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
                        >
                            <LogIn size={18} />
                            Iniciar Sesión
                        </motion.button>
                    </form>

                    <div className="u-center u-mt-4">
                        <p className="u-muted" style={{ fontSize: '0.875rem' }}>
                            ¿No tienes cuenta?{' '}
                            <Link to="/register" style={{ color: 'var(--ga-accent)', fontWeight: '600' }}>
                                Regístrate aquí
                            </Link>
                        </p>
                    </div>

                    <p className="u-muted u-center" style={{ fontSize: '0.75rem', marginTop: '1rem' }}>
                        Departamento de Mejora Continua - Arauco
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
