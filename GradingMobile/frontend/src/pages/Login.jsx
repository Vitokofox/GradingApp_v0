import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, LogIn, WifiOff, Upload } from 'lucide-react';
import DataImportExport from '../components/DataImportExport';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, loginOffline } = useAuth();
    const navigate = useNavigate();
    const [showImport, setShowImport] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            setError('Credenciales inválidas');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black overflow-hidden relative">
            {/* Background blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl relative z-10"
            >
                <div className="text-center mb-8">
                    <img
                        src="../public/logo-arauco-blanco.png"
                        className="w-52 h-auto mx-auto mb-4"
                    />
                    <h2 className="text-3xl font-bold text-white mb-2">Bienvenido a Grading App</h2>
                    <p className="text-slate-400">Inicia sesión para acceder a la App</p>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm"
                    >
                        {error}
                    </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 block">Usuario</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-white placeholder-slate-500 transition-all"
                                placeholder="Ingresa tu usuario"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 block">Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-white placeholder-slate-500 transition-all"
                                placeholder="Ingresa tu contraseña"
                                required
                            />
                        </div>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl shadow-lg hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-2"
                    >
                        <LogIn className="w-5 h-5" />
                        Iniciar Sesión
                    </motion.button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-slate-400 text-sm">
                        ¿No tienes cuenta?{' '}
                        <Link to="/register" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
                            Regístrate aquí
                        </Link>
                    </p>

                    <button
                        onClick={() => loginOffline()}
                        type="button"
                        className="mt-6 text-slate-500 hover:text-white text-sm flex items-center justify-center gap-2 mx-auto transition-colors"
                    >
                        <WifiOff className="w-4 h-4" />
                        Ingresar sin conexión (Modo Offline)
                    </button>

                    <button
                        onClick={() => {
                            localStorage.removeItem('setup_completed');
                            window.location.reload();
                        }}
                        type="button"
                        className="mt-4 text-slate-600 hover:text-slate-400 text-xs underline transition-colors"
                    >
                        Configurar Servidor
                    </button>

                    <button
                        onClick={() => setShowImport(true)}
                        type="button"
                        className="mt-4 flex items-center justify-center gap-2 text-slate-500 hover:text-purple-400 text-xs transition-colors mx-auto"
                    >
                        <Upload className="w-3 h-3" />
                        Importar Datos (Excel)
                    </button>
                </div>

                {showImport && (
                    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Importar Datos Offline</h2>
                            <button
                                onClick={() => setShowImport(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                Cerrar
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <DataImportExport />
                        </div>
                    </div>
                )}

                <p className="text-slate-500 text-xs text-center mt-8">
                    Departamento de Mejora Continua - Arauco
                </p>
            </motion.div>
        </div>
    );
};

export default Login;
