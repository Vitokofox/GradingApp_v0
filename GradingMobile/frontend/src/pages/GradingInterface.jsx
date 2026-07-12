
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInspection, getGradesByProduct, addInspectionResult, getProducts, getInspectionResults, syncInspectionResults, getDefects } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, Activity, Database, ChevronRight, X, RotateCcw, Home, Search, Save, AlertCircle } from 'lucide-react';

import { normalizeArray } from '../utils/dataUtils';

export default function GradingInterface() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [inspection, setInspection] = useState(null);
    const [grades, setGrades] = useState([]);
    const [stats, setStats] = useState({});
    const [countLog, setCountLog] = useState([]);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [autoFill, setAutoFill] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [allSystemDefects, setAllSystemDefects] = useState([]);
    const [addingDefectFor, setAddingDefectFor] = useState(null);

    // Responsive State
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Estado derivado
    const totalInspected = Object.values(stats).reduce((acc, curr) => acc + curr.total, 0);

    useEffect(() => {
        loadContext();
    }, [id]);

    const loadContext = async () => {
        try {
            const insp = await getInspection(id);
            setInspection(insp);

            let systemDefects = [];
            try {
                systemDefects = normalizeArray(await getDefects());
                setAllSystemDefects(systemDefects);
            } catch (e) {
                console.error("Error loading system defects", e);
                setAllSystemDefects([]);
            }

            let productGrades = [];
            let targetProductId = insp.product_id;

            if (!targetProductId && insp.product_name) {
                try {
                    const allProducts = await getProducts();
                    const inspName = String(insp.product_name || '').trim().toLowerCase();
                    const foundProduct = normalizeArray(allProducts).find(
                        (p) => String(p?.name || '').trim().toLowerCase() === inspName
                    );
                    if (foundProduct) {
                        targetProductId = foundProduct.id;
                    }
                } catch (e) {
                    console.error("Error fetching products to find ID", e);
                }
            }

            if (targetProductId) {
                // Normalize immediately upon receipt
                const fetchedGrades = await getGradesByProduct(targetProductId);
                productGrades = normalizeArray(fetchedGrades).map((g) => ({
                    ...g,
                    defects: normalizeArray(g.defects)
                }));
                console.log("Grades loaded for product:", productGrades);
            } else {
                console.warn("No product_id found for inspection", insp);
            }
            setGrades(productGrades);

            // Inicializar Estadísticas
            const initialStats = {};
            productGrades.forEach(g => {
                initialStats[g.id] = {
                    name: g.name,
                    total: 0,
                    defects: {}
                };
            });

            // Cargar resultados existentes
            const results = await getInspectionResults(id);
            results.forEach(r => {
                if (initialStats[r.grade_id]) {
                    initialStats[r.grade_id].total += r.pieces_count;
                    if (r.defect_id) {
                        initialStats[r.grade_id].defects[r.defect_id] = (initialStats[r.grade_id].defects[r.defect_id] || 0) + r.pieces_count;

                        // Ensure defect button exists even if grade came without mapped defects.
                        const gradeHit = productGrades.find((g) => String(g.id) === String(r.grade_id));
                        if (gradeHit) {
                            const hasDefect = normalizeArray(gradeHit.defects).some((d) => String(d.id) === String(r.defect_id));
                            if (!hasDefect) {
                                const fullDefect = systemDefects.find((d) => String(d.id) === String(r.defect_id));
                                if (fullDefect) {
                                    gradeHit.defects = [...normalizeArray(gradeHit.defects), fullDefect];
                                }
                            }
                        }
                    }
                }
            });

            setStats(initialStats);
            setGrades([...productGrades]);

        } catch (error) {
            console.error("Error loading context", error);
            alert("Error cargando la inspección: " + error.message);
        }
    };

    const handleAddDefectToGrade = (gradeId, defectIdRaw) => {
        if (!defectIdRaw) return;
        const defectId = String(defectIdRaw);

        const selected = allSystemDefects.find((d) => String(d.id) === defectId);
        if (!selected) return;

        setGrades((prev) => prev.map((g) => {
            if (String(g.id) !== String(gradeId)) return g;
            const existing = normalizeArray(g.defects);
            const already = existing.some((d) => String(d.id) === defectId);
            if (already) return g;
            return { ...g, defects: [...existing, selected] };
        }));

        setAddingDefectFor(null);
    };

    const handleGrading = async (grade, defect = null) => {
        if (showFinishModal) return;

        // Actualización optimista de UI
        const newStats = { ...stats };
        
        const isBase = baseGrade && grade.id === baseGrade.id;
        
        if (defect) {
            // Caso: Agregando un DEFECTO
            if (!isBase) {
                // Si NO es el grado base, intentamos tomar una pieza de "Sin Defecto" de este mismo grado
                const totalDefects = Object.values(newStats[grade.id].defects || {}).reduce((a, b) => a + b, 0);
                const currentCleanPieces = Math.max(0, newStats[grade.id].total - totalDefects);
                
                if (currentCleanPieces > 0) {
                    // Solo incrementamos el defecto, el total del grado NO cambia (se canjea limpia por defecto)
                    newStats[grade.id].defects[defect.id] = (newStats[grade.id].defects[defect.id] || 0) + 1;
                } else {
                    // Si no tiene piezas limpias, tomamos una del Grado Base
                    if (baseGrade && baseGrade.id !== grade.id) {
                        newStats[baseGrade.id].total = Math.max(0, newStats[baseGrade.id].total - 1);
                    }
                    newStats[grade.id].total += 1;
                    newStats[grade.id].defects[defect.id] = (newStats[grade.id].defects[defect.id] || 0) + 1;
                }
            } else {
                // Es el grado base: solo incrementamos
                newStats[grade.id].total += 1;
                newStats[grade.id].defects[defect.id] = (newStats[grade.id].defects[defect.id] || 0) + 1;
            }
        } else {
            // Caso: Agregando una pieza "SIN DEFECTO" a este grado
            if (!isBase) {
                // Tomamos una del Base y la pasamos a este grado
                if (baseGrade) {
                    newStats[baseGrade.id].total = Math.max(0, newStats[baseGrade.id].total - 1);
                }
                newStats[grade.id].total += 1;
            } else {
                // Estamos en el Base: simplemente aumenta
                newStats[grade.id].total += 1;
            }
        }
        
        setStats(newStats);

        const currentTotal = Object.values(newStats).reduce((acc, curr) => acc + curr.total, 0);

        setCountLog(prev => [{
            time: new Date(),
            gradeName: grade.name,
            gradeId: grade.id,
            defectName: defect?.name || 'Aceptar (En Grado)',
            defectId: defect?.id || null,
            id: Date.now()
        }, ...prev].slice(0, 50));

        // Restablecer selección si se eligió defecto
        if (defect) {
            setSelectedGrade(null);
            setSearchTerm('');
        }

        // Verificar finalización
        if (inspection && currentTotal >= inspection.pieces_inspected) {
            setShowFinishModal(true);
        }
    };

    const handleSaveInspection = async (silent = false) => {
        try {
            if (!grades || grades.length === 0) {
                throw new Error('No se cargaron los grados del producto.');
            }

            const resultsToSync = [];
            Object.keys(stats).forEach(gradeIdStr => {
                const gradeId = parseInt(gradeIdStr);
                const stat = stats[gradeId];
                const totalDefects = Object.values(stat.defects).reduce((a, b) => a + b, 0);
                const cleanCount = Math.max(0, stat.total - totalDefects);

                if (cleanCount > 0) {
                    resultsToSync.push({
                        grade_id: gradeId,
                        defect_id: null,
                        pieces_count: cleanCount
                    });
                }

                Object.keys(stat.defects).forEach(defectIdStr => {
                    const defectId = parseInt(defectIdStr);
                    const count = stat.defects[defectId];
                    if (count > 0) {
                        resultsToSync.push({
                            grade_id: gradeId,
                            defect_id: defectId,
                            pieces_count: count
                        });
                    }
                });
            });

            if (resultsToSync.length === 0) {
                throw new Error('La inspeccion no tiene detalle capturado para guardar.');
            }

            await syncInspectionResults(id, resultsToSync);
            console.log("Guardado exitoso");
            if (!silent) alert("Inspección guardada correctamente.");
            return true;
        } catch (error) {
            console.error("Save error", error);
            alert("Error al guardar la inspección: " + error.message);
            return false;
        }
    };

    const handleFinish = async () => {
        try {
            console.log("Finalizando...");
            if (!baseGrade) {
                throw new Error('No se encontro grado base para autocompletar la inspeccion.');
            }

            // Lógica de autocompletado
            if (autoFill && baseGrade) {
                const remaining = Math.max(0, inspection.pieces_inspected - totalInspected);
                if (remaining > 0) {
                    // Actualizamos memoria local de estadísticas antes de generar el payload
                    // Ojo: setStats es async, así que manipulamos stats directamente para el payload final
                    stats[baseGrade.id].total += remaining;
                    console.log(`Autocompletando ${remaining} piezas a ${baseGrade.name}`);
                }
            }

            // Guardar
            const success = await handleSaveInspection(true); // Silent save
            if (success) {
                // Opcional: Marcar como finalizada en objeto local si hubiera estado
                alert("Inspección finalizada exitosamente.");
                navigate('/');
            }
        } catch (e) {
            console.error("Error al finalizar", e);
            alert("Error crítico al finalizar: " + e.message);
        }
    };

    const remainingPieces = inspection ? Math.max(0, inspection.pieces_inspected - totalInspected) : 0;

    const handleUndo = async () => {
        if (showFinishModal) setShowFinishModal(false);

        const lastAction = countLog[0];
        if (!lastAction) return;

        const newStats = { ...stats };
        if (newStats[lastAction.gradeId]) {
            newStats[lastAction.gradeId].total = Math.max(0, newStats[lastAction.gradeId].total - 1);
            if (lastAction.defectId) {
                newStats[lastAction.gradeId].defects[lastAction.defectId] = Math.max(0, (newStats[lastAction.gradeId].defects[lastAction.defectId] || 0) - 1);
            }
        }
        setStats(newStats);
        setCountLog(prev => prev.slice(1));
    };

    const baseGrade = grades.length > 0 ? grades[0] : null;

    const downgradeGrades = grades
        .slice(1)
        .map(grade => {
            if (!searchTerm) return grade;
            const gradeMatches = grade.name.toLowerCase().includes(searchTerm.toLowerCase());
            const defectsArray = normalizeArray(grade.defects);
            const matchingDefects = defectsArray.filter(d =>
                d.name.toLowerCase().includes(searchTerm.toLowerCase())
            );

            if (gradeMatches) return { ...grade, defects: defectsArray };
            if (matchingDefects.length > 0) return { ...grade, defects: matchingDefects };
            return null;
        })
        .filter(Boolean);


    if (!inspection) return <div className="ga-page u-center u-muted">Cargando contexto de inspección...</div>;

    // --- RENDER HELPERS ---

    // Mobile Header Component
    const renderMobileHeader = () => (
        <div style={{ background: 'var(--ga-surface)', borderBottom: '1px solid var(--ga-border)', padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                    <h2 className="ga-card__title" style={{ color: 'var(--ga-primary)', fontSize: '1rem', margin: 0 }}>
                        {inspection.product_name}
                    </h2>
                    <span className="u-muted" style={{ fontSize: '0.75rem' }}>Lote: {inspection.lot || 'N/A'}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="u-muted" style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>AVANCE</div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', lineHeight: 1 }}>
                        <span style={{ color: 'var(--ga-primary)' }}>{totalInspected}</span>
                        <span style={{ color: '#aaa', fontSize: '0.8rem' }}> / {inspection.pieces_inspected}</span>
                    </div>
                </div>
            </div>
            {/* Progress Bar */}
            <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                    width: `${Math.min(100, (totalInspected / inspection.pieces_inspected) * 100)}%`,
                    height: '100%',
                    background: 'var(--ga-success)',
                    transition: 'width 0.5s'
                }} />
            </div>
        </div>
    );

    return (
        // IMPORTANT: We use height: calc(100vh - 64px) because Layout adds padding top 64px
        // But Layout structure adds 'ga-page' wrapper. We need to be careful.
        // Let's assume this component fills the available space.
        <div className="ga-app" style={{
            height: '100%', // Fills ga-page
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            overflow: 'hidden'
        }}>

            <AnimatePresence>
                {showFinishModal && (
                    <div className="ga-modal-backdrop" style={{ zIndex: 50 }}>
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
                                <h2 className="ga-card__title" style={{ fontSize: '2rem' }}>¡Completado!</h2>
                            </div>

                            <div className="ga-modal__content u-center">
                                <p className="u-muted u-mb-4" style={{ fontSize: '1.25rem' }}>
                                    Objetivo alcanzado: <span className="u-bold" style={{ color: 'var(--ga-success)' }}>{inspection.pieces_inspected}</span> piezas.
                                </p>

                                <div className="ga-card" style={{ textAlign: 'left', maxHeight: '200px', overflowY: 'auto' }}>
                                    <div className="ga-card__header u-bold u-muted" style={{ fontSize: '0.875rem' }}>RESUMEN</div>
                                    <div className="ga-card__body">
                                        {Object.values(stats).filter(s => s.total > 0).map((s, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                                                <span>{s.name}</span>
                                                <span className="u-bold">{s.total}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {remainingPieces > 0 && baseGrade && (
                                    <div className="ga-alert ga-alert--info u-mt-4" style={{ textAlign: 'left' }}>
                                        <label style={{ display: 'flex', gap: '0.75rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={autoFill}
                                                onChange={e => setAutoFill(e.target.checked)}
                                                style={{ width: '20px', height: '20px' }}
                                            />
                                            <div>
                                                <div className="u-bold">Completar Automáticamente</div>
                                                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                                                    Asignar {remainingPieces} restantes a {baseGrade.name}
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="ga-modal__footer" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                                <button onClick={handleFinish} className="ga-btn ga-btn--primary ga-btn--lg" style={{ width: '100%', justifyContent: 'center' }}>
                                    Confirmar y Finalizar
                                </button>
                                <button onClick={() => setShowFinishModal(false)} className="ga-btn ga-btn--outline" style={{ width: '100%', justifyContent: 'center' }}>
                                    Volver / Corregir
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Sidebar (Desktop Only) */}
            {!isMobile && (
                <div className="ga-sidebar" style={{ width: '300px', borderRight: '1px solid var(--ga-border)', background: 'var(--ga-surface)' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--ga-border)' }}>
                        <h2 className="ga-card__title u-truncate" title={inspection.product_name} style={{ color: 'var(--ga-primary)', fontSize: '1.25rem' }}>
                            {inspection.product_name}
                        </h2>
                        <p className="u-muted" style={{ fontSize: '0.875rem' }}>Lote: {inspection.lot || 'N/A'}</p>

                        <div className="ga-card u-mt-4" style={{ background: 'var(--ga-bg)', border: 'none' }}>
                            <div style={{ padding: '1rem', textAlign: 'center' }}>
                                <div className="u-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Avance</div>
                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', lineHeight: 1 }}>
                                    {totalInspected}
                                </div>
                                <div className="u-muted" style={{ fontSize: '0.875rem' }}>de {inspection.pieces_inspected}</div>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${Math.min(100, (totalInspected / inspection.pieces_inspected) * 100)}%`,
                                    height: '100%',
                                    background: 'var(--ga-success)',
                                    transition: 'width 0.5s'
                                }} />
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                        <h3 className="u-bold u-muted u-mb-2" style={{ fontSize: '0.75rem' }}>RESUMEN</h3>
                        <div className="ga-stack">
                            {normalizeArray(grades).map(g => (
                                <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'var(--ga-bg)', borderRadius: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: g.grade_rank === 1 ? 'var(--ga-success)' : g.grade_rank === 2 ? 'var(--ga-warning)' : 'var(--ga-danger)' }} />
                                        <span style={{ fontSize: '0.875rem' }}>{g.name}</span>
                                    </div>
                                    <span className="u-bold">{stats[g.id]?.total || 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ padding: '1rem', borderTop: '1px solid var(--ga-border)' }}>
                        <button onClick={handleSaveInspection} className="ga-btn ga-btn--outline" style={{ width: '100%', justifyContent: 'center' }}>
                            <Save size={16} /> Guardar Progreso
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--ga-bg)', height: '100%', overflow: 'hidden' }}>

                {/* Mobile Header */}
                {isMobile && renderMobileHeader()}

                {/* Topbar Actions */}
                <div className="ga-topbar" style={{ background: 'var(--ga-surface)', borderBottom: '1px solid var(--ga-border)', padding: '0.5rem 1rem' }}>

                    {/* Simplified / Compact Topbar for Mobile */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                        <button onClick={() => navigate('/')} className="ga-btn ga-btn--icon"><Home size={20} /></button>

                        <div style={{ flex: 1, position: 'relative' }}>
                            <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ga-muted)' }} size={16} />
                            <input
                                type="text"
                                placeholder={isMobile ? "Buscar..." : "Buscar defecto..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="ga-control"
                                style={{ paddingLeft: '2.2rem', borderRadius: '8px', border: '1px solid var(--ga-border)', width: '100%', fontSize: '0.9rem' }}
                            />
                        </div>
                    </div>

                    <div className="u-flex u-gap-2" style={{ marginLeft: '0.5rem' }}>
                        {countLog.length > 0 && (
                            <button onClick={handleUndo} className="ga-btn ga-btn--outline" title="Deshacer" style={{ padding: isMobile ? '0.5rem' : undefined }}>
                                <RotateCcw size={18} /> {isMobile ? '' : 'Deshacer'}
                            </button>
                        )}
                        <button onClick={() => setShowFinishModal(true)} className="ga-btn ga-btn--primary" style={{ padding: isMobile ? '0.5rem 0.75rem' : undefined }}>
                            {isMobile ? 'Fin' : 'Finalizar'}
                        </button>
                    </div>
                </div>

                {/* Grid de Clasificación Updated */}
                <div style={{
                    flex: 1,
                    display: isMobile ? 'flex' : 'grid',
                    flexDirection: isMobile ? 'column' : undefined,
                    gridTemplateColumns: isMobile ? undefined : '1fr 2fr',
                    gap: isMobile ? '0' : '2rem',
                    overflow: 'hidden', // Contain scrolling
                    padding: isMobile ? 0 : '1.5rem',
                    height: isMobile ? '100%' : 'auto' // Force height usage
                }}>

                    {/* MOVILES: El botón de "Base Grade" (Aceptar) va AL FINAL (Abajo) */}

                    {/* Columna 2: Grados Secundarios y Defectos (Arriba en Mobile/Derecha en Desktop) */}
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: '1rem',
                        overflowY: 'auto',
                        order: isMobile ? 1 : 2,
                        flex: isMobile ? 1 : undefined, // Take all REMAINING space in mobile (Flex 1 is critical here)
                        padding: isMobile ? '1rem' : 0,
                        backgroundColor: 'var(--ga-bg)' // Ensure visible bg
                    }}>
                        {normalizeArray(downgradeGrades).map(grade => {
                            const defects = normalizeArray(grade.defects);
                            const availableDefects = normalizeArray(allSystemDefects).filter((d) => !defects.some((gd) => String(gd.id) === String(d.id)));
                            return (
                                <div key={grade.id} className="ga-card" style={{ border: '1px solid var(--ga-border)' }}>
                                    <div className="ga-card__header" style={{ background: 'var(--ga-surface)', borderBottom: '1px solid var(--ga-border)', padding: '0.5rem 1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div className="ga-badge" style={{
                                                background: grade.grade_rank === 2 ? 'var(--ga-warning)' : 'var(--ga-danger)',
                                                color: 'white', width: '28px', height: '28px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {grade.grade_rank}
                                            </div>
                                            <h3 className="ga-card__title" style={{ fontSize: '1.1rem' }}>{grade.name}</h3>
                                        </div>
                                    </div>
                                    <div className="ga-card__body" style={{ padding: '0.75rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '100px' : '140px'}, 1fr))`, gap: '0.5rem' }}>
                                            {/* Button for Clean Piece (Sin Defecto) within this grade */}
                                            <motion.button
                                                whileHover={{ scale: 1.02, backgroundColor: '#f0f9ff' }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => handleGrading(grade, null)}
                                                style={{
                                                    padding: '0.75rem 0.25rem',
                                                    borderRadius: '6px',
                                                    border: '1px solid #bae6fd',
                                                    background: '#f0f9ff',
                                                    cursor: 'pointer',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                                                    minHeight: isMobile ? '70px' : '80px', justifyContent: 'center'
                                                }}
                                            >
                                                <span style={{ fontWeight: 'bold', fontSize: isMobile ? '0.8rem' : '0.9rem', color: '#0369a1', textAlign: 'center' }}>
                                                    ACEPTAR (EN GRADO)
                                                </span>
                                            </motion.button>
                                            
                                            {defects.map(defect => (
                                                <motion.button
                                                    key={defect.id}
                                                    whileHover={{ scale: 1.02, backgroundColor: 'var(--ga-surface-hover)' }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleGrading(grade, defect)}
                                                    style={{
                                                        padding: '0.75rem 0.25rem',
                                                        borderRadius: '6px',
                                                        border: '1px solid var(--ga-border)',
                                                        background: 'white',
                                                        cursor: 'pointer',
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                                                        minHeight: isMobile ? '70px' : '80px', justifyContent: 'center'
                                                    }}
                                                >
                                                    <span style={{ fontWeight: '500', fontSize: isMobile ? '0.8rem' : '0.9rem', textAlign: 'center', lineHeight: 1.2 }}>{defect.name}</span>
                                                </motion.button>
                                            ))}
                                        </div>

                                        <div style={{ marginTop: '0.75rem', borderTop: '1px dashed var(--ga-border)', paddingTop: '0.75rem' }}>
                                            {addingDefectFor === grade.id ? (
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <select
                                                        className="ga-control"
                                                        autoFocus
                                                        defaultValue=""
                                                        onChange={(e) => handleAddDefectToGrade(grade.id, e.target.value)}
                                                        onBlur={() => setTimeout(() => setAddingDefectFor(null), 200)}
                                                    >
                                                        <option value="">Seleccionar defecto...</option>
                                                        {availableDefects.map((d) => (
                                                            <option key={d.id} value={d.id}>{d.name}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        className="ga-btn ga-btn--outline"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setAddingDefectFor(null);
                                                        }}
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    className="ga-btn ga-btn--outline ga-btn--sm"
                                                    onClick={() => setAddingDefectFor(grade.id)}
                                                    style={{ width: '100%', justifyContent: 'center' }}
                                                >
                                                    + Agregar Defecto Rápido
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        {/* Space Buffer at bottom of scroll to avoid tight edge */}
                        <div style={{ height: '20px' }} />
                    </div>

                </div>
            </div>
        </div>
    );
};
