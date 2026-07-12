import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, UploadCloud, DownloadCloud, CheckCircle, AlertCircle, ArrowLeft, FileJson, Wifi } from 'lucide-react';
import { getPendingInspections, seedMasterData, saveHistoricalInspections, deletePendingInspection } from '../services/db';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const SyncPage = () => {
    const navigate = useNavigate();
    const [pendingCount, setPendingCount] = useState(0);
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [message, setMessage] = useState('');
    const [serverUrl, setServerUrl] = useState(localStorage.getItem('server_url') || 'http://');
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadPending();
    }, []);

    const loadPending = async () => {
        const pending = await getPendingInspections();
        setPendingCount(pending.length);
    };

    const formatUrl = (url) => {
        if (!url) return '';
        let formatted = String(url).trim();
        if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
            formatted = 'http://' + formatted;
        }

        try {
            const parsed = new URL(formatted);
            let basePath = (parsed.pathname || '').replace(/\/+$/, '');
            const removableSuffixes = ['/api/sync/full-dump', '/api/sync', '/sync/full-dump', '/sync'];
            for (const suffix of removableSuffixes) {
                if (basePath.toLowerCase().endsWith(suffix)) {
                    basePath = basePath.slice(0, basePath.length - suffix.length);
                    break;
                }
            }
            return `${parsed.protocol}//${parsed.host}${basePath}`;
        } catch (e) {
            if (formatted.endsWith('/')) {
                formatted = formatted.slice(0, -1);
            }
        }

        return formatted;
    };

    const handleServerUrlChange = (e) => {
        const val = e.target.value;
        setServerUrl(val);
        localStorage.setItem('server_url', val);
    };

    // --- NUEVO: Sincronización Online Directa ---
    const handleOnlineSync = async () => {
        const formattedUrl = formatUrl(serverUrl);
        if (!formattedUrl || formattedUrl === 'http://') {
            setStatus('error');
            setMessage('Debe configurar la dirección del servidor (DNS).');
            return;
        }

        setStatus('loading');
        setMessage('Conectando con el servidor...');
        localStorage.setItem('server_url', formattedUrl); 
        setServerUrl(formattedUrl);

        try {
            const { syncService } = await import('../services/syncService');
            
            // 1. Enviar inspecciones pendientes
            setMessage('Enviando inspecciones al servidor...');
            const uploadRes = await syncService.uploadPending();
            if (uploadRes.success) {
                loadPending();
            }

            // 2. Descargar Maestros y Histórico (full-dump incluye ambos ahora)
            setMessage('Actualizando Datos (Maestros e Histórico)...');
            const downloadRes = await syncService.downloadData();
            
            if (downloadRes.success) {
                setStatus('success');
                setMessage('Sincronización online completada con éxito.');
            } else {
                throw new Error("Fallo en descarga de datos");
            }
        } catch (error) {
            console.error("Online sync error:", error);
            setStatus('error');
            setMessage('Error de conexión: ' + (error.response?.data?.detail || error.message));
        }
    };
    

    // --- Sincronización Offline por Archivos (Existente) ---
    const handleImportFile = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setStatus('loading');
        setMessage('Procesando archivo...');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                await seedMasterData(data, true);
                if (data.inspections) {
                    await saveHistoricalInspections(data.inspections);
                }
                setStatus('success');
                setMessage('Datos maestros importados correctamente.');
                event.target.value = '';
            } catch (error) {
                console.error("Import error", error);
                setStatus('error');
                setMessage('El archivo no es válido o está corrupto: ' + error.message);
                event.target.value = '';
            }
        };
        reader.onerror = () => {
            setStatus('error');
            setMessage('Error al leer el archivo.');
        };
        reader.readAsText(file);
    };

    const handleExportFile = async () => {
        setStatus('loading');
        setMessage("Generando archivo de exportación...");
        try {
            const pending = await getPendingInspections();
            if (pending.length === 0) {
                setStatus('success');
                setMessage('No hay inspecciones pendientes para exportar.');
                return;
            }

            const dataStr = JSON.stringify(pending, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `inspecciones_pendientes_${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(async () => {
                const confirmClear = window.confirm("¿El archivo se guardó correctamente en OneDrive? Si presionas Aceptar, estas inspecciones se borrarán del teléfono.");
                if (confirmClear) {
                    for (const item of pending) {
                        await deletePendingInspection(item.id);
                    }
                    loadPending();
                    setStatus('success');
                    setMessage('Archivo exportado y registros limpios.');
                } else {
                    setStatus('success');
                    setMessage('Archivo exportado. Los registros siguen en el dispositivo.');
                }
            }, 1000);

        } catch (error) {
            console.error(error);
            setStatus('error');
            setMessage("Error al generar archivo: " + error.message);
        }
    };

    return (
        <div className="ga-stack" style={{ paddingBottom: '2rem' }}>
            <div className="u-flex u-items-center u-gap-4 u-mb-4">
                <button onClick={() => navigate(-1)} className="ga-btn ga-btn--text ga-btn--icon">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="ga-card__title" style={{ fontSize: '1.5rem' }}>Sincronización</h1>
            </div>

            {/* Status Card */}
            <div className="ga-card ga-stack u-center u-p-6" style={{ marginBottom: '1rem' }}>
                {status === 'loading' && <RefreshCw className="u-spin u-color-primary u-mb-3" size={40} />}
                {status === 'success' && <CheckCircle className="u-color-success u-mb-3" size={40} />}
                {status === 'error' && <AlertCircle className="u-color-danger u-mb-3" size={40} />}
                {status === 'idle' && <RefreshCw className="u-muted u-mb-3" size={40} />}

                <p className={status === 'error' ? 'u-color-danger u-text-center' : 'u-muted u-text-center'}>
                    {message || (status === 'idle' ? `Inspecciones pendientes de enviar: ${pendingCount}` : '')}
                </p>
            </div>

            {/* NUEVO: Módulo Online */}
            <h2 className="u-bold u-mb-2" style={{ fontSize: '1.125rem' }}>Sincronización Red / WiFi</h2>
            <div className="ga-card u-p-4 u-mb-4">
                <div style={{ marginBottom: '1rem' }}>
                    <label className="ga-label u-text-xs u-muted">Dirección del Servidor PC (IP o DNS)</label>
                    <input
                        type="text"
                        value={serverUrl}
                        onChange={handleServerUrlChange}
                        placeholder="Ej: http://CLDAA512-D7D.arauco.cl:8000"
                        className="ga-control"
                        style={{ fontSize: '0.875rem' }}
                    />
                </div>
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleOnlineSync}
                    disabled={status === 'loading'}
                    className="ga-btn ga-btn--primary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                    <Wifi size={18} />
                    Sincronizar Vía Red Ahora
                </motion.button>
            </div>

            <div className="u-divider u-mb-4"></div>

            {/* Offline (Archivos) */}
            <h2 className="u-bold u-mb-2" style={{ fontSize: '1.125rem' }}>Sincronización por Archivo (OneDrive)</h2>
            <div className="ga-grid ga-grid--2">
                <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                />
                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fileInputRef.current.click()}
                    disabled={status === 'loading'}
                    className="ga-card ga-btn--text u-center ga-stack"
                    style={{ border: '1px solid var(--ga-border)', background: 'var(--ga-bg)', padding: '1rem' }}
                >
                    <DownloadCloud className="u-color-primary u-mb-2" size={32} />
                    <span className="u-bold u-text-sm">Importar Maestros</span>
                </motion.button>

                <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleExportFile}
                    disabled={status === 'loading' || pendingCount === 0}
                    className="ga-card ga-btn--text u-center ga-stack"
                    style={{
                        border: '1px solid var(--ga-border)',
                        background: 'var(--ga-bg)',
                        padding: '1rem',
                        opacity: pendingCount === 0 ? 0.6 : 1
                    }}
                >
                    <div style={{ position: 'relative' }}>
                        <UploadCloud className="u-color-accent u-mb-2" size={32} />
                        {pendingCount > 0 && (
                            <span style={{
                                position: 'absolute', top: -5, right: -5,
                                background: 'var(--ga-danger)', color: 'white',
                                borderRadius: '50%', width: '18px', height: '18px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.65rem', fontWeight: 'bold'
                            }}>
                                {pendingCount}
                            </span>
                        )}
                    </div>
                    <span className="u-bold u-text-sm">Exportar Pendientes</span>
                </motion.button>
            </div>
        </div>
    );
};

export default SyncPage;
