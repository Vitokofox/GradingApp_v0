import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { seedMasterData, saveUserOffline } from '../services/db';
import seedDataTemplate from '../seed_data.json'; // Use existing seed data as structure reference

const DataImportExport = () => {
    const [importStatus, setImportStatus] = useState('idle'); // idle, processing, success, error
    const [message, setMessage] = useState('');

    const handleDownloadTemplate = () => {
        try {
            const wb = XLSX.utils.book_new();

            // Define categories based on seed_data keys
            const categories = [
                'shifts', 'journeys', 'areas', 'machines',
                'origins', 'states', 'terminations', 'supervisors',
                'markets', 'products', 'defects', 'grades', 'users'
            ];

            categories.forEach(category => {
                // Create a sample row based on the template or a generic one
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
            console.error("Download failed", error);
            setImportStatus('error');
            setMessage('Error al generar la plantilla.');
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImportStatus('processing');
        setMessage('Procesando archivo...');

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);

            const newMasterData = {};
            let totalItems = 0;

            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length > 0) {
                    // Basic validation: ensure items have at least an ID and Name if possible, 
                    // but we'll trust the user mostly.
                    // We might want to ensure 'category' field exists if the app logic relies on it,
                    // or add it automatically based on sheet name.

                    const processedData = jsonData.map(item => ({
                        ...item,
                        id: item.id ? String(item.id) : undefined,
                        category: item.category || sheetName.slice(0, -1)
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
                        // Handle users separately
                        console.log("Importing users...", processedData);
                        for (const user of processedData) {
                            await saveUserOffline(user);
                        }
                        totalItems += processedData.length;
                    } else {
                        newMasterData[sheetName] = processedData;
                        totalItems += processedData.length;
                    }
                }
            }

            if (totalItems === 0) {
                throw new Error("El archivo parece estar vacío o no tiene hojas válidas.");
            }

            console.log("Importing data:", newMasterData);
            await seedMasterData(newMasterData, true);

            setImportStatus('success');
            setMessage(`¡Éxito! Se importaron ${totalItems} registros.`);

            // Clear input
            e.target.value = '';

        } catch (error) {
            console.error("Import failed", error);
            setImportStatus('error');
            setMessage('Error al importar: ' + error.message);
        }
    };

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-green-400" />
                    Gestión de Datos (Excel)
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                    Descarga la plantilla, edítala en tu PC y súbela para actualizar los datos maestros.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Download Section */}
                <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center justify-center gap-3 p-4 bg-slate-700 hover:bg-slate-600 rounded-xl border border-slate-600 transition-all group"
                >
                    <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                        <Download className="w-6 h-6 text-green-400" />
                    </div>
                    <div className="text-left">
                        <span className="block font-semibold text-slate-200">Descargar Plantilla</span>
                        <span className="text-xs text-slate-400">Formato .xlsx</span>
                    </div>
                </button>

                {/* Upload Section */}
                <div className="relative">
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        disabled={importStatus === 'processing'}
                    />
                    <div className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all ${importStatus === 'processing'
                        ? 'bg-slate-800 border-slate-700 opacity-50'
                        : 'bg-blue-600/10 hover:bg-blue-600/20 border-blue-500/30 hover:border-blue-500/50'
                        }`}>
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            {importStatus === 'processing' ? (
                                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                            ) : (
                                <Upload className="w-6 h-6 text-blue-400" />
                            )}
                        </div>
                        <div className="text-left">
                            <span className="block font-semibold text-blue-100">
                                {importStatus === 'processing' ? 'Procesando...' : 'Cargar Excel'}
                            </span>
                            <span className="text-xs text-blue-300">
                                {importStatus === 'processing' ? 'Por favor espere' : 'Toca para seleccionar'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Message */}
            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${importStatus === 'error' ? 'bg-red-500/20 text-red-200 border border-red-500/30' :
                    importStatus === 'success' ? 'bg-green-500/20 text-green-200 border border-green-500/30' :
                        'bg-slate-700 text-slate-300'
                    }`}>
                    {importStatus === 'error' ? <AlertCircle className="w-5 h-5" /> :
                        importStatus === 'success' ? <CheckCircle className="w-5 h-5" /> : null}
                    <span className="text-sm font-medium">{message}</span>
                </div>
            )}
        </div>
    );
};

export default DataImportExport;
