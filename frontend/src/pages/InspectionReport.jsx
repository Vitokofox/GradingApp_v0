
// Importacion de librerias y componentes necesarios
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInspection, getInspectionResults } from '../api';
import { ArrowLeft, Printer } from 'lucide-react';

// Componente Principal: Reporte de Inspección
// Muestra el detalle completo de una inspección, incluyendo metadatos, tablas y gráficos.
export default function InspectionReport() {
    const { id } = useParams(); // Obtiene el ID de la URL
    const navigate = useNavigate(); // Hook para navegación

    // Estados del componente (State)
    const [inspection, setInspection] = useState(null); // Almacena los datos generales de la inspección
    const [results, setResults] = useState([]); // Almacena los resultados individuales (piezas)
    const [stats, setStats] = useState({ gradeSummary: [], defectSummary: [], totalPieces: 0 }); // Almacena estadísticas calculadas

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
            setResults(resData);
            calculateStats(resData); // Procesa los datos una vez cargados
        } catch (error) {
            console.error("Error loading report data", error);
        }
    };

    // Función: calculateStats (Calcular Estadísticas)
    // Procesa los datos crudos para generar resúmenes por grado y defecto
    const calculateStats = (data) => {
        const total = data.reduce((acc, curr) => acc + curr.pieces_count, 0);

        // Resumen de Grados (Grade Summary)
        // Agrupa las piezas por nombre de grado
        const gradeMap = {};
        data.forEach(item => {
            const gName = item.grade?.name || 'Unknown';
            if (!gradeMap[gName]) gradeMap[gName] = 0;
            gradeMap[gName] += item.pieces_count;
        });

        // Transforma el mapa en un array para facilitar el renderizado
        const gradeSummary = Object.keys(gradeMap).map(name => ({
            name,
            count: gradeMap[name],
            percentage: total ? (gradeMap[name] / total) * 100 : 0
        })).sort((a, b) => b.count - a.count); // Ordena descendente por cantidad

        // Resumen de Defectos (Defect Summary)
        // Agrupa las piezas por nombre de defecto
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
                                Resumen de Inspección N° {inspection.id}
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

                    {/* Sección de Tablas y Gráficos */}
                    <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

                        {/* Columna Izquierda: Grados */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ background: '#0284c7', color: 'white', fontWeight: 'bold', padding: '0.5rem 1rem', textAlign: 'center', textTransform: 'uppercase', fontSize: '0.875rem', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                                    Resumen de Grado
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
                                        <tr style={{ background: '#e0f2fe', borderTop: '2px solid #bae6fd', fontWeight: 'bold', color: '#0c4a6e', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                                            <td style={{ padding: '0.5rem 0.75rem' }}>EN GRADO</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                                {stats.gradeSummary.reduce((acc, g) => g.name !== 'RECHAZO' ? acc + g.count : acc, 0)}
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                                {stats.totalPieces ? (stats.gradeSummary.reduce((acc, g) => g.name !== 'RECHAZO' ? acc + g.count : acc, 0) / stats.totalPieces * 100).toFixed(2) : '0.00'}%
                                            </td>
                                        </tr>
                                        <tr style={{ background: '#1e293b', color: 'white', fontWeight: 'bold', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                                            <td style={{ padding: '0.5rem 0.75rem' }}>TOTAL</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{stats.totalPieces}</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>100%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Gráfico de Grados */}
                            {stats.totalPieces > 0 && (
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '1rem', height: '300px', display: 'flex', flexDirection: 'column' }}>
                                    <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', textAlign: 'center', marginBottom: '1.5rem' }}>Gráfico Distribución</h4>
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #cbd5e1' }}>
                                        {stats.gradeSummary.map((grade, idx) => (
                                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '40px', height: '100%', justifyContent: 'flex-end' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>{grade.percentage.toFixed(0)}%</div>
                                                <div style={{ width: '100%', background: '#f1f5f9', borderRadius: '4px 4px 0 0', position: 'relative', display: 'flex', alignItems: 'flex-end', height: '200px' }}>
                                                    <div
                                                        style={{
                                                            width: '100%',
                                                            borderRadius: '4px 4px 0 0',
                                                            background: grade.name === 'RECHAZO' ? '#dc2626' : '#16a34a',
                                                            height: `${grade.percentage}%`,
                                                            transition: 'height 0.5s',
                                                            printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact'
                                                        }}
                                                    ></div>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#334155', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }} title={grade.name}>{grade.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Columna Derecha: Defectos */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ background: '#0284c7', color: 'white', fontWeight: 'bold', padding: '0.5rem 1rem', textAlign: 'center', textTransform: 'uppercase', fontSize: '0.875rem', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                                    Tipificación de Defectos
                                </div>
                                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 'bold', color: '#475569' }}>Defecto</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>Piezas</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.defectSummary.map((defect, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500, color: '#334155' }}>{defect.name}</td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{defect.count}</td>
                                                <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: 'bold', color: '#334155' }}>{defect.percentage.toFixed(2)}%</td>
                                            </tr>
                                        ))}
                                        {stats.defectSummary.length === 0 && (
                                            <tr>
                                                <td colSpan="3" style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No se registraron defectos</td>
                                            </tr>
                                        )}
                                        <tr style={{ background: '#bae6fd', borderTop: '2px solid #7dd3fc', fontWeight: 'bold', color: '#0c4a6e', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                                            <td style={{ padding: '0.5rem 0.75rem' }}>TOTAL</td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                                {stats.defectSummary.reduce((acc, d) => acc + d.count, 0)}
                                            </td>
                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                                {stats.totalPieces ? (stats.defectSummary.reduce((acc, d) => acc + d.count, 0) / stats.totalPieces * 100).toFixed(2) : '0.00'}%
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Gráfico de Defectos */}
                            {stats.totalPieces > 0 && (
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '1rem', height: '300px', display: 'flex', flexDirection: 'column' }}>
                                    <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', textAlign: 'center', marginBottom: '1.5rem' }}>Gráfico Defectos</h4>
                                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {stats.defectSummary.map((defect, idx) => (
                                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#475569' }}>
                                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{defect.name}</span>
                                                    <span>{defect.percentage.toFixed(2)}%</span>
                                                </div>
                                                <div style={{ width: '100%', background: '#f1f5f9', borderRadius: '99px', height: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                    <div
                                                        style={{
                                                            height: '100%',
                                                            background: '#dc2626',
                                                            width: `${Math.max(defect.percentage, 1)}%`,
                                                            printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact'
                                                        }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))}
                                        {stats.defectSummary.length === 0 && (
                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                                Sin datos para graficar
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
