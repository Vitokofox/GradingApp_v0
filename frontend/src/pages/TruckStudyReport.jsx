import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTruckStudy } from '../api';
import { ArrowLeft, Printer, FileText, Calendar, Hash, Tag, User, Activity } from 'lucide-react';

export default function TruckStudyReport() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [study, setStudy] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await getTruckStudy(id);
            setStudy(data);
        } catch (error) {
            console.error("Error loading truck study report", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="ga-page u-center u-muted">Cargando reporte...</div>;
    if (!study) return <div className="ga-page u-center u-error">Estudio no encontrado</div>;

    // Calcular porcentajes
    const totalLogs = study.total_logs || 0;
    const breakdown = study.defects.map(d => ({
        ...d,
        percentage: totalLogs > 0 ? (d.count / totalLogs * 100).toFixed(2) : 0
    })).sort((a, b) => b.count - a.count);

    return (
        <div className="ga-page">
            <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>

                {/* Header Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }} className="print:hidden">
                    <button
                        onClick={() => navigate('/process/truck-study')}
                        className="ga-btn ga-btn--text"
                    >
                        <ArrowLeft size={20} style={{ marginRight: '0.5rem' }} /> Volver a Estudios
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="ga-btn ga-btn--primary"
                    >
                        <Printer size={20} style={{ marginRight: '0.5rem' }} /> Imprimir Reporte
                    </button>
                </div>

                {/* Report Content */}
                <div className="ga-card" style={{ background: 'white', padding: 0, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>

                    {/* Visual Header */}
                    <div style={{ background: 'var(--ga-primary)', padding: '2rem', color: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                    <FileText size={28} />
                                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>
                                        Reporte de Estudio Camión
                                    </h1>
                                </div>
                                <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>
                                    Guía N° {study.guide_number} | Predio: {study.estate}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>ID: {study.id}</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                                    Registrado: {new Date(study.timestamp).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Meta Data Section */}
                    <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', backgroundColor: '#fcfcfc', borderBottom: '1px solid #eee' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                                <Calendar size={12} style={{ marginRight: '0.25rem' }} /> Fecha Recepción
                            </span>
                            <span style={{ fontWeight: 600 }}>{study.reception_date}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                                <Calendar size={12} style={{ marginRight: '0.25rem' }} /> Fecha Corte
                            </span>
                            <span style={{ fontWeight: 600 }}>{study.cutting_date}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                                <User size={12} style={{ marginRight: '0.25rem' }} /> Equipo Maderero
                            </span>
                            <span style={{ fontWeight: 600 }}>{study.logging_team}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                                <Activity size={12} style={{ marginRight: '0.25rem' }} /> Responsable
                            </span>
                            <span style={{ fontWeight: 600 }}>{study.responsible}</span>
                        </div>
                    </div>

                    {/* Summary & Chart Section */}
                    <div style={{ padding: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '3rem' }}>

                            {/* Summary Table */}
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1.5rem', borderBottom: '2px solid var(--ga-primary)', paddingBottom: '0.5rem' }}>
                                    Resumen de Datos
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Trozos</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--ga-primary)' }}>{study.total_logs}</div>
                                    </div>

                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid #dee2e6', textAlign: 'left' }}>
                                                <th style={{ padding: '0.5rem' }}>Característica</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Cant.</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'right' }}>%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {breakdown.map((d, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{d.defect_name}</td>
                                                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{d.count}</td>
                                                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>{d.percentage}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* visual Chart */}
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1.5rem', borderBottom: '2px solid var(--ga-primary)', paddingBottom: '0.5rem' }}>
                                    Distribución Visual
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {breakdown.map((item, idx) => (
                                        <div key={idx}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                                                <span style={{ fontWeight: 700 }}>{item.defect_name}</span>
                                                <span>{item.count} piezas ({item.percentage}%)</span>
                                            </div>
                                            <div style={{
                                                width: '100%',
                                                height: '28px',
                                                backgroundColor: '#f1f5f9',
                                                borderRadius: '14px',
                                                overflow: 'hidden',
                                                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                                            }}>
                                                <div style={{
                                                    width: `${item.percentage}%`,
                                                    height: '100%',
                                                    background: item.defect_name.toLowerCase() === 'sin defecto'
                                                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                                                        : 'linear-gradient(90deg, #2563eb, #60a5fa)',
                                                    transition: 'width 1s ease-out'
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Notes */}
                    <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid #eee', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
                        Este reporte fue generado automáticamente por el Sistema de Control de Calidad | {new Date().getFullYear()}
                    </div>
                </div>
            </div>
        </div>
    );
}
