
// Importacion de librerias y componentes necesarios
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInspection, getInspectionResults } from '../api';
import { ArrowLeft, Printer } from 'lucide-react';

// Componente Principal: Reporte de Grado en Línea
// Muestra el detalle completo de una inspección, con desglose de defectos por cada grado.
export default function InlineGradeReport() {
    const { id } = useParams(); // Obtiene el ID de la URL
    const navigate = useNavigate(); // Hook para navegación

    // Estados del componente (State)
    const [inspection, setInspection] = useState(null); // Almacena los datos generales de la inspección
    const [stats, setStats] = useState({ gradeSummary: [], defectsByGrade: {}, totalPieces: 0 }); // Almacena estadísticas calculadas

    // Efecto de carga inicial
    // Se ejecuta cuando cambia el 'id' de la inspección
    useEffect(() => {
        loadData();
    }, [id]);

    // Función: loadData (Cargar Datos)
    // Obtiene la información de la inspección y sus resultados desde el backend
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
    // Procesa los datos crudos para generar resúmenes por grado y defecto POR GRADO
    const calculateStats = (data) => {
        const total = data.reduce((acc, curr) => acc + curr.pieces_count, 0);

        // Resumen de Grados (Grade Summary)
        // Agrupa las piezas por nombre de grado
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

    if (!inspection) return <div className="ga-page u-center u-muted">Cargando reporte...</div>;

    // Renderizado UI (User Interface)
    return (
        <div className="ga-page">
            <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>

                {/* Acciones de Cabecera (Header Actions) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }} className="print:hidden">
                    <button
                        onClick={() => navigate('/inspections')}
                        className="ga-btn ga-btn--text"
                    >
                        <ArrowLeft size={20} style={{ marginRight: '0.5rem' }} /> Volver al Historial
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="ga-btn ga-btn--primary"
                    >
                        <Printer size={20} style={{ marginRight: '0.5rem' }} /> Imprimir Reporte
                    </button>
                </div>

                {/* Contenido del Reporte (Report Content) */}
                <div className="ga-card" style={{ background: 'white', color: '#1e293b', padding: 0, overflow: 'hidden', boxShadow: 'none' }}>

                    {/* Cabecera del Reporte (Report Header - Green) */}
                    <div style={{ background: '#84cc16', padding: '1.5rem', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', margin: 0 }}>
                                Reporte de Grado en Línea N° {inspection.id}
                            </h1>
                            <div style={{ textAlign: 'right', color: '#365314', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                                {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                            </div>
                        </div>
                    </div>

                    {/* Grilla de Metadatos (Meta Data Grid) */}
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.875rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem 2rem' }}>
                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Fecha Inspección</div>
                                <div style={{ fontWeight: 600 }}>{inspection.date}</div>
                            </div>
                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Piezas Insp.</div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>{stats.totalPieces}</div>
                            </div>
                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Turno</div>
                                <div>{inspection.shift || 'N/A'}</div>
                            </div>
                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Jornada</div>
                                <div>{inspection.journey || 'N/A'}</div>
                            </div>

                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Area</div>
                                <div>{inspection.area || 'Cepillado'}</div>
                            </div>
                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Origen</div>
                                <div>{inspection.origin || 'N/A'}</div>
                            </div>
                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Supervisor</div>
                                <div>{inspection.supervisor || 'N/A'}</div>
                            </div>
                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Responsable</div>
                                <div>{inspection.responsible || 'N/A'}</div>
                            </div>

                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Producto</div>
                                <div style={{ fontWeight: 'bold', color: '#7e22ce' }}>{inspection.product_name}</div>
                            </div>
                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Mercado</div>
                                <div>{inspection.market?.name || 'N/A'}</div>
                            </div>
                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Lote</div>
                                <div style={{ fontFamily: 'monospace' }}>{inspection.lot || 'N/A'}</div>
                            </div>
                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Terminación</div>
                                <div>{inspection.termination || 'S2S'}</div>
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '4px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Espesor</div>
                                <div>{inspection.thickness || '-'} mm</div>
                            </div>
                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Ancho</div>
                                <div>{inspection.width || '-'} mm</div>
                            </div>
                            <div className="space-y-1">
                                <div style={{ fontWeight: 'bold', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Largo</div>
                                <div>{inspection.length || '-'} mm</div>
                            </div>
                        </div>
                    </div>

                    {/* Resumen General de Grados (Siempre visible primero) */}
                    <div style={{ padding: '1.5rem', pageBreakInside: 'avoid' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'flex-start' }}>
                            {/* Tabla Resumen de Grados */}
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ background: '#0284c7', color: 'white', fontWeight: 'bold', padding: '0.5rem 1rem', textAlign: 'center', textTransform: 'uppercase', fontSize: '0.875rem', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                                    Resumen General de Grados
                                </div>
                                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 'bold', color: '#475569' }}>Producto</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>Piezas</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.gradeSummary.map((grade, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{grade.name}</td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{grade.count}</td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 'bold', color: '#334155' }}>{grade.percentage.toFixed(2)}%</td>
                                            </tr>
                                        ))}
                                        <tr style={{ background: '#1e293b', color: 'white', fontWeight: 'bold', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                                            <td style={{ padding: '0.5rem 0.75rem' }}>TOTAL</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{stats.totalPieces}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>100%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Gráfico de Grados (Visual) */}
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '1rem', height: '300px', display: 'flex', flexDirection: 'column' }}>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', textAlign: 'center', marginBottom: '1.5rem' }}>Resumen de Grado (Gráfico)</h4>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '1rem', paddingBottom: '1.5rem', borderBottom: '1px solid #cbd5e1' }}>
                                    {stats.gradeSummary.map((grade, idx) => (
                                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '40px', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', textAlign: 'center', width: '100%', position: 'absolute', top: -20 }}>
                                                {grade.percentage.toFixed(0)}%
                                            </div>
                                            <div style={{ width: '100%', background: '#f8fafc', borderRadius: '4px 4px 0 0', position: 'relative', display: 'flex', alignItems: 'flex-end', height: '100%', paddingTop: '1.5rem' }}>
                                                <div
                                                    style={{
                                                        width: '100%',
                                                        borderRadius: '4px 4px 0 0',
                                                        background: grade.name === 'RECHAZO' ? '#dc2626' : '#16a34a',
                                                        height: `${grade.percentage}%`,
                                                        transition: 'height 0.7s',
                                                        printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact'
                                                    }}
                                                ></div>
                                            </div>
                                            <div style={{ position: 'absolute', bottom: -24, width: '100%', fontSize: '0.75rem', fontWeight: 'bold', color: '#334155', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={grade.name}>
                                                {grade.name}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tipificación por Grado (Iterativo) */}
                    <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {Object.entries(stats.defectsByGrade).map(([gradeName, gradeData]) => {
                            // Calcular resumen de defectos para este grado específico
                            const defectsList = Object.entries(gradeData.defects).map(([dName, count]) => ({
                                name: dName,
                                count,
                                percentage: gradeData.total ? (count / gradeData.total) * 100 : 0
                            })).sort((a, b) => b.count - a.count);

                            if (defectsList.length === 0) return null; // No mostrar si no hay defectos (ej: grado perfecto)

                            return (
                                <div key={gradeName} style={{ pageBreakInside: 'avoid', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                    {/* Cabecera del Grado */}
                                    <div style={{ background: '#f1f5f9', padding: '0.75rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase', margin: 0 }}>
                                            Detalle de Defectos: <span style={{ color: '#7e22ce' }}>{gradeName}</span>
                                        </h3>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#64748b' }}>
                                            Total Piezas Grado: {gradeData.total}
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', padding: '1rem' }}>
                                        {/* Tabla de Defectos del Grado */}
                                        <div>
                                            <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                        <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left', fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Defecto</th>
                                                        <th style={{ padding: '0.25rem 0.5rem', textAlign: 'center', fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Piezas</th>
                                                        <th style={{ padding: '0.25rem 0.5rem', textAlign: 'center', fontWeight: 'bold', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>% (del Grado)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {defectsList.map((d, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                            <td style={{ padding: '0.5rem 0.5rem', color: '#334155' }}>{d.name}</td>
                                                            <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', color: '#475569' }}>{d.count}</td>
                                                            <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', fontWeight: 'bold', color: '#334155' }}>{d.percentage.toFixed(1)}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Gráfico Simple (Barras) para el Grado */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                                            {defectsList.map((d, idx) => (
                                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                                                        <span>{d.name}</span>
                                                        <span>{d.percentage.toFixed(1)}%</span>
                                                    </div>
                                                    <div style={{ width: '100%', background: '#f1f5f9', height: '8px', borderRadius: '99px', overflow: 'hidden' }}>
                                                        <div
                                                            style={{
                                                                height: '100%',
                                                                borderRadius: '99px',
                                                                background: gradeName === 'RECHAZO' ? '#ef4444' : '#22c55e',
                                                                width: `${d.percentage}%`,
                                                                printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact'
                                                            }}
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
