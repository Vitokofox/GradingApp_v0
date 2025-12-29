import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Server, Wifi, Download, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import api, { setBaseUrl } from '../api';
import { seedMasterData } from '../services/db';
import seedData from '../seed_data.json';
import { Network } from '@capacitor/network';
import DataImportExport from '../components/DataImportExport';

const Setup = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [serverUrl, setServerUrl] = useState(localStorage.getItem('server_url') || 'http://192.168.1.30:8000');
    const [status, setStatus] = useState('idle'); // inactivo, probando, éxito, error, sincronizando
    const [message, setMessage] = useState('');
    const [showImport, setShowImport] = useState(false);

    const handleTestConnection = async () => {
        setStatus('testing');
        setMessage('Probando conexión...');

        // Establecer temporalmente URL para probar
        setBaseUrl(serverUrl);

        try {
            // Ping simple a salud o raíz
            // Asumiendo que la raíz "/" retorna algo o 404 pero prueba conexión
            await api.get('/', { timeout: 3000 });
            setStatus('success');
            setMessage('¡Conexión exitosa!');
            setTimeout(() => setStep(2), 1000);
        } catch (error) {
            console.error(error);
            setStatus('error');
            setMessage('No se pudo conectar. Verifica la IP y que el servidor esté corriendo.');
        }
    };

    const handleSync = async () => {
        setStatus('syncing');
        setMessage('Sincronizando datos iniciales...');

        try {
            // 1. Guardar URL permanentemente
            localStorage.setItem('server_url', serverUrl);
            setBaseUrl(serverUrl);

            // 2. Realizar semilla/sincronización inicial
            // Podemos intentar obtener del endpoint de semilla del servidor si está disponible, 
            // de lo contrario usar JSON local pero asegurar que la BD esté lista.
            await seedMasterData(seedData);

            // 3. Marcar configuración como hecha
            localStorage.setItem('setup_completed', 'true');

            setStatus('success');
            setMessage('Configuración completada.');

            setTimeout(() => {
                navigate('/login');
            }, 1000);
        } catch (error) {
            console.error(error);
            setStatus('error');
            setMessage('Error al sincronizar datos.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700"
            >
                <div className="mb-8 text-center">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Settings className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold">Configuración Inicial</h1>
                    <p className="text-slate-400 mt-2">Configura la conexión con el servidor</p>
                </div>

                {step === 1 && (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">Dirección del Servidor (API)</label>
                            <div className="relative">
                                <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                                <input
                                    type="text"
                                    value={serverUrl}
                                    onChange={(e) => setServerUrl(e.target.value)}
                                    placeholder="http://192.168.1.XX:8000"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-2">Asegúrate que tu móvil y PC estén en la misma red Wi-Fi.</p>
                        </div>

                        {message && (
                            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${status === 'error' ? 'bg-red-500/20 text-red-200' :
                                status === 'success' ? 'bg-green-500/20 text-green-200' : 'bg-blue-500/20 text-blue-200'
                                }`}>
                                {status === 'error' ? <AlertCircle className="w-4 h-4" /> :
                                    status === 'success' ? <CheckCircle className="w-4 h-4" /> : <Wifi className="w-4 h-4 animate-pulse" />}
                                {message}
                            </div>
                        )}

                        <button
                            onClick={handleTestConnection}
                            disabled={status === 'testing'}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {status === 'testing' ? 'Conectando...' : 'Probar Conexión'}
                        </button>

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-gray-600"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-500 text-xs">O SI NO TIENES CONEXIÓN</span>
                            <div className="flex-grow border-t border-gray-600"></div>
                        </div>

                        <button
                            onClick={async () => {
                                setStatus('syncing');
                                setMessage('Cargando datos predefinidos...');
                                try {
                                    localStorage.setItem('server_url', 'http://offline-mode');
                                    setBaseUrl('http://offline-mode');

                                    await seedMasterData(seedData);
                                    localStorage.setItem('setup_completed', 'true');
                                    setStatus('success');
                                    setTimeout(() => navigate('/login'), 1000);
                                } catch (e) {
                                    console.error(e);
                                    setStatus('error');
                                    setMessage('Error cargando datos offline');
                                }
                            }}
                            className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-all text-sm text-slate-300"
                        >
                            Usar Datos Offline (Demo)
                        </button>

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-gray-600"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-500 text-xs">O CARGAR DESDE EXCEL</span>
                            <div className="flex-grow border-t border-gray-600"></div>
                        </div>

                        <button
                            onClick={() => setShowImport(true)}
                            className="w-full py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-200 rounded-xl font-bold transition-all text-sm"
                        >
                            Cargar Excel (Usuarios/Datos)
                        </button>
                    </div>
                )}

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
                        <div className="mt-6 text-center">
                            <p className="text-sm text-slate-400 mb-4">
                                Una vez cargados los datos, puedes volver y usar "Datos Offline (Demo)" o configurar el servidor.
                            </p>
                            <button
                                onClick={() => {
                                    localStorage.setItem('setup_completed', 'true');
                                    navigate('/login');
                                }}
                                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold"
                            >
                                Finalizar e Ir al Login
                            </button>
                        </div>
                    </div>
                )}


                {step === 2 && (
                    <div className="space-y-6">
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                                Servidor Detectado
                            </h3>
                            <p className="text-sm text-slate-400 break-all">{serverUrl}</p>
                        </div>

                        <div className="space-y-4">
                            <p className="text-slate-300 text-center">
                                Ahora descargaremos la configuración inicial (Usuarios, Defectos, Productos) para uso offline.
                            </p>
                        </div>

                        {message && status !== 'success' && (
                            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${status === 'error' ? 'bg-red-500/20 text-red-200' : 'bg-blue-500/20 text-blue-200'
                                }`}>
                                {status === 'error' ? <AlertCircle className="w-4 h-4" /> : <Download className="w-4 h-4 animate-bounce" />}
                                {message}
                            </div>
                        )}

                        <button
                            onClick={handleSync}
                            disabled={status === 'syncing'}
                            className="w-full py-4 bg-green-600 hover:bg-green-700 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Download className="w-5 h-5" />
                            {status === 'syncing' ? 'Sincronizando...' : 'Descargar e Iniciar'}
                        </button>

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-gray-600"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-500 text-xs">O SI NO TIENES CONEXIÓN</span>
                            <div className="flex-grow border-t border-gray-600"></div>
                        </div>

                        <button
                            onClick={async () => {
                                setStatus('syncing');
                                setMessage('Cargando datos predefinidos...');
                                try {
                                    localStorage.setItem('server_url', 'http://offline-mode');
                                    setBaseUrl('http://offline-mode');

                                    await seedMasterData(seedData);
                                    localStorage.setItem('setup_completed', 'true');
                                    setStatus('success');
                                    setTimeout(() => navigate('/login'), 1000);
                                } catch (e) {
                                    console.error(e);
                                    setStatus('error');
                                    setMessage('Error cargando datos offline');
                                }
                            }}
                            className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-all text-sm text-slate-300"
                        >
                            Usar Datos Offline (Demo)
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default Setup;
