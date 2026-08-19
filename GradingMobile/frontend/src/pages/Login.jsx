import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, ArrowRight, Settings, Database, FileUp } from 'lucide-react';
import { importDatabaseFile } from '../services/sqliteImporter';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [importMsg, setImportMsg] = useState('');
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
                setError(`Error ${err.response.status}: ${err.response.data.detail || 'Error de servidor'}`);
            } else if (err.request) {
                // Mensaje orientado al modo offline
                setError('No se pudo conectar. Si estás offline, asegúrate de haber importado una Base de Datos Local.');
            } else {
                setError(`Error: ${err.message}`);
            }
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImportMsg("Procesando base de datos...");
        setError('');

        try {
            const result = await importDatabaseFile(file);
            if (result.success) {
                setImportMsg(result.message);
                // Opcional: Podríamos listar usuarios importados si quisiéramos ser amigables
            } else {
                setError("Error importando BD: " + result.message);
                setImportMsg('');
            }
        } catch (e) {
            setError("Excepción al importar: " + e.message);
            setImportMsg('');
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
                        Sistema movil Offline-Ready.
                        Importa tu BD local para comenzar.
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
                            <p className="u-muted">Ingresa con tu usuario (Requiere BD Local).</p>
                        </div>

                        {/* Import Database Section */}
                        <div className="u-mb-4" style={{ padding: '1rem', background: 'var(--ga-surface)', borderRadius: '8px', border: '1px dashed var(--ga-border)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--color-arauco-blue)' }}>
                                <Database size={18} />
                                <span className="u-bold" style={{ fontSize: '0.875rem' }}>Cargar grading.db</span>
                                <input
                                    type="file"
                                    accept=".db,.sqlite,.sqlite3"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </label>
                            {importMsg && <div style={{ color: 'var(--ga-success)', fontSize: '0.75rem', marginTop: '0.5rem' }}>{importMsg}</div>}
                        </div>

                        {error && (
                            <div className="ga-alert ga-alert--error ga-stack">
                                {error}
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
                                    style={{ width: '100%', height: '48px', fontSize: '1rem', display: 'flex', justifyContent: 'space-between', padding: '0 1.5rem' }}
                                >
                                    <span>ENTRAR</span>
                                    <ArrowRight size={20} />
                                </motion.button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Login;
