import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, Briefcase, Shield, Settings, CheckCircle, ArrowLeft } from 'lucide-react';

const Register = () => {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        position: '',
        level: 'user', // Default
        process_type: 'Verde' // Default
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await register(formData);
            navigate('/login'); // Redirect to login after success
        } catch (err) {
            setError(err.response?.data?.detail || 'Error en el registro');
        }
    };

    return (
        <div className="ga-app" style={{ justifyContent: 'center', alignItems: 'center', background: 'var(--ga-primary-dark)' }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="ga-card"
                style={{ width: '100%', maxWidth: '700px' }}
            >
                <div className="ga-card__body ga-stack">
                    <Link to="/login" style={{ display: 'flex', alignItems: 'center', color: 'var(--ga-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} /> Volver al Login
                    </Link>

                    <div className="u-mb-4">
                        <h2 className="ga-card__title">Crear Cuenta</h2>
                        <p className="u-muted">Únete al Sistema de Inspección y Clasificación</p>
                    </div>

                    {error && (
                        <div className="ga-alert ga-alert--error">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="ga-stack" style={{ gap: '1.5rem' }}>
                        <div className="ga-grid ga-grid--2">
                            {/* Personal Info */}
                            <div className="ga-stack">
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--ga-border)', paddingBottom: '0.5rem' }}>Información Personal</h3>

                                <div>
                                    <label className="ga-label">Nombre</label>
                                    <input
                                        name="first_name"
                                        type="text"
                                        value={formData.first_name}
                                        onChange={handleChange}
                                        className="ga-control"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="ga-label">Apellido</label>
                                    <input
                                        name="last_name"
                                        type="text"
                                        value={formData.last_name}
                                        onChange={handleChange}
                                        className="ga-control"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Account Info */}
                            <div className="ga-stack">
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--ga-border)', paddingBottom: '0.5rem' }}>Detalles Cuenta</h3>

                                <div>
                                    <label className="ga-label">Usuario</label>
                                    <div style={{ position: 'relative' }}>
                                        <User style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ga-muted)' }} size={16} />
                                        <input
                                            name="username"
                                            type="text"
                                            value={formData.username}
                                            onChange={handleChange}
                                            className="ga-control"
                                            style={{ paddingLeft: '2.25rem' }}
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="ga-label">Contraseña</label>
                                    <div style={{ position: 'relative' }}>
                                        <Lock style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ga-muted)' }} size={16} />
                                        <input
                                            name="password"
                                            type="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            className="ga-control"
                                            style={{ paddingLeft: '2.25rem' }}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Role & Permissions */}
                        <div className="ga-stack">
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--ga-border)', paddingBottom: '0.5rem' }}>Rol y Acceso</h3>

                            <div className="ga-grid ga-grid--3">
                                <div>
                                    <label className="ga-label">Cargo</label>
                                    <div style={{ position: 'relative' }}>
                                        <Briefcase style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ga-muted)' }} size={16} />
                                        <input
                                            name="position"
                                            type="text"
                                            value={formData.position}
                                            onChange={handleChange}
                                            className="ga-control"
                                            style={{ paddingLeft: '2.25rem' }}
                                            placeholder="ej. Supervisor"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="ga-label">Nivel Acceso</label>
                                    <div style={{ position: 'relative' }}>
                                        <Shield style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ga-muted)' }} size={16} />
                                        <select
                                            name="level"
                                            value={formData.level}
                                            onChange={handleChange}
                                            className="ga-select"
                                            style={{ paddingLeft: '2.25rem' }}
                                        >
                                            <option value="user">Usuario</option>
                                            <option value="assistant">Asistente</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="ga-label">Proceso</label>
                                    <div style={{ position: 'relative' }}>
                                        <Settings style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ga-muted)' }} size={16} />
                                        <select
                                            name="process_type"
                                            value={formData.process_type}
                                            onChange={handleChange}
                                            className="ga-select"
                                            style={{ paddingLeft: '2.25rem' }}
                                        >
                                            <option value="Verde">Verde</option>
                                            <option value="Seco">Seco</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="u-mt-4">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                className="ga-btn ga-btn--accent"
                                style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', fontSize: '1rem', padding: '0.75rem' }}
                            >
                                <CheckCircle size={20} />
                                Completar Registro
                            </motion.button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

export default Register;
