import React, { useState } from 'react';
import api from '../api';
import { Download, Upload, FileJson, CheckCircle, AlertCircle, Loader2, Database } from 'lucide-react';

const DataSync = () => {
    const [status, setStatus] = useState('idle'); // idle, processing, success, error
    const [message, setMessage] = useState('');
    const [downloadType, setDownloadType] = useState('master'); // master, inspections

    // --- Master Data Download ---
    const handleDownloadMasterData = async () => {
        setStatus('processing');
        setMessage('Generando archivo Excel...');
        try {
            const response = await api.get('/sync/master-data/excel', {
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `datos_maestros_movil_${new Date().toISOString().slice(0, 10)}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            setStatus('success');
            setMessage('Archivo de Datos Maestros descargado correctamente.');
        } catch (error) {
            console.error("Download failed", error);
            setStatus('error');
            setMessage('Error al descargar Datos Maestros.');
        }
    };

    const handleDownloadMasterJSON = async () => {
        setStatus('processing');
        setMessage('Generando archivo JSON Maestro...');
        try {
            const response = await api.get('/sync/full-dump');
            const dataStr = JSON.stringify(response.data);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `datos_maestros_movil_${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            setStatus('success');
            setMessage('Archivo JSON Maestro descargado correctamente. Súbalo a OneDrive.');
        } catch (error) {
            console.error("Download failed", error);
            setStatus('error');
            setMessage('Error al descargar JSON Maestro.');
        }
    };

    // --- Inspection Export (JSON) ---
    const handleExportInspections = async () => {
        setStatus('processing');
        setMessage('Exportando inspecciones a JSON...');
        try {
            const response = await api.get('/sync/inspections/json', {
                responseType: 'blob', // Important for file download
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `inspecciones_export_${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            setStatus('success');
            setMessage('Inspecciones exportadas correctamente.');
        } catch (error) {
            console.error("Export failed", error);
            setStatus('error');
            setMessage('Error al exportar inspecciones.');
        }
    };

    // --- Inspection Import (JSON) ---
    const handleImportInspections = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setStatus('processing');
        setMessage('Importando inspecciones...');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post('/sync/inspections/import', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const { imported, skipped } = response.data;
            setStatus('success');
            setMessage(`Importación completada: ${imported} nuevas, ${skipped} omitidas (duplicadas).`);
            e.target.value = ''; // Reset input
        } catch (error) {
            console.error("Import failed", error);
            setStatus('error');
            setMessage('Error al importar inspecciones: ' + (error.response?.data?.detail || error.message));
        }
    };

    return (
        <div className="ga-page">
            <div className="ga-container" style={{ maxWidth: '800px' }}>
                <h1 className="text-2xl font-bold mb-6 text-slate-800">Sincronización de Datos (Web ↔ Móvil)</h1>

                <div className="grid grid-cols-1 gap-6">

                    {/* Section 1: Master Data (Web -> Mobile) */}
                    <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                                <Database size={24} />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-slate-800">1. Datos Maestros (Para Móvil)</h2>
                                <p className="text-slate-500 text-sm mb-4">
                                    Descarga un archivo JSON con todos los Productos, Defectos, Usuarios y configuraciones actuales.
                                    Transferir este archivo al dispositivo móvil mediante OneDrive e importarlo en la App.
                                </p>
                                <div className="flex gap-4">
                                    <button
                                        onClick={handleDownloadMasterJSON}
                                        disabled={status === 'processing'}
                                        className="ga-btn ga-btn--primary flex items-center gap-2"
                                    >
                                        {status === 'processing' && downloadType === 'master' ? <Loader2 className="animate-spin" size={18} /> : <FileJson size={18} />}
                                        Descargar JSON Maestro (OneDrive)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Inspections (Mobile -> Web) */}
                    <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                                <FileJson size={24} />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-slate-800">2. Importar Inspecciones (Desde Móvil)</h2>
                                <p className="text-slate-500 text-sm mb-4">
                                    Carga el archivo JSON generado por la App Móvil para sincronizar las inspecciones realizadas offline.
                                </p>
                                <div className="relative inline-block">
                                    <input
                                        type="file"
                                        accept=".json"
                                        onChange={handleImportInspections}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={status === 'processing'}
                                    />
                                    <button className="ga-btn ga-btn--secondary flex items-center gap-2">
                                        {status === 'processing' ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                                        Seleccionar Archivo JSON
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Historical Data (Web -> Mobile) */}
                    <div className="bg-white rounded-xl shadow p-6 border border-slate-200">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                                <FileJson size={24} />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-bold text-slate-800">3. Histórico Inspecciones (Para Móvil)</h2>
                                <p className="text-slate-500 text-sm mb-4">
                                    Exporta el historial de inspecciones de la Web para visualizarlo en el móvil.
                                </p>
                                <button
                                    onClick={handleExportInspections}
                                    disabled={status === 'processing'}
                                    className="ga-btn ga-btn--secondary flex items-center gap-2"
                                >
                                    <Download size={18} />
                                    Exportar JSON Histórico
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Status Message */}
                    {message && (
                        <div className={`p-4 rounded-lg flex items-center gap-3 ${status === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                            status === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                                'bg-slate-50 text-slate-700 border border-slate-200'
                            }`}>
                            {status === 'error' ? <AlertCircle size={20} /> :
                                status === 'success' ? <CheckCircle size={20} /> :
                                    <Loader2 className="animate-spin" size={20} />}
                            <span className="font-medium">{message}</span>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default DataSync;
