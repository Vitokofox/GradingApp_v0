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
        <div className="min-h-screen flex items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black overflow-y-auto py-10">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-2xl p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl relative z-10 my-auto"
            >
                <Link to="/login" className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Login
                </Link>

                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">Crear Cuenta</h2>
                    <p className="text-slate-400">Únete al Sistema de Inspección y Clasificación</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Personal Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-200 border-b border-white/10 pb-2">Información Personal</h3>

                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Nombre</label>
                            <input
                                name="first_name"
                                type="text"
                                value={formData.first_name}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-white placeholder-slate-600"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Apellido</label>
                            <input
                                name="last_name"
                                type="text"
                                value={formData.last_name}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-white placeholder-slate-600"
                                required
                            />
                        </div>
                    </div>

                    {/* Account Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-200 border-b border-white/10 pb-2">Detalles de la Cuenta</h3>

                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Usuario</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                <input
                                    name="username"
                                    type="text"
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-white placeholder-slate-600"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                <input
                                    name="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-white placeholder-slate-600"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Role & Permissions */}
                    <div className="md:col-span-2 space-y-4">
                        <h3 className="text-lg font-semibold text-slate-200 border-b border-white/10 pb-2">Rol y Acceso</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Cargo</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                    <input
                                        name="position"
                                        type="text"
                                        value={formData.position}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-white placeholder-slate-600"
                                        placeholder="ej. Supervisor"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Nivel de Acceso</label>
                                <div className="relative">
                                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                    <select
                                        name="level"
                                        value={formData.level}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-white appearance-none cursor-pointer"
                                    >
                                        <option value="user">Usuario</option>
                                        <option value="assistant">Asistente</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Process</label>
                                <div className="relative">
                                    <Settings className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                    <select
                                        name="process_type"
                                        value={formData.process_type}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-white appearance-none cursor-pointer"
                                    >
                                        <option value="Verde">Verde</option>
                                        <option value="Seco">Seco</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 mt-4">
                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            type="submit"
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl shadow-lg hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Completar Registro
                        </motion.button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default Register;
