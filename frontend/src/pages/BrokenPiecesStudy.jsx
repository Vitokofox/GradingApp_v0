import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getLocalISODate, formatSpanishDate } from '../utils/dataUtils';
import { motion } from 'framer-motion';
import { Save, Calculator, Plus, Trash2, Camera, Clipboard } from 'lucide-react';

const BrokenPiecesStudy = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [header, setHeader] = useState({
        date: getLocalISODate(),
        supervisor: user?.first_name ? `${user.first_name} ${user.last_name}` : '',
        responsible: user?.username || ''
    });

    const emptyLot = {
        lot_code: '',
        thickness: 0, // E (mm)
        width: 0,     // A (mm)
        length: 0,    // L (m)
        pieces_theoretical: 0, // Pza SAP

        // Defectos
        broken_mobile: 0,
        broken_sawmill: 0,
        broken_knot: 0,
        missing_pieces: 0,
        over_width: 0,
        under_width: 0,
        warped: 0,
        in_process: 0,

        // Calculated
        m3_theoretical: 0,
        loss_m3: 0,
        loss_percentage: 0
    };

    // Inicializar con 3 lotes vacíos
    const [lots, setLots] = useState(Array(3).fill().map(() => ({ ...emptyLot })));
    const [focusedIndex, setFocusedIndex] = useState(null);

    // Totales
    const [totals, setTotals] = useState({
        m3: 0,
        loss_m3: 0,
        percentage: 0
    });

    // Función de cálculo
    const calculateLot = (lot) => {
        // M3 = (E * A * L * Pzas) / 1,000,000
        const m3 = (lot.thickness * lot.width * lot.length * lot.pieces_theoretical) / 1000000;

        // Total Defectos
        const totalDefects =
            Number(lot.broken_mobile) + Number(lot.broken_sawmill) + Number(lot.broken_knot) +
            Number(lot.missing_pieces) + Number(lot.over_width) + Number(lot.under_width) +
            Number(lot.warped) + Number(lot.in_process);

        // Unitario M3
        let unitM3 = 0;
        if (lot.pieces_theoretical > 0) {
            unitM3 = m3 / lot.pieces_theoretical;
        }

        const lossVol = totalDefects * unitM3;
        const lossPct = m3 > 0 ? (lossVol / m3) : 0;

        return {
            ...lot,
            m3_theoretical: m3,
            loss_m3: lossVol,
            loss_percentage: lossPct
        };
    };

    const handleLotChange = (index, field, value) => {
        const newLots = [...lots];
        newLots[index] = { ...newLots[index], [field]: value };
        // Recalcular
        newLots[index] = calculateLot(newLots[index]);
        setLots(newLots);
    };

    // Add Row Handler
    const handleAddRow = () => {
        setLots([...lots, { ...emptyLot }]);
    };

    // Image Upload Handler
    const handleImageUpload = async (index, file) => {
        if (!file) return;

        const formData = new FormData();
        // Si es un Blob sin nombre (pegado), asignarle uno
        if (!file.name) {
            formData.append('file', file, 'pasted_image.png');
        } else {
            formData.append('file', file);
        }

        try {
            const res = await api.post('/broken-pieces/upload-image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const currentPath = lots[index].image_path || '';
            const newPath = currentPath ? `${currentPath};${res.data.url}` : res.data.url;

            handleLotChange(index, 'image_path', newPath);
        } catch (err) {
            console.error("Upload failed", err);
            alert("Error subiendo imagen");
        }
    };

    // Paste Event Handler
    useEffect(() => {
        const handlePaste = (e) => {
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();

                    // Determine which row to use
                    let targetIndex = focusedIndex;

                    // If no row is focused, find the first row without an image AND without data (optional philosophy, but here lets prioritize first empty image slot)
                    if (targetIndex === null) {
                        targetIndex = lots.findIndex(l => !l.image_path);
                    }

                    // If still no valid index (all full), use the last one or create new? Let's append if all are full
                    if (targetIndex === -1) {
                        // Optional: Add new row automatically
                        // For now, let's just pick the last one
                        targetIndex = lots.length - 1;
                    }

                    if (targetIndex >= 0 && targetIndex < lots.length) {
                        handleImageUpload(targetIndex, blob);
                        e.preventDefault(); // Prevent default paste behavior
                        // Provide visual feedback could be nice, but handleImageUpload handles the state update
                    }
                    break; // Stop after first image
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [lots, focusedIndex]);

    // Efecto para verificar totales globales
    useEffect(() => {
        let totalM3 = 0;
        let totalLoss = 0;

        lots.forEach(l => {
            totalM3 += l.m3_theoretical;
            totalLoss += l.loss_m3;
        });

        setTotals({
            m3: totalM3,
            loss_m3: totalLoss,
            percentage: totalM3 > 0 ? (totalLoss / totalM3) : 0
        });
    }, [lots]);

    const handleSave = async () => {
        setLoading(true);
        try {
            const payload = {
                ...header,
                lots: lots.filter(l => l.lot_code) // Solo enviar lotes con código
            };

            if (payload.lots.length === 0) {
                alert("Debe ingresar al menos un lote con código");
                setLoading(false);
                return;
            }

            const res = await api.post('/broken-pieces/', payload);
            // alert("Estudio Guardado Exitosamente");
            // Redirigir al reporte
            navigate(`/process/broken-pieces/report/${res.data.id}`);

            // setLots(Array(5).fill().map(() => ({ ...emptyLot })));
        } catch (error) {
            console.error("Error saving study", error);
            alert("Error al guardar estudio");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ga-page">
            <style>{`
                /* Hide number input spinners */
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { 
                    -webkit-appearance: none; 
                    margin: 0; 
                }
                input[type=number] {
                    -moz-appearance: textfield;
                }
            `}</style>
            <div className="ga-header u-mb-4">
                <h1 className="u-text-xl u-font-bold u-color-text-primary">Estudio de Piezas Quebradas</h1>
                <p className="u-color-text-secondary">Registro de pérdidas de rendimiento</p>
                <div className="u-text-sm u-text-gray-500 u-mt-2">
                    <span className="u-font-bold">Tip:</span> Puede pegar imágenes directamente (Cltr+V). Se asignará a la fila seleccionada o a la primera vacía.
                </div>
            </div>

            <div className="ga-card u-mb-6">
                <div className="ga-grid ga-grid--3 u-gap-4">
                    <div>
                        <label className="ga-label">Fecha</label>
                        <input type="date" className="ga-control" value={header.date} onChange={e => setHeader({ ...header, date: e.target.value })} />
                    </div>
                    <div>
                        <label className="ga-label">Supervisor</label>
                        <input type="text" className="ga-control" value={header.supervisor} onChange={e => setHeader({ ...header, supervisor: e.target.value })} />
                    </div>
                    <div>
                        <label className="ga-label">Responsable</label>
                        <input type="text" className="ga-control" value={header.responsible} disabled />
                    </div>
                </div>
            </div>

            <div className="u-mb-4 u-overflow-x-auto">
                <table className="ga-table ga-table--bordered" style={{ minWidth: '1200px' }}>
                    <thead>
                        <tr>
                            <th rowSpan="2" style={{ width: '120px' }}>Lote</th>
                            <th colSpan="3" className="u-text-center">Escuadría</th>
                            <th rowSpan="2" style={{ width: '80px' }}>Pza. SAP</th>
                            <th rowSpan="2" style={{ width: '80px' }}>M³</th>
                            <th colSpan="8" className="u-text-center" style={{ background: '#f0fdf4' }}>Defectos (Piezas)</th>
                            <th rowSpan="2" style={{ width: '100px' }}>Vol. Pérdida</th>
                            <th rowSpan="2" style={{ width: '80px' }}>% Pérdida</th>
                            <th rowSpan="2" style={{ minWidth: '200px' }}>Foto</th>
                        </tr>
                        <tr>
                            <th>E (mm)</th>
                            <th>A (mm)</th>
                            <th>L (m)</th>

                            {/* Defectos */}
                            <th title="Quebrada por móvil">Móvil</th>
                            <th title="Desde Aserradero">Aserr.</th>
                            <th title="Por Nudo">Nudo</th>
                            <th title="Faltantes">Falta</th>
                            <th title="Sobre Ancho">S.Ancho</th>
                            <th title="Bajo Ancho">B.Ancho</th>
                            <th title="Alabeo">Alabeo</th>
                            <th title="En Proceso">Proc.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lots.map((lot, idx) => (
                            <tr key={idx} className={focusedIndex === idx ? 'u-bg-blue-50' : ''}>
                                <td>
                                    <input
                                        type="text"
                                        className="ga-control ga-control--sm"
                                        placeholder="Código"
                                        value={lot.lot_code}
                                        onChange={e => handleLotChange(idx, 'lot_code', e.target.value)}
                                        onFocus={() => setFocusedIndex(idx)}
                                        style={{ width: '13ch' }}
                                    />
                                </td>
                                <td>
                                    <input type="number" className="ga-control ga-control--sm" value={lot.thickness} onChange={e => handleLotChange(idx, 'thickness', parseFloat(e.target.value))} onFocus={() => setFocusedIndex(idx)} style={{ width: '4ch', padding: '0.25rem' }} />
                                </td>
                                <td>
                                    <input type="number" className="ga-control ga-control--sm" value={lot.width} onChange={e => handleLotChange(idx, 'width', parseFloat(e.target.value))} onFocus={() => setFocusedIndex(idx)} style={{ width: '6ch', padding: '0.25rem' }} />
                                </td>
                                <td>
                                    <input type="number" className="ga-control ga-control--sm" step="0.001" value={lot.length} onChange={e => handleLotChange(idx, 'length', parseFloat(e.target.value))} onFocus={() => setFocusedIndex(idx)} style={{ width: '7ch', padding: '0.25rem' }} />
                                </td>
                                <td>
                                    <input type="number" className="ga-control ga-control--sm" value={lot.pieces_theoretical} onChange={e => handleLotChange(idx, 'pieces_theoretical', parseInt(e.target.value))} onFocus={() => setFocusedIndex(idx)} style={{ width: '5ch', padding: '0.25rem' }} />
                                </td>
                                <td className="u-text-right u-font-bold">
                                    {lot.m3_theoretical.toFixed(3)}
                                </td>

                                {/* Inputs Defectos */}
                                {['broken_mobile', 'broken_sawmill', 'broken_knot', 'missing_pieces', 'over_width', 'under_width', 'warped', 'in_process'].map(field => (
                                    <td key={field}>
                                        <input
                                            type="number"
                                            className="ga-control ga-control--sm u-bg-gray-50"
                                            value={lot[field]}
                                            onChange={e => handleLotChange(idx, field, parseInt(e.target.value) || 0)}
                                            onFocus={() => setFocusedIndex(idx)}
                                            style={{ textAlign: 'center', width: '5ch' }}
                                        />
                                    </td>
                                ))}

                                <td className="u-text-right u-color-danger">
                                    {lot.loss_m3.toFixed(4)}
                                </td>
                                <td className="u-text-right u-font-bold">
                                    {(lot.loss_percentage * 100).toFixed(2)}%
                                </td>
                                <td>
                                    <div className="u-flex u-flex-wrap u-gap-2 u-justify-start u-items-start">
                                        {(lot.image_path ? lot.image_path.split(';') : []).map((imgUrl, i) => {
                                            const fullUrl = imgUrl.startsWith('http') ? imgUrl : `${api.defaults.baseURL}${imgUrl}`;
                                            // Construct thumbnail URL (insert thumb_ prefix to filename)
                                            const parts = fullUrl.split('/');
                                            const filename = parts.pop();
                                            const thumbUrl = [...parts, `thumb_${filename}`].join('/');

                                            return (
                                                <div key={i} className="u-flex u-flex-col u-items-center u-gap-0">
                                                    <div style={{ width: '70px', height: '70px', overflow: 'hidden', borderRadius: '4px', marginBottom: '2px' }}>
                                                        <img
                                                            src={thumbUrl}
                                                            alt="Evidence"
                                                            className="u-w-full u-h-full u-object-cover u-rounded u-border u-border-gray-200"
                                                            style={{ cursor: 'pointer' }}
                                                            onError={(e) => { e.target.onerror = null; e.target.src = fullUrl; }}
                                                            onClick={() => window.open(fullUrl, '_blank')}
                                                            title="Click para ver en grande"
                                                        />
                                                    </div>
                                                    <button
                                                        className="ga-btn ga-btn--secondary u-p-0 u-flex u-items-center u-justify-center"
                                                        style={{ width: '70px', height: '25px', fontSize: '20px', lineHeight: 1 }}
                                                        onClick={() => {
                                                            const currentImages = lot.image_path.split(';');
                                                            const newImages = currentImages.filter((_, index) => index !== i);
                                                            handleLotChange(idx, 'image_path', newImages.join(';'));
                                                        }}
                                                        title="Eliminar imagen"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        <div className="u-flex u-flex-col u-gap-1">
                                            <label
                                                className="ga-btn ga-btn--icon ga-btn--sm"
                                                style={{ cursor: 'pointer' }}
                                                title="Subir archivo"
                                            >
                                                <Camera size={16} />
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => handleImageUpload(idx, e.target.files[0])}
                                                />
                                            </label>
                                            <button
                                                className="ga-btn ga-btn--icon ga-btn--sm"
                                                title="Pegar desde portapapeles (Ctrl+V)"
                                                onClick={async () => {
                                                    try {
                                                        const items = await navigator.clipboard.read();
                                                        for (const item of items) {
                                                            if (item.types.includes('image/png') || item.types.includes('image/jpeg')) {
                                                                const blob = await item.getType('image/png') || await item.getType('image/jpeg');
                                                                handleImageUpload(idx, blob);
                                                                return;
                                                            }
                                                        }
                                                        alert("No hay imagen en el portapapeles");
                                                    } catch (err) {
                                                        console.error(err);
                                                        setFocusedIndex(idx);
                                                        alert("Para pegar, usa Ctrl+V");
                                                    }
                                                }}
                                            >
                                                <Clipboard size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan="17">
                                <button className="ga-btn ga-btn--sm ga-btn--secondary u-w-full" onClick={handleAddRow}>
                                    <Plus size={16} className="u-mr-1" /> Agregar Fila
                                </button>
                            </td>
                        </tr>
                        <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                            <td colSpan="5" className="u-text-right">Totales:</td>
                            <td className="u-text-right">{totals.m3.toFixed(3)}</td>
                            <td colSpan="8"></td>
                            <td className="u-text-right u-color-danger">{totals.loss_m3.toFixed(4)}</td>
                            <td className="u-text-right">{(totals.percentage * 100).toFixed(2)}%</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="u-flex u-justify-between u-items-center u-mt-6">
                <div className="u-text-sm u-color-text-secondary">
                    * M3 calculado internamente: (E * A * L * Pzas) / 1,000,000
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="ga-btn ga-btn--primary"
                    onClick={handleSave}
                    disabled={loading}
                >
                    <Save size={18} className="u-mr-2" />
                    {loading ? 'Guardando...' : 'Guardar Estudio'}
                </motion.button>
            </div>
        </div>
    );
};

export default BrokenPiecesStudy;
