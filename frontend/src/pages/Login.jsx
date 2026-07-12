import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, LogIn, ArrowRight } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user && !loading) {
            navigate('/', { replace: true });
        }
    }, [user, loading, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            console.error("Login Error:", err);
            if (err.response) {
                setError(`Error ${err.response.status}: ${err.response.data.detail || 'Error de servidor'}`);
            } else if (err.request) {
                setError('No se pudo conectar con el servidor. Verifica que el backend esté corriendo.');
            } else {
                setError(`Error: ${err.message}`);
            }
        }
    };

    return (
        <div className="ga-app" style={{
            display: 'flex',
            flexDirection: 'row',
            height: '100vh',
            overflow: 'hidden',
            background: 'var(--color-white)'
        }}>
            {/* Left Side - Brand / Image placeholder */}
            <div style={{
                flex: '1.2',
                background: 'var(--color-arauco-gray)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '4rem',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Decorative Elements */}
                <div style={{
                    position: 'absolute',
                    top: '-10%', left: '-10%',
                    width: '60%', height: '60%',
                    background: 'radial-gradient(circle, var(--color-arauco-lime) 0%, transparent 70%)',
                    opacity: 0.1,
                    filter: 'blur(80px)'
                }} />

                <div style={{ position: 'relative', zIndex: 10 }}>
                    <div className="u-mb-4" style={{
                        width: '80px', height: '8px',
                        background: 'var(--color-arauco-lime)',
                        marginBottom: '2rem'
                    }} />
                    <h1 style={{ fontSize: '3.5rem', fontWeight: 'bold', lineHeight: 1.1, marginBottom: '1.5rem', color: 'white' }}>
                        Calidad &<br />Excelencia
                    </h1>
                    <p style={{ fontSize: '1.25rem', opacity: 0.8, maxWidth: '500px', fontWeight: 300 }}>
                        Sistema de Gestión de Clasificación de Madera.
                        Optimización continua y control preciso.
                    </p>
                </div>

                <div style={{ position: 'absolute', bottom: '2rem', left: '4rem', fontSize: '0.875rem', opacity: 0.5 }}>
                    © 2025 Arauco - Mejora Continua
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div style={{
                flex: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--ga-bg)',
                padding: '2rem'
            }}>
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5 }}
                    style={{ width: '100%', maxWidth: '420px' }}
                >
                    <div className="ga-card" style={{ padding: '3rem', borderColor: 'transparent', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }}>
                        <div className="u-mb-4">
                            <h2 style={{ fontSize: '1.75rem', fontWeight: '300', color: 'var(--color-arauco-gray)', marginBottom: '0.5rem' }}>Bienvenido</h2>
                            <p className="u-muted">Ingresa tus credenciales corporativas.</p>
                        </div>

                        {error && (
                            <div className="ga-alert ga-alert--error">
                                <span style={{ fontSize: '0.875rem' }}>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="ga-stack" style={{ marginTop: '2rem' }}>
                            <div>
                                <label className="ga-label">Usuario</label>
                                <div style={{ position: 'relative' }}>
                                    <User style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ga-muted)' }} size={18} />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="ga-control"
                                        style={{ paddingLeft: '2.5rem', height: '48px' }}
                                        placeholder="Nombre.Apellido"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="ga-label">Contraseña</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ga-muted)' }} size={18} />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="ga-control"
                                        style={{ paddingLeft: '2.5rem', height: '48px' }}
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: '1rem' }}>
                                <motion.button
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    type="submit"
                                    className="ga-btn ga-btn--accent"
                                    disabled={loading}
                                    style={{ width: '100%', height: '48px', fontSize: '1rem', display: 'flex', justifyContent: 'space-between', padding: '0 1.5rem' }}
                                >
                                    <span>INICIAR SESIÓN</span>
                                    <ArrowRight size={20} />
                                </motion.button>
                            </div>
                        </form>

                        <div className="u-center u-mt-4" style={{ marginTop: '2rem', borderTop: '1px solid var(--ga-border)', paddingTop: '1.5rem' }}>
                            <p className="u-muted" style={{ fontSize: '0.875rem' }}>
                                ¿Nuevo usuario?{' '}
                                <Link to="/register" style={{ color: 'var(--color-arauco-orange)', fontWeight: 'bold' }}>
                                    Solicitar Acceso
                                </Link>
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Login;
