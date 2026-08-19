import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Wifi, ChevronDown, ChevronUp } from 'lucide-react';
import { seedMasterData, saveUserOffline, getPendingInspections, cacheMasterData, deletePendingInspection } from '../services/db';
import { syncUpload, syncDownload } from '../api';
import seedDataTemplate from '../seed_data.json';

const DataImportExport = () => {
    const [importStatus, setImportStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const [showFileOptions, setShowFileOptions] = useState(false);

    // --- DIRECT SYNC (WI-FI) ---
    const handleDirectSync = async () => {
        setImportStatus('processing');
        setMessage('Iniciando sincronización...');

        try {
            // 1. Upload Pending Inspections
            const pending = await getPendingInspections();
            if (pending.length > 0) {
                setMessage(`Subiendo ${pending.length} inspecciones...`);
                await syncUpload(pending);

                // Clear pending if successful? Or mark as synced? 
                // For now, let's clear them to avoid double sync. 
                // In a robust app we'd mark them 'synced' but deleting is safer to avoid duplicates if ID check fails.
                for (const p of pending) {
                    await deletePendingInspection(p.id);
                }
            } else {
                setMessage('No hay inspecciones pendientes para subir.');
            }

            // 2. Download Master Data & History
            setMessage('Descargando datos actualizados...');
            const masterData = await syncDownload();

            // 3. Update Local DB
            setMessage('Actualizando base de datos local...');
            await seedMasterData(masterData, true); // Overwrite

            setImportStatus('success');
            setMessage(`¡Sincronización Completada! (Subidas: ${pending.length})`);

        } catch (error) {
            console.error("Sync failed", error);
            setImportStatus('error');
            setMessage('Error de Sincronización: ' + (error.response?.data?.detail || error.message));
        }
    };

    // --- TEMPLATE DOWNLOAD ---
    const handleDownloadTemplate = () => {
        try {
            const wb = XLSX.utils.book_new();
            const categories = [
                'shifts', 'journeys', 'areas', 'machines',
                'origins', 'states', 'terminations', 'supervisors',
                'markets', 'products', 'defects', 'grades', 'users'
            ];
            categories.forEach(category => {
                let sampleData = [];
                if (seedDataTemplate[category] && seedDataTemplate[category].length > 0) {
                    sampleData = seedDataTemplate[category];
                } else {
                    sampleData = [{ id: 'ejemplo_1', name: 'Nombre Ejemplo' }];
                }
                const ws = XLSX.utils.json_to_sheet(sampleData);
                XLSX.utils.book_append_sheet(wb, ws, category);
            });
            XLSX.writeFile(wb, "Plantilla_Datos_Maestros.xlsx");
            setMessage('Plantilla descargada correctamente.');
            setImportStatus('success');
            setTimeout(() => setImportStatus('idle'), 3000);
        } catch (error) {
            console.error(error);
            setMessage('Error al generar plantilla.');
        }
    };

    // --- MASTER DATA UPLOAD (Excel) ---
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImportStatus('processing');
        setMessage('Procesando Master Data...');
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const newMasterData = {};
            let totalItems = 0;
            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                if (jsonData.length > 0) {
                    const processedData = jsonData.map(item => ({
                        ...item,
                        id: item.id ? String(item.id) : undefined,
                        category: item.category || sheetName
                    }));
                    if (sheetName === 'grades') {
                        const gradesByProduct = processedData.reduce((acc, grade) => {
                            const pid = grade.product_id;
                            if (pid) {
                                if (!acc[pid]) acc[pid] = [];
                                acc[pid].push(grade);
                            }
                            return acc;
                        }, {});
                        Object.keys(gradesByProduct).forEach(pid => {
                            newMasterData[`grades_${pid}`] = gradesByProduct[pid];
                        });
                        totalItems += processedData.length;
                    } else if (sheetName === 'users') {
                        for (const user of processedData) await saveUserOffline(user);
                        totalItems += processedData.length;
                    } else {
                        newMasterData[sheetName] = processedData;
                        totalItems += processedData.length;
                    }
                }
            }
            if (totalItems === 0) throw new Error("Archivo vacío.");
            await seedMasterData(newMasterData, true);
            setImportStatus('success');
            setMessage(`¡Éxito! Master Data actualizado: ${totalItems} items.`);
            e.target.value = '';
        } catch (error) {
            console.error(error);
            setImportStatus('error');
            setMessage('Error: ' + error.message);
        }
    };

    // --- INSPECTIONS EXPORT (JSON) ---
    const handleExportInspections = async () => {
        setImportStatus('processing');
        setMessage('Exportando inspecciones pendientes...');
        try {
            const pending = await getPendingInspections();
            if (!pending || pending.length === 0) {
                throw new Error("No hay inspecciones pendientes para exportar.");
            }

            const jsonStr = JSON.stringify(pending, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `inspecciones_movil_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();

            setImportStatus('success');
            setMessage(`Exportadas ${pending.length} inspecciones.`);
        } catch (error) {
            setImportStatus('error');
            setMessage(error.message);
        }
    };

    // --- INSPECTIONS HISTORY IMPORT (JSON) ---
    const handleImportHistory = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImportStatus('processing');
        setMessage('Importando historial...');
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!Array.isArray(data)) throw new Error("El archivo no es una lista válida.");

            await cacheMasterData('inspections_history', data);

            setImportStatus('success');
            setMessage(`Historial actualizado: ${data.length} inspecciones.`);
            e.target.value = '';
        } catch (error) {
            setImportStatus('error');
            setMessage('Error importar historial: ' + error.message);
        }
    };

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Wifi className="w-5 h-5 text-blue-400" />
                    Sincronización de Datos
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                    Conéctate al servidor para enviar datos y recibir actualizaciones.
                </p>
            </div>

            {/* MAIN ACTION: DIRECT SYNC */}
            <button
                onClick={handleDirectSync}
                disabled={importStatus === 'processing'}
                className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 transform transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2"
            >
                {importStatus === 'processing' ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                    <Wifi className="w-8 h-8" />
                )}
                <span className="text-lg">
                    {importStatus === 'processing' ? 'Sincronizando...' : 'SINCRONIZAR AHORA'}
                </span>
                <span className="text-xs font-normal opacity-80">Enviar Pendientes + Descargar Actualizaciones</span>
            </button>

            {/* Status Message */}
            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${importStatus === 'error' ? 'bg-red-500/20 text-red-200' : importStatus === 'success' ? 'bg-green-500/20 text-green-200' : 'bg-slate-700 text-slate-300'}`}>
                    {importStatus === 'error' ? <AlertCircle className="w-5 h-5" /> : importStatus === 'success' ? <CheckCircle className="w-5 h-5" /> : <Loader2 className="animate-spin w-5 h-5" />}
                    <span className="text-sm font-medium">{message}</span>
                </div>
            )}

            <div className="border-t border-slate-700 pt-4">
                <button
                    onClick={() => setShowFileOptions(!showFileOptions)}
                    className="flex items-center justify-between w-full text-left text-slate-400 hover:text-white transition-colors p-2"
                >
                    <span className="text-sm font-medium flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4" />
                        Opciones Avanzadas (Archivos)
                    </span>
                    {showFileOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showFileOptions && (
                    <div className="space-y-4 mt-4 animate-in fade-in slide-in-from-top-2">
                        {/* 1. Master Data Upload */}
                        <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                            <h4 className="text-white font-medium mb-2 text-xs uppercase tracking-wider text-slate-400">Importar Excel Maestro</h4>
                            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="block w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-600 file:text-white hover:file:bg-slate-500 cursor-pointer" />
                        </div>

                        {/* 2. Export Pending Inspections */}
                        <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                            <h4 className="text-white font-medium mb-2 text-xs uppercase tracking-wider text-slate-400">Respaldo Manual (Exportar JSON)</h4>
                            <button onClick={handleExportInspections} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2">
                                <Download className="w-3 h-3" /> Descargar Pendientes (.json)
                            </button>
                        </div>

                        {/* 3. Import History */}
                        <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/50">
                            <h4 className="text-white font-medium mb-2 text-xs uppercase tracking-wider text-slate-400">Cargar Historial Web (.json)</h4>
                            <input type="file" accept=".json" onChange={handleImportHistory} className="block w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-600 file:text-white hover:file:bg-slate-500 cursor-pointer" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataImportExport;
