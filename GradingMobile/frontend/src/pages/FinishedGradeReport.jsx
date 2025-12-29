// Importacion de librerias y componentes necesarios
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInspection, getInspectionResults } from '../api';
import { motion } from 'framer-motion';
import { ArrowLeft, Printer, FileText, Calendar, User, MapPin, Box, Database, AlertTriangle } from 'lucide-react';

// Componente Principal: Reporte de Producto Terminado
// Estructura idéntica al reporte de línea, para mostrar inspecciones de 'finished_product'
export default function FinishedGradeReport() {
    const { id } = useParams(); // Obtiene el ID de la URL
    const navigate = useNavigate(); // Hook para navegación

    // Estados del componente (State)
    const [inspection, setInspection] = useState(null); // Almacena los datos generales de la inspección
    const [stats, setStats] = useState({ gradeSummary: [], defectsByGrade: {}, totalPieces: 0 }); // Almacena estadísticas calculadas

    // Efecto de carga inicial
    useEffect(() => {
        loadData();
    }, [id]);

    // Función: loadData (Cargar Datos)
    const loadData = async () => {
        try {
            const inspData = await getInspection(id);
            const resData = await getInspectionResults(id);
            setInspection(inspData);
            calculateStats(resData); // Procesa los datos una vez cargados
        } catch (error) {
            console.error("Error loading report data", error);
        }
    };

    // Función: calculateStats (Calcular Estadísticas)
    const calculateStats = (data) => {
        const total = data.reduce((acc, curr) => acc + curr.pieces_count, 0);

        // Resumen de Grados (Grade Summary)
        const gradeMap = {};
        const defectsByGradeMap = {};

        data.forEach(item => {
            const gName = item.grade?.name || 'Unknown';
            if (!gradeMap[gName]) gradeMap[gName] = 0;
            gradeMap[gName] += item.pieces_count;

            // Inicializar estructura para defectos por grado
            if (!defectsByGradeMap[gName]) {
                defectsByGradeMap[gName] = { total: 0, defects: {} };
            }
            defectsByGradeMap[gName].total += item.pieces_count;

            // Agrupar defectos dentro de este grado
            if (item.defect && item.defect.name) {
                const dName = item.defect.name;
                if (!defectsByGradeMap[gName].defects[dName]) {
                    defectsByGradeMap[gName].defects[dName] = 0;
                }
                defectsByGradeMap[gName].defects[dName] += item.pieces_count;
            }
        });

        const gradeSummary = Object.keys(gradeMap).map(name => ({
            name,
            count: gradeMap[name],
            percentage: total ? (gradeMap[name] / total) * 100 : 0
        })).sort((a, b) => b.count - a.count); // Ordena descendente por cantidad

        setStats({ gradeSummary, defectsByGrade: defectsByGradeMap, totalPieces: total });
    };

    if (!inspection) return <div className="text-white p-8">Cargando reporte...</div>;

    // Renderizado UI (User Interface)
    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Acciones de Cabecera (Header Actions) */}
                <div className="flex justify-between items-center print:hidden">
                    <button
                        onClick={() => navigate('/inspections')}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" /> Volver al Historial
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-bold transition-colors"
                    >
                        <Printer className="w-5 h-5" /> Imprimir Reporte
                    </button>
                </div>

                {/* Contenido del Reporte (Report Content) */}
                <div className="bg-white text-slate-900 rounded-none shadow-xl overflow-hidden print:shadow-none print:w-full">

                    {/* Cabecera del Reporte (Report Header - Blue for Finished Product) */}
                    <div className="bg-blue-600 p-6 print:bg-blue-600 print:print-color-adjust-exact">
                        <div className="flex justify-between items-start">
                            <h1 className="text-2xl font-bold text-white uppercase tracking-tight">
                                Reporte de Producto Terminado N° {inspection.id}
                            </h1>
                            <div className="text-right text-blue-100 font-mono text-sm">
                                {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                            </div>
                        </div>
                    </div>

                    {/* Grilla de Metadatos (Meta Data Grid) */}
                    <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-8 border-b border-slate-200 text-sm">

                        <div className="space-y-1">
                            <div className="font-bold text-slate-500 text-xs uppercase">Fecha Inspección</div>
                            <div className="font-bold">{inspection.date}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-bold text-slate-500 text-xs uppercase">Piezas Insp.</div>
                            <div className="font-bold text-lg">{stats.totalPieces}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-bold text-slate-500 text-xs uppercase">Turno</div>
                            <div>{inspection.shift || 'N/A'}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-bold text-slate-500 text-xs uppercase">Jornada</div>
                            <div>{inspection.journey || 'N/A'}</div>
                        </div>

                        <div className="space-y-1">
                            <div className="font-bold text-slate-500 text-xs uppercase">Area</div>
                            <div>{inspection.area || 'Cepillado'}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-bold text-slate-500 text-xs uppercase">Origen</div>
                            <div>{inspection.origin || 'N/A'}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-bold text-slate-500 text-xs uppercase">Supervisor</div>
                            <div>{inspection.supervisor || 'N/A'}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-bold text-slate-500 text-xs uppercase">Responsable</div>
                            <div>{inspection.responsible || 'N/A'}</div>
                        </div>

                        <div className="space-y-1">
                            <div className="font-bold text-slate-500 text-xs uppercase">Producto</div>
                            <div className="font-bold text-purple-700">{inspection.product_name}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-bold text-slate-500 text-xs uppercase">Mercado</div>
                            <div>{inspection.market?.name || 'N/A'}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-bold text-slate-500 text-xs uppercase">Lote</div>
                            <div className="font-mono">{inspection.lot || 'N/A'}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-bold text-slate-500 text-xs uppercase">Terminación</div>
                            <div>{inspection.termination || 'S2S'}</div>
                        </div>

                        <div className="col-span-2 md:col-span-4 grid grid-cols-3 gap-4 bg-slate-50 p-3 rounded mt-2 border border-slate-100">
                            <div className="space-y-1">
                                <div className="font-bold text-slate-400 text-xs uppercase">Espesor</div>
                                <div>{inspection.thickness || '-'} mm</div>
                            </div>
                            <div className="space-y-1">
                                <div className="font-bold text-slate-400 text-xs uppercase">Ancho</div>
                                <div>{inspection.width || '-'} mm</div>
                            </div>
                            <div className="space-y-1">
                                <div className="font-bold text-slate-400 text-xs uppercase">Largo</div>
                                <div>{inspection.length || '-'} mm</div>
                            </div>
                        </div>
                    </div>

                    {/* Resumen General de Grados (Siempre visible primero) */}
                    <div className="p-6 break-inside-avoid">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            {/* Tabla Resumen de Grados */}
                            <div className="space-y-4">
                                <div className="bg-sky-600 text-white font-bold py-2 px-4 text-center uppercase text-sm rounded-t print:bg-sky-600 print:print-color-adjust-exact">
                                    Resumen General de Grados
                                </div>
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 border-b border-slate-300">
                                            <th className="py-2 px-3 text-left font-bold text-slate-600">Producto</th>
                                            <th className="py-2 px-3 text-center font-bold text-slate-600">Cant. Piezas</th>
                                            <th className="py-2 px-3 text-center font-bold text-slate-600">Porcentaje</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.gradeSummary.map((grade, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="py-2 px-3 font-medium">{grade.name}</td>
                                                <td className="py-2 px-3 text-center">{grade.count}</td>
                                                <td className="py-2 px-3 text-center font-bold text-slate-700">{grade.percentage.toFixed(2)}%</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-800 text-white font-bold print:bg-slate-800 print:print-color-adjust-exact">
                                            <td className="py-2 px-3">TOTAL</td>
                                            <td className="py-2 px-3 text-center">{stats.totalPieces}</td>
                                            <td className="py-2 px-3 text-center">100%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Gráfico de Grados (Visual) */}
                            <div className="bg-white border border-slate-200 rounded p-4 h-80 flex flex-col items-center justify-center print:h-64 print:border-none">
                                <h4 className="text-sm font-bold text-slate-600 uppercase text-center mb-6 w-full">Resumen de Grado (Gráfico)</h4>
                                <div className="flex-1 flex items-end justify-around gap-4 px-4 pb-6 w-full border-b border-slate-300 relative">
                                    {stats.gradeSummary.map((grade, idx) => (
                                        <div key={idx} className="flex flex-col items-center gap-2 w-16 h-full justify-end group relative">
                                            {/* Porcentaje siempre visible arriba de la barra */}
                                            <div className="text-xs font-bold text-slate-600 mb-1 absolute -top-5 w-full text-center">
                                                {grade.percentage.toFixed(0)}%
                                            </div>
                                            <div className="w-full bg-slate-50 rounded-t relative flex items-end h-full pt-6">
                                                <div
                                                    className={`w-full rounded-t transition-all duration-700 ease-out ${grade.name === 'RECHAZO' ? 'bg-red-600' : 'bg-green-600'} print:print-color-adjust-exact`}
                                                    style={{ height: `${grade.percentage}%` }}
                                                ></div>
                                            </div>
                                            {/* Etiqueta del nombre con espacio suficiente abajo */}
                                            <div className="absolute -bottom-6 w-full text-xs font-bold text-slate-700 text-center uppercase truncate" title={grade.name}>
                                                {grade.name}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tipificación por Grado (Iterativo) */}
                    <div className="p-6 pt-0 space-y-8">
                        {Object.entries(stats.defectsByGrade).map(([gradeName, gradeData]) => {
                            // Calcular resumen de defectos para este grado específico
                            const defectsList = Object.entries(gradeData.defects).map(([dName, count]) => ({
                                name: dName,
                                count,
                                percentage: gradeData.total ? (count / gradeData.total) * 100 : 0
                            })).sort((a, b) => b.count - a.count);

                            if (defectsList.length === 0) return null; // No mostrar si no hay defectos

                            return (
                                <div key={gradeName} className="break-inside-avoid border border-slate-200 rounded-lg overflow-hidden">
                                    {/* Cabecera del Grado */}
                                    <div className="bg-slate-100 p-3 border-b border-slate-200 flex justify-between items-center print:bg-slate-100 print:print-color-adjust-exact">
                                        <h3 className="font-bold text-slate-700 uppercase">
                                            Detalle de Defectos: <span className="text-purple-700">{gradeName}</span>
                                        </h3>
                                        <div className="text-sm font-bold text-slate-500">
                                            Total Piezas Grado: {gradeData.total}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
                                        {/* Tabla de Defectos del Grado */}
                                        <div>
                                            <table className="w-full text-sm border-collapse">
                                                <thead>
                                                    <tr className="border-b border-slate-200">
                                                        <th className="py-1 px-2 text-left font-bold text-slate-500 text-xs uppercase">Defecto</th>
                                                        <th className="py-1 px-2 text-center font-bold text-slate-500 text-xs uppercase">Piezas</th>
                                                        <th className="py-1 px-2 text-center font-bold text-slate-500 text-xs uppercase">% (del Grado)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {defectsList.map((d, idx) => (
                                                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                                                            <td className="py-2 px-2 text-slate-700">{d.name}</td>
                                                            <td className="py-2 px-2 text-center text-slate-600">{d.count}</td>
                                                            <td className="py-2 px-2 text-center font-bold text-slate-700">{d.percentage.toFixed(1)}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Gráfico Simple (Barras) para el Grado */}
                                        <div className="flex flex-col justify-center gap-2">
                                            {defectsList.map((d, idx) => (
                                                <div key={idx} className="space-y-1">
                                                    <div className="flex justify-between text-xs text-slate-500">
                                                        <span>{d.name}</span>
                                                        <span>{d.percentage.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full print:print-color-adjust-exact ${gradeName === 'RECHAZO' ? 'bg-red-500 print:bg-red-500' : 'bg-green-500 print:bg-green-500'}`}
                                                            style={{ width: `${d.percentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ))}
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
