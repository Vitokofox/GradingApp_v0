import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, CheckCircle, RefreshCw, UploadCloud, Database, AlertCircle, Server } from 'lucide-react';
import axios from 'axios';
import { importDatabaseFile } from '../services/sqliteImporter';

const APP_VERSION = "1.3.1";
const OFICIAL_DNS = "http://CLDAA512-D7D.arauco.cl:8080";

const formatUrl = (url) => {
    if (!url) return '';
    let formatted = String(url).trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
        formatted = `http://${formatted}`;
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

const isIPv4Host = (host) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

const buildCandidateUrls = (rawValue) => {
    const raw = String(rawValue || '').trim().replace(/\/$/, '');
    if (!raw) return [];

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
        return [formatUrl(raw)];
    }

    const hostOnly = raw.split('/')[0];
    const hostPart = hostOnly.split(':')[0];
    const preferHttpsFirst = !isIPv4Host(hostPart);

    return preferHttpsFirst
        ? [formatUrl(`https://${raw}`), formatUrl(`http://${raw}`)]
        : [formatUrl(`http://${raw}`), formatUrl(`https://${raw}`)];
};

const Setup = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState('checking_wms'); // checking_wms, wms_failed, processing, success, error
    const [message, setMessage] = useState('Verificando conexión a la red WMS...');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [serverUrl, setServerUrl] = useState(OFICIAL_DNS);

    useEffect(() => {
        localStorage.setItem('app_version', APP_VERSION);
        checkWmsNetwork();
    }, []);

    const checkWmsNetwork = async () => {
        const candidates = buildCandidateUrls(serverUrl);
        if (candidates.length === 0) {
            setStatus('wms_failed');
            setMessage('Debe ingresar una URL o IP valida del servidor.');
            return;
        }

        setStatus('checking_wms');
        setMessage(`Buscando servidor en ${candidates[0]}...`);

        let lastError = null;
        for (const candidate of candidates) {
            try {
                const probe = await axios.get(`${candidate}/api/sync/full-dump`, { timeout: 6000 });
                if (probe?.status >= 200 && probe?.status < 300) {
                    await handleWifiSync(candidate);
                    return;
                }
            } catch (error) {
                lastError = error;
                console.warn(`No se pudo alcanzar ${candidate}`, error?.message || error);
            }
        }

        setStatus('wms_failed');
        const msg = lastError?.response?.data?.detail || lastError?.message || 'Sin respuesta del servidor';
        setMessage(`No se pudo conectar al API. Detalle: ${msg}`);
    };

    const handleWifiSync = async (url) => {
        const normalizedUrl = formatUrl(url);
        if (!normalizedUrl) {
            setStatus('error');
            setMessage('URL/IP del servidor invalida.');
            return;
        }

        setStatus('processing');
        setMessage("Descargando base de datos oficial...");

        try {
            setServerUrl(normalizedUrl);
            localStorage.setItem('server_url', normalizedUrl);
            const { syncService } = await import('../services/syncService');
            const result = await syncService.downloadData();

            setStatus('success');
            setMessage(`Datos oficiales sincronizados correctamente. Usuarios: ${result?.counts?.users || 0}.`);
            localStorage.setItem('setup_completed', 'true');
        } catch (error) {
            console.error(error);
            setStatus('error');
            setMessage(`Fallo al descargar la base de datos: ${error.message}`);
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setStatus('processing');
        setMessage(`Importando ${file.name} (Modo Offline Manual)...`);

        try {
            const result = await importDatabaseFile(file);
            if (!result.success) throw new Error(result.message);

            setStatus('success');
            setMessage(result.message);
            localStorage.setItem('setup_completed', 'true');

        } catch (error) {
            setStatus('error');
            setMessage("Error de carga manual: " + error.message);
        }
    };

    const handleEnterApp = () => {
        window.location.href = '/login';
    };

    return (
        <div className="ga-page u-center" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--ga-bg-subtle)' }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="ga-card"
                style={{ width: '100%', maxWidth: '420px', padding: '2rem' }}
            >
                <div className="u-center u-mb-6">
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        background: status === 'wms_failed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1rem auto',
                        border: `2px solid var(--ga-${status === 'wms_failed' ? 'danger' : 'primary'})`
                    }}>
                        {status === 'wms_failed' ? (
                            <WifiOff className="u-color-danger" size={32} />
                        ) : status === 'success' ? (
                            <CheckCircle className="u-color-success" size={32} />
                        ) : (
                            <Server className="u-color-primary" size={32} />
                        )}
                    </div>
                    <h1 className="ga-card__title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Configuración Inicial</h1>
                    <p className="u-muted">Dispositivo Móvil</p>
                </div>

                {status === 'checking_wms' || status === 'processing' ? (
                    <div className="ga-stack u-center u-py-6">
                        <RefreshCw className="u-color-primary u-spin u-mb-4" size={40} />
                        <h3 className="u-bold u-text-center">{message}</h3>
                        <p className="u-muted u-text-xs u-text-center u-mt-2">Por favor, espere y no cierre la aplicación...</p>
                    </div>
                ) : status === 'wms_failed' ? (
                    <div className="ga-stack u-gap-4">
                        <div className="ga-alert ga-alert--danger">
                            <h3 className="u-bold u-mb-2">Red o Servidor No Detectado</h3>
                            <p className="u-text-sm">
                                Para la carga inicial, es obligatorio estar conectado a la red oficial donde se aloja la base de datos (Ej: red WMS).
                            </p>
                        </div>
                        
                        <div className="u-text-left u-mb-2">
                            <label className="ga-label u-text-xs">Dirección del Servidor (Puedes usar la IP del PC si el DNS falla):</label>
                            <input 
                                type="text" 
                                className="ga-input" 
                                value={serverUrl} 
                                onChange={(e) => setServerUrl(e.target.value)} 
                                onBlur={(e) => {
                                    const options = buildCandidateUrls(e.target.value);
                                    setServerUrl(options[0] || e.target.value.trim());
                                }}
                            />
                        </div>

                        <div className="ga-stack" style={{ flexDirection: 'row', gap: '0.5rem' }}>
                            <button onClick={checkWmsNetwork} className="ga-btn ga-btn--primary u-flex-1" style={{ justifyContent: 'center' }}>
                                <RefreshCw size={18} className="u-mr-2" /> Reintentar
                            </button>
                            <button onClick={() => handleWifiSync(serverUrl)} className="ga-btn ga-btn--outline u-flex-1" style={{ justifyContent: 'center' }}>
                                Forzar Sincro
                            </button>
                        </div>
                    </div>
                ) : status === 'success' ? (
                    <div className="ga-stack u-center">
                        <h2 className="ga-card__title u-mb-4">¡Listo para trabajar!</h2>
                        <p className="u-muted u-mb-6 u-text-center">{message}</p>

                        <button onClick={handleEnterApp} className="ga-btn ga-btn--primary ga-btn--lg" style={{ width: '100%', justifyContent: 'center' }}>
                            Ingresar a la App
                        </button>
                    </div>
                ) : null}

                {/* Optional Error State mapping if standard download fails after connection is validated */}
                {status === 'error' && (
                    <div className="ga-stack u-gap-4">
                        <div className="ga-alert ga-alert--danger u-text-sm">
                            <AlertCircle size={16} className="u-inline u-mr-1" />
                            {message}
                        </div>
                        <button onClick={checkWmsNetwork} className="ga-btn ga-btn--outline u-w-full" style={{ justifyContent: 'center' }}>
                            Volver a intentar
                        </button>
                    </div>
                )}

                {/* Advanced Options For Admins / Manual loading fallback */}
                {status !== 'success' && status !== 'processing' && status !== 'checking_wms' && (
                    <div className="u-mt-6 u-border-t u-pt-4">
                        <button 
                            className="ga-btn ga-btn--text u-w-full u-text-xs u-muted" 
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            style={{ justifyContent: 'center' }}
                        >
                            {showAdvanced ? "Ocultar Opciones Avanzadas" : "Opciones Avanzadas"}
                        </button>

                        {showAdvanced && (
                            <div className="u-mt-4 ga-stack u-center u-p-4" style={{ background: 'var(--ga-bg)', borderRadius: 'var(--ga-radius)', border: '1px dashed var(--ga-border)' }}>
                                <p className="u-text-xs u-muted u-text-center u-mb-3">
                                    Carga de base de datos local SQLite (.db) si no es posible acceder a la red WMS físicamente.
                                </p>
                                <label className="ga-btn ga-btn--outline ga-btn--sm" style={{ cursor: 'pointer' }}>
                                    <Database size={14} className="u-mr-2" />
                                    Importar Archivo .db
                                    <input type="file" accept=".db,.sqlite,.sqlite3" onChange={handleFileSelect} style={{ display: 'none' }} />
                                </label>
                            </div>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default Setup;
