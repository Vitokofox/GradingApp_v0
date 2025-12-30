import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInspection, getGradesByProduct, addInspectionResult, getProducts, getInspectionResults, syncInspectionResults } from '../api'; // Asegurar que getInspectionResults esté importado
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, Activity, Database, ChevronRight, X, RotateCcw, Home, Search, Save } from 'lucide-react';

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

    // Estado derivado
    const totalInspected = Object.values(stats).reduce((acc, curr) => acc + curr.total, 0);

    useEffect(() => {
        loadContext();
    }, [id]);

    const loadContext = async () => {
        try {
            const insp = await getInspection(id);
            setInspection(insp);

            // Obtener grados para el producto
            let productGrades = [];

            // Intentar product_id explícito si está disponible, de lo contrario buscar por nombre
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
                    // Si r tiene pieces_count, usarlo. Si no, asumir 1? 
                    // La nueva lógica de sincronización usa pieces_count.
                    // Pero si es granular (una fila por pieza)...
                    // El esquema tiene pieces_count.

                    initialStats[r.grade_id].total += r.pieces_count;

                    if (r.defect_id) {
                        initialStats[r.grade_id].defects[r.defect_id] = (initialStats[r.grade_id].defects[r.defect_id] || 0) + r.pieces_count;
                    }
                }
            });

            setStats(initialStats);

        } catch (error) {
            console.error("Error loading context", error);
        }
    };

    const handleGrading = async (grade, defect = null) => {
        if (showFinishModal) return;

        // Actualización optimista de UI
        const newStats = { ...stats };
        newStats[grade.id].total += 1;
        if (defect) {
            newStats[grade.id].defects[defect.id] = (newStats[grade.id].defects[defect.id] || 0) + 1;
        }
        setStats(newStats);

        const currentTotal = Object.values(newStats).reduce((acc, curr) => acc + curr.total, 0);

        setCountLog(prev => [{
            time: new Date(),
            gradeName: grade.name,
            gradeId: grade.id,
            defectName: defect?.name || 'Clean',
            defectId: defect?.id || null,
            id: Date.now()
        }, ...prev].slice(0, 50));

        // Llamada API ELIMINADA por requerimiento de guardado por lotes
        /*
        try {
            await addInspectionResult(id, grade.id, defect ? defect.id : null, 1);
        } catch (error) {
            console.error("Sync error", error);
        }
        */

        // Restablecer selección si se eligió defecto (aunque el modo en línea no lo usa mucho ahora)

        // Restablecer selección si se eligió defecto (aunque el modo en línea no lo usa mucho ahora)
        if (defect) {
            setSelectedGrade(null);
            setSearchTerm(''); // Clear search after selection
        }

        // Verificar finalización
        if (inspection && currentTotal >= inspection.pieces_inspected) {
            setShowFinishModal(true);
        }
    };

    const handleSaveInspection = async () => {
        const resultsToSync = [];

        // Iterar a través de estadísticas para construir carga útil
        Object.keys(stats).forEach(gradeIdStr => {
            const gradeId = parseInt(gradeIdStr);
            const stat = stats[gradeId];

            // Total incluye defectos + limpio.
            // Pero API necesita granular: grado + defecto + conteo.
            // Si defecto es nulo, significa "Grado base" (limpio).
            // Calcular conteo limpio: Total - Suma(Defectos)
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

        try {
            await syncInspectionResults(id, resultsToSync);
            // Opcional: Mostrar notificación
            alert("Inspección guardada correctamente.");
        } catch (error) {
            console.error("Save error", error);
            alert("Error al guardar la inspección.");
        }
    };

    const handleFinish = async () => {
        // Lógica de autocompletado impacta estadísticas, así que ejecutar primero si se necesita localmente? 
        // O mejor: actualizar estadísticas locales basadas en autocompletado y luego guardar.

        if (autoFill && baseGrade) {
            const remaining = Math.max(0, inspection.pieces_inspected - totalInspected);
            if (remaining > 0) {
                // Actualizar estadísticas locales para grado base limpio
                const newStats = { ...stats };
                newStats[baseGrade.id].total += remaining;
                setStats(newStats);

                // Necesitamos esperar actualización de estado o empujar manualmente a lista de sincronización.
                // Dado que setState es asíncrono, agreguemos manualmente a lista de sincronización en handleSave si movimos la lógica allí,
                // pero es más simple llamar a sync con números ajustados manualmente o asumir que el usuario hizo clic en la casilla 
                // y forzamos el guardado ahora.

                // Solo actualicemos el backend 
                try {
                    await addInspectionResult(id, baseGrade.id, null, remaining);
                } catch (e) {
                    console.error("Autofill error", e);
                }
            }
        }

        // Activar guardado completo por si acaso (aunque autocompletado usa addInspectionResult directo)
        // Idealmente deberíamos confiar en UN método.
        // Si usamos guardado por lotes, autocompletado debería solo modificar estado local y luego guardamos por lotes.
        // Por ahora, mantengamos simple: Guardar todo.
        await handleSaveInspection();
        navigate('/');
    };

    const remainingPieces = inspection ? Math.max(0, inspection.pieces_inspected - totalInspected) : 0;

    const handleUndo = async () => {
        if (showFinishModal) setShowFinishModal(false); // Permitir deshacer el estado finalizado

        const lastAction = countLog[0];
        if (!lastAction) return;

        // 1. Revertir Estadísticas UI
        const newStats = { ...stats };
        if (newStats[lastAction.gradeId]) {
            newStats[lastAction.gradeId].total = Math.max(0, newStats[lastAction.gradeId].total - 1);
            if (lastAction.defectId) {
                newStats[lastAction.gradeId].defects[lastAction.defectId] = Math.max(0, (newStats[lastAction.gradeId].defects[lastAction.defectId] || 0) - 1);
            }
        }
        setStats(newStats);

        // 2. Actualizar Registro
        setCountLog(prev => prev.slice(1));

        // 3. Revertir API - ELIMINADO ya que no sincronizamos en acción más
        /*
        try {
            await addInspectionResult(id, lastAction.gradeId, lastAction.defectId, -1);
        } catch (error) {
            console.error("Undo error", error);
        }
        */
    };

    // El "Grado Base" (Rango 1 - usualmente mejor) a menudo no necesita selección de defecto, es solo "Bueno"
    // MEJORADO: Tomar primer ítem como base, sin importar valor de rango explícito
    const baseGrade = grades.length > 0 ? grades[0] : null;

    // Lógica de filtro
    // MEJORADO: Tomar todos los grados restantes como degradaciones
    const downgradeGrades = grades
        .slice(1)
        .map(grade => {
            // Si búsqueda está vacía, retornar grado original
            if (!searchTerm) return grade;

            // Verificar si nombre de grado coincide
            const gradeMatches = grade.name.toLowerCase().includes(searchTerm.toLowerCase());

            // Verificar defectos coincidentes
            const matchingDefects = grade.defects?.filter(d =>
                d.name.toLowerCase().includes(searchTerm.toLowerCase())
            ) || [];

            // Si grado coincide, mostrar todos los defectos (o quizás solo coincidentes? mostremos todos si grado coincide, sino solo defectos coincidentes)
            // Mejor UX: Mostrar solo ítems coincidentes a menos que el contenedor (grado) sea explícitamente buscado?
            // Vamos con: Filtrar lista de defectos. Si lista de defectos está vacía Y grado no coincide, retornar nulo.

            if (gradeMatches) {
                return grade; // Mostrar todo
            }

            if (matchingDefects.length > 0) {
                return { ...grade, defects: matchingDefects }; // Mostrar defectos filtrados
            }

            return null; // Ocultar grado completamente
        })
        .filter(Boolean); // Eliminar nulos


    if (!inspection) return <div className="ga-page u-center u-muted">Cargando contexto de inspección...</div>;

    return (
        <div className="ga-app" style={{ height: '100vh', overflow: 'hidden', flexDirection: 'row' }}>

            {/* Modal de Finalización */}
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

            {/* Sidebar (Ahora usa ga-sidebar) */}
            <div className="ga-sidebar" style={{ width: '320px', borderRight: '1px solid var(--ga-border)', background: 'var(--ga-surface)' }}>
                <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--ga-border)' }}>
                    <h2 className="ga-card__title u-truncate" title={inspection.product_name} style={{ color: 'var(--ga-primary)' }}>
                        {inspection.product_name}
                    </h2>
                    <p className="u-muted" style={{ fontSize: '0.875rem' }}>Lote: {inspection.lot || 'N/A'}</p>

                    <div className="ga-card u-mt-4" style={{ background: 'var(--ga-bg)', border: 'none' }}>
                        <div className="ga-card__body" style={{ padding: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                                <span className="u-bold u-muted" style={{ fontSize: '0.75rem' }}>AVANCE</span>
                                <span className="u-bold" style={{ fontSize: '1.25rem' }}>
                                    {totalInspected} <span className="u-muted" style={{ fontSize: '0.875rem' }}>/ {inspection.pieces_inspected}</span>
                                </span>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${Math.min(100, (totalInspected / inspection.pieces_inspected) * 100)}%`,
                                    height: '100%',
                                    background: 'var(--ga-success)',
                                    transition: 'width 0.5s'
                                }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem' }}>
                    <div>
                        <h3 className="u-bold u-muted u-mb-2" style={{ fontSize: '0.75rem' }}>RESUMEN TIEMPO REAL</h3>
                        <div className="ga-stack">
                            {grades.map(g => (
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

                    <div>
                        <h3 className="u-bold u-muted u-mb-2" style={{ fontSize: '0.75rem' }}>ÚLTIMOS EVENTOS</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <AnimatePresence>
                                {countLog.map((log, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        style={{ fontSize: '0.75rem', padding: '4px 8px', borderLeft: '2px solid var(--ga-border)' }}
                                    >
                                        <span className="u-bold">{log.gradeName}</span>
                                        {log.defectName !== 'Clean' && <span style={{ color: 'var(--ga-danger)', marginLeft: '4px' }}>({log.defectName})</span>}
                                        <span style={{ float: 'right', opacity: 0.5 }}>{log.time.toLocaleTimeString()}</span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--ga-bg)' }}>
                {/* Topbar Personalizada */}
                <div className="ga-topbar" style={{ background: 'var(--ga-surface)', color: 'var(--ga-text)', borderBottom: '1px solid var(--ga-border)', padding: '0.5rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Activity className="u-muted" />
                        <h1 className="ga-topbar-title" style={{ fontSize: '1.125rem' }}>Interfaz de Clasificación</h1>
                    </div>

                    <div style={{ flex: 1, maxWidth: '400px', margin: '0 2rem', position: 'relative' }}>
                        <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ga-muted)' }} size={16} />
                        <input
                            type="text"
                            placeholder="Buscar defecto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="ga-control"
                            style={{ paddingLeft: '2.5rem', borderRadius: '99px' }}
                            autoFocus
                        />
                    </div>

                    <div className="u-flex u-gap-2">
                        {countLog.length > 0 && (
                            <button onClick={handleUndo} className="ga-btn ga-btn--outline ga-btn--sm" title="Deshacer último">
                                <RotateCcw size={16} /> <span style={{ marginLeft: '4px' }}>Deshacer</span>
                            </button>
                        )}
                        <button onClick={handleSaveInspection} className="ga-btn ga-btn--primary ga-btn--sm">
                            <Save size={16} /> <span style={{ marginLeft: '4px' }}>Guardar</span>
                        </button>
                        <button onClick={() => setShowFinishModal(true)} className="ga-btn ga-btn--outline ga-btn--sm">
                            Pausar / Finalizar
                        </button>
                    </div>
                </div>

                {/* Grid de Clasificación */}
                <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                    <div className="ga-grid" style={{ gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem', height: '100%' }}>

                        {/* Columna 1: Principal (OK) */}
                        {baseGrade && !selectedGrade && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleGrading(baseGrade)}
                                    className="ga-card"
                                    style={{
                                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        background: 'linear-gradient(135deg, var(--ga-success) 0%, #1B5E20 100%)',
                                        color: 'white', border: 'none', cursor: 'pointer'
                                    }}
                                >
                                    <CheckCircle size={80} style={{ marginBottom: '1rem', opacity: 0.9 }} />
                                    <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{baseGrade.name}</span>
                                    <span style={{ fontSize: '1.25rem', opacity: 0.9 }}>Sin Defectos</span>
                                </motion.button>
                            </div>
                        )}

                        {/* Columna 2: Defectos */}
                        <div className="ga-stack" style={{ height: '100%', overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {downgradeGrades.map(grade => (
                                <div key={grade.id} className="ga-card">
                                    <div className="ga-card__header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.02)' }}>
                                        <div className="ga-badge" style={{
                                            background: grade.grade_rank === 2 ? 'var(--ga-warning)' : 'var(--ga-danger)',
                                            color: 'white', border: 'none', width: '32px', height: '32px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {grade.grade_rank}
                                        </div>
                                        <h3 className="ga-card__title">{grade.name}</h3>
                                    </div>

                                    <div className="ga-card__body">
                                        {grade.defects && grade.defects.length > 0 ? (
                                            <div className="ga-grid ga-grid--3" style={{ gap: '0.75rem' }}>
                                                {grade.defects.map(defect => (
                                                    <motion.button
                                                        key={defect.id}
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => handleGrading(grade, defect)}
                                                        className="ga-btn ga-btn--outline"
                                                        style={{
                                                            height: 'auto', minHeight: '60px', whiteSpace: 'normal',
                                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                                                            background: 'var(--ga-surface)', color: 'var(--ga-text)', borderColor: 'var(--ga-border)'
                                                        }}
                                                    >
                                                        {defect.name}
                                                    </motion.button>
                                                ))}
                                            </div>
                                        ) : (
                                            <motion.button
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => handleGrading(grade)}
                                                className="ga-btn ga-btn--outline"
                                                style={{ width: '100%', padding: '1.5rem', justifyContent: 'center', fontWeight: 'bold' }}
                                            >
                                                Confirmar {grade.name}
                                            </motion.button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
