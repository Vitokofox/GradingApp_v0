import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInspection, getInspectionResults } from '../api';
import { motion } from 'framer-motion';
import { ArrowLeft, Printer, FileText, Calendar, User, MapPin, Box, Database, AlertTriangle } from 'lucide-react';

export default function InspectionReport() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [inspection, setInspection] = useState(null);
    const [results, setResults] = useState([]);
    const [stats, setStats] = useState({ gradeSummary: [], defectSummary: [], totalPieces: 0 });

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            const inspData = await getInspection(id);
            const resData = await getInspectionResults(id);
            setInspection(inspData);
            setResults(resData);
            calculateStats(resData);
        } catch (error) {
            console.error("Error loading report data", error);
        }
    };

    const calculateStats = (data) => {
        const total = data.reduce((acc, curr) => acc + curr.pieces_count, 0);

        // Grade Summary
        const gradeMap = {};
        data.forEach(item => {
            const gName = item.grade?.name || 'Unknown';
            if (!gradeMap[gName]) gradeMap[gName] = 0;
            gradeMap[gName] += item.pieces_count;
        });

        const gradeSummary = Object.keys(gradeMap).map(name => ({
            name,
            count: gradeMap[name],
            percentage: total ? (gradeMap[name] / total) * 100 : 0
        })).sort((a, b) => b.count - a.count); // Sort by count descending

        // Defect Summary
        const defectMap = {};

        data.forEach(item => {
            if (item.defect && item.defect.name) {
                const dName = item.defect.name;
                if (!defectMap[dName]) defectMap[dName] = 0;
                defectMap[dName] += item.pieces_count;
            }
        });

        const defectSummary = Object.keys(defectMap).map(name => ({
            name,
            count: defectMap[name],
            percentage: total ? (defectMap[name] / total) * 100 : 0
        })).sort((a, b) => b.count - a.count);

        setStats({ gradeSummary, defectSummary, totalPieces: total });
    };

    if (!inspection) return <div className="text-white p-8">Cargando reporte...</div>;

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header Actions */}
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

                {/* Report Content */}
                <div className="bg-white text-slate-900 rounded-none shadow-xl overflow-hidden print:shadow-none print:w-full">

                    {/* Report Header (Green) */}
                    <div className="bg-lime-500 p-6 print:bg-lime-500 print:print-color-adjust-exact">
                        <div className="flex justify-between items-start">
                            <h1 className="text-2xl font-bold text-white uppercase tracking-tight">
                                Resumen de Inspección N° {inspection.id}
                            </h1>
                            <div className="text-right text-lime-900 font-mono text-sm">
                                {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                            </div>
                        </div>
                    </div>

                    {/* Meta Data Grid */}
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

                    {/* Tables Section */}
                    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 break-inside-avoid">

                        {/* Grade Summary Table */}
                        <div className="space-y-4">
                            <div className="bg-sky-600 text-white font-bold py-2 px-4 text-center uppercase text-sm rounded-t print:bg-sky-600 print:print-color-adjust-exact">
                                Resumen de Grado
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
                                    {/* Summary Rows matching image style */}
                                    <tr className="bg-sky-100 font-bold border-t-2 border-sky-200 print:bg-sky-100 print:print-color-adjust-exact">
                                        <td className="py-2 px-3 text-sky-900">EN GRADO</td>
                                        <td className="py-2 px-3 text-center text-sky-900">
                                            {stats.gradeSummary.reduce((acc, g) => g.name !== 'RECHAZO' ? acc + g.count : acc, 0)}
                                        </td>
                                        <td className="py-2 px-3 text-center text-sky-900">
                                            {stats.totalPieces ? (stats.gradeSummary.reduce((acc, g) => g.name !== 'RECHAZO' ? acc + g.count : acc, 0) / stats.totalPieces * 100).toFixed(2) : '0.00'}%
                                        </td>
                                    </tr>
                                    <tr className="bg-slate-800 text-white font-bold print:bg-slate-800 print:print-color-adjust-exact">
                                        <td className="py-2 px-3">TOTAL</td>
                                        <td className="py-2 px-3 text-center">{stats.totalPieces}</td>
                                        <td className="py-2 px-3 text-center">100%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Defect Summary Table */}
                        <div className="space-y-4">
                            <div className="bg-sky-600 text-white font-bold py-2 px-4 text-center uppercase text-sm rounded-t print:bg-sky-600 print:print-color-adjust-exact">
                                Tipificación del Rechazo
                            </div>
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 border-b border-slate-300">
                                        <th className="py-2 px-3 text-left font-bold text-slate-600">Defecto</th>
                                        <th className="py-2 px-3 text-center font-bold text-slate-600">Cant. Piezas</th>
                                        <th className="py-2 px-3 text-center font-bold text-slate-600">Porcentaje</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.defectSummary.map((defect, idx) => (
                                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="py-2 px-3 font-medium text-slate-700">{defect.name}</td>
                                            <td className="py-2 px-3 text-center">{defect.count}</td>
                                            <td className="py-2 px-3 text-center font-bold text-slate-700">{defect.percentage.toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                    {stats.defectSummary.length === 0 && (
                                        <tr>
                                            <td colSpan="3" className="py-4 text-center text-slate-400 italic">No se registraron defectos</td>
                                        </tr>
                                    )}
                                    <tr className="bg-sky-200 font-bold border-t-2 border-sky-300 print:bg-sky-200 print:print-color-adjust-exact">
                                        <td className="py-2 px-3 text-sky-900">TOTAL</td>
                                        <td className="py-2 px-3 text-center text-sky-900">
                                            {stats.defectSummary.reduce((acc, d) => acc + d.count, 0)}
                                        </td>
                                        <td className="py-2 px-3 text-center text-sky-900">
                                            {stats.totalPieces ? (stats.defectSummary.reduce((acc, d) => acc + d.count, 0) / stats.totalPieces * 100).toFixed(2) : '0.00'}%
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Charts Section */}
                    {stats.totalPieces > 0 && (
                        <div className="p-6 pt-0 grid grid-cols-1 lg:grid-cols-2 gap-8 break-inside-avoid">
                            {/* Grade Chart (Vertical) */}
                            <div className="bg-white border border-slate-200 rounded p-4 h-96 flex flex-col">
                                <h4 className="text-sm font-bold text-slate-600 uppercase text-center mb-6">Resumen de Grado</h4>
                                <div className="flex-1 flex items-end justify-around gap-4 px-4 pb-2 border-b border-slate-300 relative h-full">
                                    {stats.gradeSummary.map((grade, idx) => (
                                        <div key={idx} className="flex flex-col items-center gap-2 w-16 h-full justify-end">
                                            <div className="text-xs font-bold text-slate-500 mb-1">{grade.percentage.toFixed(0)}%</div>
                                            <div className="w-full bg-slate-100 rounded-t relative flex items-end h-[200px]">
                                                <div
                                                    className={`w-full rounded-t transition-all duration-500 ${grade.name === 'RECHAZO' ? 'bg-red-600' : 'bg-green-600'} print:print-color-adjust-exact`}
                                                    style={{ height: `${grade.percentage}%` }}
                                                ></div>
                                            </div>
                                            <div className="text-xs font-bold text-slate-700 text-center uppercase truncate w-full" title={grade.name}>{grade.name}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Defect Chart (Horizontal) */}
                            <div className="bg-white border border-slate-200 rounded p-4 h-96 flex flex-col">
                                <h4 className="text-sm font-bold text-slate-600 uppercase text-center mb-6">Tipificación del Rechazo</h4>
                                <div className="flex-1 overflow-y-auto space-y-5 px-2">
                                    {stats.defectSummary.map((defect, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-1">
                                                <span className="truncate">{defect.name}</span>
                                                <span>{defect.percentage.toFixed(2)}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-200">
                                                <div
                                                    className="h-full bg-red-600 print:bg-red-600 print:print-color-adjust-exact"
                                                    style={{ width: `${Math.max(defect.percentage, 1)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))}
                                    {stats.defectSummary.length === 0 && (
                                        <div className="h-full flex items-center justify-center text-slate-400 italic">
                                            Sin datos de defectos para graficar
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
