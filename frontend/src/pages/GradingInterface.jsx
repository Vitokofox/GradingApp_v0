import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInspection, getGradesByProduct, addInspectionResult, getProducts, getInspectionResults, syncInspectionResults, getDefects, startMoistureCapture, getMoistureCapture, getInspectionMoistureReadings } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ChevronRight, ChevronDown, Save, Search, PlayCircle, PlusCircle, Trash2, Droplets, Radio, AlertTriangle } from 'lucide-react';
import QualityAlertModal from '../components/QualityAlertModal';

export default function GradingInterface() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [inspection, setInspection] = useState(null);
    const [grades, setGrades] = useState([]);
    const [stats, setStats] = useState({});
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [showQualityAlert, setShowQualityAlert] = useState(false);
    const [finishAfterQualityAlert, setFinishAfterQualityAlert] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [moistureReadings, setMoistureReadings] = useState([]);
    const [moistureCapture, setMoistureCapture] = useState(null);
    const [moistureBusy, setMoistureBusy] = useState(false);
    const [moistureCaptureResult, setMoistureCaptureResult] = useState(null);
    const moistureCountBeforeCapture = useRef(0);

    // View state
    const [activeGradeId, setActiveGradeId] = useState(null);
    const [visibleDefects, setVisibleDefects] = useState({}); // { gradeId: [defectId1, defectId2] }
    const [addingDefectFor, setAddingDefectFor] = useState(null);

    // Global Defect Catalog
    const [allSystemDefects, setAllSystemDefects] = useState([]);
    const [showAllDefectsFor, setShowAllDefectsFor] = useState(null); // gradeId where we are showing full catalog

    // Estado derivado para calculos
    const baseGrade = grades.find(g => g.grade_rank === 1) || (grades.length > 0 ? grades[0] : null);

    useEffect(() => {
        loadContext();
    }, [id]);

    const loadContext = async () => {
        try {
            const insp = await getInspection(id);
            setInspection(insp);

            // Fetch Global Defects map
            let systemDefects = [];
            try {
                systemDefects = await getDefects();
                setAllSystemDefects(systemDefects);
            } catch (e) {
                console.error("Error loading system defects", e);
            }

            let productGrades = [];
            let targetProductId = insp.product_id;

            if (!targetProductId && insp.product_name) {
                try {
                    const allProducts = await getProducts();
                    const foundProduct = allProducts.find(p => p.name === insp.product_name);
                    if (foundProduct) {
                        targetProductId = foundProduct.id;
                    }
                } catch (e) {
                    console.error("Error fetching products to find ID", e);
                }
            }

            if (targetProductId) {
                productGrades = await getGradesByProduct(targetProductId);
            }
            setGrades(productGrades);

            // Inicializar Estadísticas y Defectos Visibles
            const initialStats = {};
            const initialVisible = {};

            productGrades.forEach(g => {
                initialStats[g.id] = {
                    name: g.name,
                    total: 0,
                    defects: {}
                };
                initialVisible[g.id] = [];
            });

            // Cargar resultados existentes
            const results = await getInspectionResults(id);

            try {
                setMoistureReadings(await getInspectionMoistureReadings(id));
            } catch (e) {
                console.error("Error loading moisture readings", e);
            }

            results.forEach(r => {
                if (initialStats[r.grade_id]) {
                    initialStats[r.grade_id].total += r.pieces_count;
                    if (r.defect_id) {
                        initialStats[r.grade_id].defects[r.defect_id] = (initialStats[r.grade_id].defects[r.defect_id] || 0) + r.pieces_count;
                        if (!initialVisible[r.grade_id].includes(r.defect_id)) {
                            initialVisible[r.grade_id].push(r.defect_id);
                        }
                    }

                    // Inject defect if missing from grade
                    const grade = productGrades.find(g => g.id === r.grade_id);
                    if (grade && r.defect_id) {
                        const defectExists = grade.defects && grade.defects.find(d => d.id === r.defect_id);
                        if (!defectExists) {
                            const fullDefect = systemDefects.find(sd => sd.id === r.defect_id) || { id: r.defect_id, name: `Defecto #${r.defect_id}` };
                            if (!grade.defects) grade.defects = [];
                            grade.defects.push(fullDefect);
                        }
                    }
                }
            });

            // Recalcular base grade
            if (insp && productGrades.length > 0) {
                const base = productGrades.find(g => g.grade_rank === 1) || productGrades[0];
                if (base) {
                    let othersCount = 0;
                    Object.keys(initialStats).forEach(key => {
                        if (parseInt(key) !== base.id) {
                            othersCount += initialStats[key].total;
                        }
                    });

                    initialStats[base.id].total = Math.max(0, insp.pieces_inspected - othersCount);
                }
            }

            setStats(initialStats);
            setVisibleDefects(initialVisible);

        } catch (error) {
            console.error("Error loading context", error);
        }
    };

    useEffect(() => {
        if (!moistureCapture || ['completed', 'no_data', 'error'].includes(moistureCapture.status)) return undefined;
        const timer = window.setInterval(async () => {
            try {
                const current = await getMoistureCapture(moistureCapture.id);
                setMoistureCapture(current);
                if (['completed', 'no_data', 'error'].includes(current.status)) {
                    const updatedReadings = await getInspectionMoistureReadings(id);
                    setMoistureReadings(updatedReadings);
                    if (current.status === 'completed') {
                        setMoistureCaptureResult({
                            total: updatedReadings.length,
                            added: Math.max(0, updatedReadings.length - moistureCountBeforeCapture.current),
                        });
                    }
                    setMoistureBusy(false);
                }
            } catch (error) {
                console.error("Error checking moisture capture", error);
                setMoistureBusy(false);
            }
        }, 1000);
        return () => window.clearInterval(timer);
    }, [moistureCapture, id]);

    const handleMoistureCapture = async () => {
        if (moistureBusy) return;
        moistureCountBeforeCapture.current = moistureReadings.length;
        setMoistureCaptureResult(null);
        setMoistureBusy(true);
        try {
            const capture = await startMoistureCapture(id);
            setMoistureCapture(capture);
        } catch (error) {
            setMoistureBusy(false);
            const detail = error.response?.data?.detail || error.message;
            alert(`No se pudo iniciar la captura L622: ${detail}`);
        }
    };

    const handleAddDefect = (gradeId, defectIdStr) => {
        if (!defectIdStr) return;
        const defectId = parseInt(defectIdStr);

        setVisibleDefects(prev => ({
            ...prev,
            [gradeId]: [...(prev[gradeId] || []), defectId]
        }));
        setAddingDefectFor(null);
        setShowAllDefectsFor(null);
    };

    // Ayudante para ajustar conteos con lógica de "Sin Defecto" automática
    const adjustCount = (gradeId, defectId, delta) => {
        if (!inspection || !baseGrade) return;

        const newStats = JSON.parse(JSON.stringify(stats));
        const isBase = gradeId === baseGrade.id;

        if (isBase) {
            // En el grado base, cualquier incremento de defecto resta del total "sin defecto" global
            // Pero en este sistema el grado base no suele tener defectos visibles.
            // Si los tuviera, la lógica sería similar.
            handleManualChange(gradeId, defectId, (newStats[gradeId].defects?.[defectId] || 0) + delta);
            return;
        }

        const stat = newStats[gradeId];
        const currentDefectsSum = Object.values(stat.defects || {}).reduce((a, b) => a + b, 0);
        const currentSinDefecto = Math.max(0, stat.total - currentDefectsSum);

        if (defectId) {
            // Ajustando un defecto específico
            const currentVal = stat.defects[defectId] || 0;
            const newVal = Math.max(0, currentVal + delta);
            const diff = newVal - currentVal;

            if (diff > 0) {
                // Agregar pieza a defecto
                if (currentSinDefecto > 0) {
                    // Tomar del "Sin Defecto" de este mismo grado
                    // El total del grado NO cambia, solo se redistribuye
                    stat.defects[defectId] = newVal;
                } else {
                    // Si no hay "Sin Defecto" en este grado, tomar del Grado Base (aumenta total del grado)
                    handleManualChange(gradeId, defectId, newVal);
                    return;
                }
            } else if (diff < 0) {
                // Quitar pieza de defecto -> Vuelve al "Sin Defecto" de este grado
                stat.defects[defectId] = newVal;
                // El total no cambia, se queda en este grado pero como "Sin Defecto"
            }
        } else {
            // Ajustando el total del grado (vía el virtual "Sin Defecto")
            const newValTotal = Math.max(currentDefectsSum, stat.total + delta);
            handleManualChange(gradeId, null, newValTotal);
            return;
        }

        setStats(newStats);
    };


    const handleRemoveDefect = (gradeId, defectId) => {
        const confirmDelete = window.confirm("¿Estás seguro de que deseas eliminar este defecto?");
        if (!confirmDelete) return;

        // 1. Calculate reduction
        const newStats = JSON.parse(JSON.stringify(stats));
        const currentDefectCount = newStats[gradeId].defects?.[defectId] || 0;

        // Remove defect entry
        if (newStats[gradeId].defects) {
            delete newStats[gradeId].defects[defectId];
        }

        // Reduce grade total
        newStats[gradeId].total = Math.max(0, newStats[gradeId].total - currentDefectCount);

        // 2. Recalculate Base Grade (if needed)
        if (inspection && baseGrade) {
            let othersCount = 0;
            // Sum all other grades' totals
            Object.keys(newStats).forEach(key => {
                if (parseInt(key) !== baseGrade.id) {
                    othersCount += newStats[key].total;
                }
            });
            // Update base grade remainder
            newStats[baseGrade.id].total = Math.max(0, inspection.pieces_inspected - othersCount);
        }

        setStats(newStats);

        // 3. Remove from visible list UI
        setVisibleDefects(prev => ({
            ...prev,
            [gradeId]: (prev[gradeId] || []).filter(id => id !== defectId)
        }));
    };

    const handleManualChange = (gradeId, defectId, valueStr) => {
        const value = valueStr === '' ? 0 : parseInt(valueStr);
        if (isNaN(value) || value < 0) return;

        // Clone stats to simulate calculation
        const newStats = JSON.parse(JSON.stringify(stats));

        if (defectId) {
            if (!newStats[gradeId].defects) newStats[gradeId].defects = {};
            const currentDefectCount = newStats[gradeId].defects[defectId] || 0;
            const diff = value - currentDefectCount;
            newStats[gradeId].defects[defectId] = value;
            newStats[gradeId].total = Math.max(0, newStats[gradeId].total + diff);
        } else {
            if (baseGrade && gradeId === baseGrade.id) return;
            newStats[gradeId].total = value;
        }

        // VALIDATION: Check total limit
        if (inspection && baseGrade) {
            let othersCount = 0;

            Object.keys(newStats).forEach(key => {
                if (parseInt(key) !== baseGrade.id) {
                    othersCount += newStats[key].total;
                }
            });

            if (othersCount > inspection.pieces_inspected) {
                alert(`Límite excedido. El total de inspeciones no puede ser mayor a ${inspection.pieces_inspected}.`);
                return; // ⛔ REJECT UPDATE
            }

            // Recalculate Base Grade
            newStats[baseGrade.id].total = Math.max(0, inspection.pieces_inspected - othersCount);
        }

        setStats(newStats);
    };

    const handleSaveInspection = async () => {
        const resultsToSync = [];

        Object.keys(stats).forEach(gradeIdStr => {
            const gradeId = parseInt(gradeIdStr);
            const stat = stats[gradeId];

            // 1. Guardar defectos específicos
            let sumDefects = 0;
            if (stat.defects && Object.keys(stat.defects).length > 0) {
                Object.keys(stat.defects).forEach(defectIdStr => {
                    const defectId = parseInt(defectIdStr);
                    const count = stat.defects[defectId];
                    if (count > 0) {
                        sumDefects += count;
                        resultsToSync.push({
                            grade_id: gradeId,
                            defect_id: defectId,
                            pieces_count: count
                        });
                    }
                });
            }

            // 2. Guardar el remanente "Sin Defecto" para este grado
            const sinDefecto = stat.total - sumDefects;
            if (sinDefecto > 0) {
                resultsToSync.push({
                    grade_id: gradeId,
                    defect_id: null,
                    pieces_count: sinDefecto
                });
            }
        });


        try {
            await syncInspectionResults(id, resultsToSync);
            alert("Inspección guardada correctamente.");
            return true;
        } catch (error) {
            console.error("Save error", error);
            alert("Error al guardar la inspección.");
            return false;
        }
    };

    const handleFinish = async () => {
        const saved = await handleSaveInspection();
        if (saved) navigate('/');
    };

    const handleQualityAlertClose = () => {
        setShowQualityAlert(false);
        setFinishAfterQualityAlert(false);
    };

    const handleQualityAlertSaved = async (qualityAlert, updatedInspection) => {
        if (updatedInspection) {
            setInspection(updatedInspection);
        } else {
            setInspection(current => ({ ...current, quality_alert: qualityAlert }));
        }
        if (finishAfterQualityAlert) {
            setShowQualityAlert(false);
            setFinishAfterQualityAlert(false);
            await handleFinish();
        }
    };

    // Filter Logic
    const displayedGrades = grades
        .filter(grade => activeGradeId === null || grade.id === activeGradeId)
        .filter(grade => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return grade.name.toLowerCase().includes(term);
        });

    if (!inspection) return <div className="ga-page u-center u-muted">Cargando contexto de inspección...</div>;

    return (
        <div className="ga-app" style={{ height: '100vh', overflow: 'hidden', flexDirection: 'row' }}>

            {showQualityAlert && (
                <QualityAlertModal
                    inspection={inspection}
                    editable
                    onClose={handleQualityAlertClose}
                    onSaved={handleQualityAlertSaved}
                />
            )}

            <AnimatePresence>
                {showFinishModal && (
                    <div className="ga-modal-backdrop">
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="ga-modal"
                        >
                            <div className="ga-modal__header" style={{ justifyContent: 'center', flexDirection: 'column', alignItems: 'center', border: 'none', paddingBottom: 0 }}>
                                <div style={{
                                    width: '80px', height: '80px', borderRadius: '50%',
                                    background: 'var(--ga-success)', color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: '1rem'
                                }}>
                                    <CheckCircle size={48} />
                                </div>
                                <h2 className="ga-card__title" style={{ fontSize: '2rem' }}>Resumen Final</h2>
                            </div>

                            <div className="ga-modal__content u-center">
                                <p className="u-muted u-mb-4" style={{ fontSize: '1.25rem' }}>
                                    Total Piezas: <span className="u-bold">{inspection.pieces_inspected}</span>
                                </p>

                                <div className="ga-card" style={{ textAlign: 'left', maxHeight: '300px', overflowY: 'auto' }}>
                                    <div className="ga-card__header u-bold u-muted" style={{ fontSize: '0.875rem' }}>DETALLE CLASIFICACIÓN</div>
                                    <div className="ga-card__body">
                                        {Object.values(stats).filter(s => s.total > 0).map((s, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--ga-border)' }}>
                                                <span>{s.name}</span>
                                                <span className="u-bold">{s.total}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="ga-modal__footer" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                                <button onClick={handleFinish} className="ga-btn ga-btn--primary ga-btn--lg" style={{ width: '100%', justifyContent: 'center' }}>
                                    Confirmar y Salir
                                </button>
                                {(inspection.type === 'finished_product' || inspection.type === 'line_grading') && (
                                    <button
                                        onClick={() => {
                                            setFinishAfterQualityAlert(true);
                                            setShowQualityAlert(true);
                                        }}
                                        className="ga-btn ga-btn--secondary ga-btn--lg"
                                        style={{ width: '100%', justifyContent: 'center' }}
                                    >
                                        <AlertTriangle size={18} /> Confirmar y Generar Alerta
                                    </button>
                                )}
                                <button onClick={() => setShowFinishModal(false)} className="ga-btn ga-btn--outline" style={{ width: '100%', justifyContent: 'center' }}>
                                    Volver
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* SIDEBAR */}
            <div className="ga-sidebar" style={{ width: '320px', borderRight: '1px solid var(--ga-border)', background: 'var(--ga-surface)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--ga-border)' }}>
                    <h2 className="ga-card__title u-truncate" title={inspection.product_name} style={{ color: 'var(--ga-primary)', marginBottom: '0.25rem' }}>
                        {inspection.product_name}
                    </h2>
                    <p className="u-muted" style={{ fontSize: '0.875rem' }}>Lote: {inspection.lot || 'N/A'}</p>

                    <div className="u-mt-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="u-bold u-muted" style={{ fontSize: '0.75rem' }}>OBJETIVO</span>
                        <span className="u-bold" style={{ fontSize: '1.5rem' }}>{inspection.pieces_inspected}</span>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    <div
                        onClick={() => setActiveGradeId(null)}
                        style={{
                            padding: '0.75rem',
                            marginBottom: '1rem',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            cursor: 'pointer',
                            background: activeGradeId === null ? 'var(--ga-primary)' : 'var(--ga-bg)',
                            color: activeGradeId === null ? 'white' : 'inherit',
                            borderRadius: '6px',
                            border: activeGradeId === null ? 'none' : '1px solid var(--ga-border)',
                            fontWeight: 'bold'
                        }}
                    >
                        <span>Ver Resumen / Todo</span>
                    </div>

                    <h3 className="u-bold u-muted u-mb-4" style={{ fontSize: '0.75rem' }}>CASCADA DE CLASIFICACIÓN</h3>

                    <div className="ga-stack">
                        {grades.map(g => {
                            const stat = stats[g.id] || { total: 0 };
                            const isBase = baseGrade && g.id === baseGrade.id;
                            const isActive = activeGradeId === g.id;

                            return (
                                <div key={g.id}
                                    onClick={() => setActiveGradeId(g.id)}
                                    style={{
                                        background: isActive ? 'var(--ga-blue-50)' : 'var(--ga-bg)',
                                        borderRadius: '6px', overflow: 'hidden',
                                        border: isActive ? '2px solid var(--ga-primary)' : '1px solid var(--ga-border)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}>
                                    <div
                                        style={{
                                            padding: '0.75rem',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{
                                                width: '10px', height: '10px', borderRadius: '50%',
                                                background: isBase ? 'var(--ga-success)' : g.grade_rank === 2 ? 'var(--ga-warning)' : 'var(--ga-danger)'
                                            }} />
                                            <span style={{ fontSize: '0.875rem', fontWeight: isActive ? 'bold' : 'normal' }}>{g.name}</span>
                                        </div>
                                        <span className={`u-bold ${isBase ? 'u-text-success' : ''}`}>{stat.total}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--ga-soft-bg)' }}>
                <div className="ga-topbar" style={{ background: 'var(--ga-surface)', borderBottom: '1px solid var(--ga-border)', padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h1 className="ga-topbar-title" style={{ fontSize: '1.25rem' }}>
                        {activeGradeId ? grades.find(g => g.id === activeGradeId)?.name : 'Resumen de Clasificación'}
                    </h1>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={handleSaveInspection} className="ga-btn ga-btn--primary">
                            <Save size={18} /> <span style={{ marginLeft: '0.5rem' }}>Guardar Progreso</span>
                        </button>
                        <button onClick={() => setShowFinishModal(true)} className="ga-btn ga-btn--outline">
                            <PlayCircle size={18} /> <span style={{ marginLeft: '0.5rem' }}>Finalizar</span>
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                        <div className="ga-card" style={{ borderLeft: '4px solid var(--ga-primary)' }}>
                            <div className="ga-card__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Droplets size={22} color="var(--ga-primary)" />
                                    <div>
                                        <h3 className="u-bold">Humedad Wagner L622</h3>
                                        <p className="u-muted" style={{ fontSize: '0.8rem' }}>Puerto serial: /dev/ttyUSB0 · 9600 8N1</p>
                                    </div>
                                </div>
                                <button onClick={handleMoistureCapture} disabled={moistureBusy} className="ga-btn ga-btn--primary">
                                    <Radio size={17} /> {moistureBusy ? 'Capturando...' : 'Capturar L622'}
                                </button>
                            </div>
                            <div className="ga-card__body">
                                {moistureBusy && <p className="u-muted">Ahora seleccione <strong>MENU → Print → STORE</strong> en el L622. La captura permanece activa durante 8 segundos.</p>}
                                {moistureCapture?.status === 'no_data' && <p style={{ color: 'var(--ga-warning)' }}>No se recibieron datos. Verifique el cable y vuelva a intentar.</p>}
                                {moistureCapture?.status === 'error' && <p style={{ color: 'var(--ga-danger)' }}>{moistureCapture.error_message}</p>}
                                {moistureCapture?.status === 'completed' && moistureCaptureResult && (
                                    <p style={{ color: 'var(--ga-success)', fontWeight: 700 }}>
                                        Captura completada: {moistureCaptureResult.total} registros guardados en total ({moistureCaptureResult.added} nuevos).
                                    </p>
                                )}
                                {moistureReadings.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.75rem' }}>
                                        {moistureReadings.map(reading => (
                                            <div key={reading.id} className="ga-badge ga-badge--ok">
                                                Registro {reading.device_record_number}: <strong>{reading.moisture_percent}%</strong>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {displayedGrades.map(grade => {
                            const isBase = baseGrade && grade.id === baseGrade.id;

                            // Check active defects
                            const visibleDefectIds = visibleDefects[grade.id] || [];
                            // Ensure valid defects list
                            const allDefects = grade.defects || [];

                            // Determine which defects to show in dropdown
                            // If showing all, use allSystemDefects, else use mapped grade defects
                            const sourceList = (showAllDefectsFor === grade.id) ? allSystemDefects : allDefects;
                            const availableDefects = sourceList.filter(d => !visibleDefectIds.includes(d.id));

                            if (isBase) {
                                return (
                                    <div key={grade.id} className="ga-card" style={{ borderLeft: '4px solid var(--ga-success)' }}>
                                        <div className="ga-card__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div>
                                                <h3 className="u-bold u-text-success" style={{ fontSize: '1.25rem' }}>{grade.name} (Sin Defecto)</h3>
                                                <p className="u-muted">Piezas en grado óptimo (Calculado automáticamente)</p>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                                <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--ga-success)', lineHeight: 1 }}>
                                                    {stats[grade.id]?.total || 0}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }


                            return (
                                <div key={grade.id} className="ga-card">
                                    <div className="ga-card__header" style={{ background: 'var(--ga-surface)', borderBottom: '1px solid var(--ga-border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div className="ga-badge" style={{
                                                background: grade.grade_rank === 2 ? 'var(--ga-warning)' : 'var(--ga-danger)',
                                                color: 'white', width: '28px', height: '28px', borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {grade.grade_rank}
                                            </div>
                                            <h3 className="ga-card__title">{grade.name}</h3>
                                        </div>
                                    </div>

                                    <div className="ga-stack" style={{ gap: 0 }}>
                                        {/* Row virtual: Sin Defecto (En Grado) */}
                                        <div style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '0.75rem 1.5rem',
                                            borderBottom: '2px solid var(--ga-border-light)',
                                            background: 'rgba(34, 197, 94, 0.05)'
                                        }}>
                                            <div>
                                                <span style={{ fontWeight: '800', color: 'var(--ga-success)', fontSize: '0.875rem' }}>SIN DEFECTO / EN GRADO</span>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Piezas aceptables en {grade.name}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div className="ga-tally">
                                                    <button onClick={() => adjustCount(grade.id, null, -1)} className="ga-tally-btn">-</button>
                                                    <div className="ga-tally-value">
                                                        {Math.max(0, (stats[grade.id]?.total || 0) - Object.values(stats[grade.id]?.defects || {}).reduce((a, b) => a + b, 0))}
                                                    </div>
                                                    <button onClick={() => adjustCount(grade.id, null, 1)} className="ga-tally-btn">+</button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Render Visible Defects */}
                                        {visibleDefectIds.map(defectId => {
                                            const defect = allDefects.find(d => d.id === defectId) || allSystemDefects.find(d => d.id === defectId);
                                            if (!defect) return null;

                                            const count = stats[grade.id]?.defects?.[defect.id] || 0;

                                            return (
                                                <div key={defect.id} style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '1rem 1.5rem',
                                                    borderBottom: '1px solid var(--ga-border-light)'
                                                }}>
                                                    <span style={{ fontWeight: '500' }}>{defect.name}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <div className="ga-tally">
                                                            <button onClick={() => adjustCount(grade.id, defect.id, -1)} className="ga-tally-btn">-</button>
                                                            <input
                                                                type="number"
                                                                className="ga-tally-input"
                                                                value={count === 0 ? '' : count}
                                                                placeholder="0"
                                                                onChange={(e) => handleManualChange(grade.id, defect.id, e.target.value)}
                                                                onFocus={(e) => e.target.select()}
                                                            />
                                                            <button onClick={() => adjustCount(grade.id, defect.id, 1)} className="ga-tally-btn">+</button>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveDefect(grade.id, defect.id)}
                                                            className="ga-btn ga-btn--icon ga-btn--sm"
                                                            style={{ color: 'var(--ga-danger)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.5 }}
                                                            title="Eliminar defecto de la vista"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}


                                        {/* Fallback if no defects defined for grade (e.g. pure downgrade without defect types) */}
                                        {allDefects.length === 0 && visibleDefectIds.length === 0 && (
                                            <div style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span className="u-muted">Cantidad Total</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="ga-control"
                                                    style={{ width: '100px', textAlign: 'center', fontSize: '1.125rem', fontWeight: 'bold' }}
                                                    value={stats[grade.id]?.total === undefined || stats[grade.id]?.total === 0 ? '' : stats[grade.id]?.total}
                                                    placeholder="0"
                                                    onChange={(e) => handleManualChange(grade.id, null, e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                />
                                            </div>
                                        )}

                                        {/* Add Defect Button Area */}
                                        <div style={{ padding: '1rem 1.5rem', background: 'var(--ga-bg)', display: 'flex', justifyContent: 'center' }}>
                                            {addingDefectFor === grade.id ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <select
                                                            className="ga-control"
                                                            autoFocus
                                                            style={{ flex: 1 }}
                                                            value=""
                                                            onChange={(e) => handleAddDefect(grade.id, e.target.value)}
                                                            onBlur={() => setTimeout(() => {
                                                                if (!showAllDefectsFor) setAddingDefectFor(null);
                                                            }, 300)}
                                                        >
                                                            <option value="">
                                                                {showAllDefectsFor === grade.id ? 'Seleccionar cualquier defecto...' : 'Seleccionar defecto estándar...'}
                                                            </option>
                                                            {availableDefects.map(d => (
                                                                <option key={d.id} value={d.id}>{d.name}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            className="ga-btn ga-btn--outline"
                                                            onClick={(e) => { e.preventDefault(); setAddingDefectFor(null); setShowAllDefectsFor(null); }}
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </div>

                                                    {showAllDefectsFor !== grade.id && (
                                                        <button
                                                            className="ga-btn ga-btn--text ga-btn--sm"
                                                            style={{ alignSelf: 'start', fontSize: '0.75rem' }}
                                                            // e.preventDefault to keep focus within container if possible
                                                            onMouseDown={(e) => { e.preventDefault(); setShowAllDefectsFor(grade.id); }}
                                                        >
                                                            + Buscar en todos los defectos
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <button
                                                    className="ga-btn ga-btn--outline ga-btn--sm"
                                                    onClick={() => setAddingDefectFor(grade.id)}
                                                    style={{ color: 'var(--ga-primary)', borderStyle: 'dashed' }}
                                                >
                                                    + Agregar Defecto
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
