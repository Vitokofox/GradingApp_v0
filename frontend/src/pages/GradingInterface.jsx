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


    if (!inspection) return <div className="text-white p-8">Cargando contexto de inspección...</div>;

    return (
        <div className="flex h-screen bg-slate-900 text-white overflow-hidden relative">
            {/* Modal de Finalización */}
            <AnimatePresence>
                {showFinishModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-slate-800 border border-emerald-500/50 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl shadow-emerald-900/50"
                        >
                            <div className="mx-auto w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 ring-4 ring-emerald-500/10">
                                <CheckCircle className="w-12 h-12 text-emerald-400" />
                            </div>
                            <h2 className="text-4xl font-bold text-white mb-2">¡Completado!</h2>
                            <p className="text-slate-300 mb-8 text-lg">Has alcanzado el objetivo de <span className="text-emerald-400 font-bold">{inspection.pieces_inspected}</span> piezas.</p>

                            <div className="bg-slate-900/50 p-4 rounded-xl mb-6 text-left">
                                <h3 className="text-sm font-bold text-slate-400 uppercase mb-2">Resumen Final</h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                    {Object.values(stats).filter(s => s.total > 0).map((s, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                            <span className="text-slate-300">{s.name}</span>
                                            <span className="font-mono font-bold text-white">{s.total}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-slate-700 mt-3 pt-2 flex justify-between text-sm font-bold">
                                    <span className="text-slate-400">Total Inspeccionado</span>
                                    <span className="text-white">{totalInspected} / {inspection.pieces_inspected}</span>
                                </div>

                                {remainingPieces > 0 && baseGrade && (
                                    <div className="mt-4 bg-emerald-900/30 border border-emerald-500/30 p-3 rounded-lg">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={autoFill}
                                                onChange={e => setAutoFill(e.target.checked)}
                                                className="w-5 h-5 text-emerald-500 rounded focus:ring-emerald-500 bg-slate-800 border-slate-600"
                                            />
                                            <div className="text-left">
                                                <div className="text-sm font-bold text-emerald-200">Completar Automáticamente</div>
                                                <div className="text-xs text-emerald-400/80">
                                                    Asignar {remainingPieces} piezas restantes a <span className="font-bold">{baseGrade.name}</span>
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={handleFinish}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                                >
                                    <CheckCircle className="w-6 h-6" /> Confirmar y Finalizar
                                </button>
                                <button
                                    onClick={() => setShowFinishModal(false)} // Fix: Allow closing modal to continue
                                    className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <RotateCcw className="w-6 h-6" /> Volver / Corregir
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Panel Izquierdo: Contexto y Estadísticas */}
            <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col">
                <div className="p-6 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-emerald-400 mb-1">{inspection.product_name}</h2>
                    <p className="text-slate-400 text-sm mb-4">Lote: {inspection.lot || 'N/A'}</p>

                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-slate-400 text-xs uppercase font-bold">Avance</span>
                            <span className="text-2xl font-bold text-white">{totalInspected} <span className="text-sm text-slate-500">/ {inspection.pieces_inspected}</span></span>
                        </div>
                        <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                                className="bg-emerald-500 h-full transition-all duration-500"
                                style={{ width: `${Math.min(100, (totalInspected / inspection.pieces_inspected) * 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase">Resumen en Tiempo Real</h3>
                    {grades.map(g => (
                        <div key={g.id} className="bg-slate-900/30 p-3 rounded border border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${g.grade_rank === 1 ? 'bg-emerald-500' : g.grade_rank === 2 ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                                <span className="font-medium text-sm">{g.name}</span>
                            </div>
                            <span className="font-mono font-bold text-lg">{stats[g.id]?.total || 0}</span>
                        </div>
                    ))}

                    <div className="mt-8">
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Últimos Eventos</h3>
                        <div className="space-y-1">
                            <AnimatePresence>
                                {countLog.map((log, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="text-xs py-1 px-2 border-l-2 border-slate-600 text-slate-400"
                                    >
                                        <span className="text-slate-300 font-semibold">{log.gradeName}</span>
                                        {log.defectName !== 'Clean' && <span className="text-red-400 ml-1">({log.defectName})</span>}
                                        <span className="float-right opacity-50">{log.time.toLocaleTimeString()}</span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            {/* Panel Principal: Acciones de Clasificación */}
            <div className="flex-1 flex flex-col relative">
                {/* Encabezado */}
                <div className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/95 backdrop-blur z-10">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="w-6 h-6 text-purple-500" />
                        Interfaz de Clasificación
                    </h1>

                    {/* Barra de Búsqueda */}
                    <div className="flex-1 max-w-md mx-8 relative">
                        <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar defecto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-full py-2 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3">
                        {countLog.length > 0 && (
                            <button
                                onClick={handleUndo}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" /> Deshacer
                            </button>
                        )}
                        <button
                            onClick={handleSaveInspection}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" /> Guardar
                        </button>
                        <button
                            onClick={() => setShowFinishModal(true)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-semibold transition-colors"
                        >
                            Pausar / Finalizar
                        </button>
                    </div>
                </div>


                {/* Área de Acción */}
                <div className="flex-1 p-8 grid grid-cols-2 gap-8 relative min-h-0">
                    {/* Columna 1: El Botón "Perfecto" (Objetivo Grande) */}
                    {baseGrade && !selectedGrade && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleGrading(baseGrade)}
                            className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-3xl shadow-2xl flex flex-col items-center justify-center border-4 border-emerald-500/30 group"
                        >
                            <CheckCircle className="w-32 h-32 text-emerald-200 mb-4 drop-shadow-lg group-hover:scale-110 transition-transform" />
                            <span className="text-4xl font-bold text-white drop-shadow-md">{baseGrade.name}</span>
                            <span className="text-emerald-200 mt-2 text-lg">Sin Defectos</span>
                        </motion.button>
                    )}

                    {/* Columna 2: Los "Degradados" (Cascadas) - Defectos en Línea para Velocidad */}
                    <div className="grid grid-cols-1 gap-6 overflow-y-auto h-full pr-2 pb-10">
                        {downgradeGrades.map(grade => (
                            <div key={grade.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-col gap-4">
                                {/* Header */}
                                <div className="flex items-center gap-3 border-b border-slate-700/50 pb-2">
                                    <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-lg text-slate-300">
                                        {grade.grade_rank}
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-200">{grade.name}</h3>
                                </div>

                                {/* Acciones */}
                                {grade.defects && grade.defects.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-3">
                                        {grade.defects.map(defect => (
                                            <motion.button
                                                key={defect.id}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => handleGrading(grade, defect)}
                                                className="bg-slate-900 border border-slate-700 hover:border-purple-500 hover:bg-slate-800 text-slate-300 py-3 rounded-xl text-sm font-bold transition-all shadow-sm flex flex-col items-center gap-1"
                                            >
                                                <span>{defect.name}</span>
                                            </motion.button>
                                        ))}
                                    </div>
                                ) : (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleGrading(grade)}
                                        className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-colors"
                                    >
                                        Confirmar {grade.name}
                                    </motion.button>
                                )}
                            </div>
                        ))}
                    </div>


                </div>
            </div>
        </div>
    );
};
