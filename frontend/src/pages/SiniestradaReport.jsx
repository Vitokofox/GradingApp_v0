import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSiniestradaStudy } from '../api';
import { ArrowLeft, Printer, FileText, Calendar, Clock, Hash, Tag, User, Activity } from 'lucide-react';
import { formatSpanishDate, getLocalISODate } from '../utils/dataUtils';

export default function SiniestradaReport() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [study, setStudy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [decimals, setDecimals] = useState(2);


    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await getSiniestradaStudy(id);
            setStudy(data);
        } catch (error) {
            console.error("Error loading study details", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="ga-page u-center u-muted">Cargando reporte...</div>;
    if (!study) return <div className="ga-page u-center u-error">Registro no encontrado</div>;

    const total = study.total_weight || 1;
    const items = [
        { name: 'Astilla Pulpable', weight: study.pulpable_chip_weight, color: '#10b981' },
        { name: 'Corteza Quemada', weight: study.burnt_bark_weight, color: '#b91c1c' },
        { name: 'Cambium Quemado', weight: study.burnt_cambium_weight, color: '#9a3412' },
        { name: 'Madera/Manto Quemado', weight: study.burnt_wood_weight, color: '#451a03' },
        { name: 'Astilla con Hollín', weight: study.soot_chip_weight, color: '#1e293b' }
    ].map(item => ({
        ...item,
        percentage: (item.weight / total * 100).toFixed(decimals)
    })).sort((a, b) => b.weight - a.weight);


    return (
        <div className="ga-page">
            <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>

                {/* Header Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }} className="print:hidden">
                    <button
                        onClick={() => navigate('/process/siniestrada-study')}
                        className="ga-btn ga-btn--text"
                    >
                        <ArrowLeft size={20} style={{ marginRight: '0.5rem' }} /> Volver a Estudios
                    </button>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                            <span style={{ color: '#64748b', fontWeight: 'bold' }}>Decimales:</span>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                {[2, 3, 4, 5].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setDecimals(d)}
                                        style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '3px',
                                            border: 'none',
                                            backgroundColor: decimals === d ? '#e67e22' : 'transparent',
                                            color: decimals === d ? 'white' : '#64748b',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={() => window.print()}
                            className="ga-btn ga-btn--primary"
                        >
                            <Printer size={20} style={{ marginRight: '0.5rem' }} /> Imprimir Reporte
                        </button>
                    </div>
                </div>

                {/* Report Content */}
                <div className="ga-card" style={{ background: 'white', padding: 0, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>

                    {/* Visual Header */}
                    <div style={{ background: '#e67e22', padding: '2rem', color: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                    <Activity size={28} />
                                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>
                                        Reporte de Astilla Siniestrada
                                    </h1>
                                </div>
                                <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>
                                    Muestra: {study.screen} | Área: {study.area}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>ID: {study.id}</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                                    {formatSpanishDate(study.date)} | {study.time}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Metadata Section */}
                    <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', backgroundColor: '#fcfcfc', borderBottom: '1px solid #eee' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Turno</span>
                            <span style={{ fontWeight: 600 }}>{study.shift}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Jornada</span>
                            <span style={{ fontWeight: 600 }}>{study.journey}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Responsable</span>
                            <span style={{ fontWeight: 600 }}>{study.responsible}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Peso Total</span>
                            <span style={{ fontWeight: 900, color: '#e67e22', fontSize: '1.2rem' }}>{study.total_weight.toFixed(decimals)} gr</span>
                        </div>
                    </div>


                    {/* Analysis Content */}
                    <div style={{ padding: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '3rem' }}>

                            {/* Summary Table */}
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1.5rem', borderBottom: '2px solid #e67e22', paddingBottom: '0.5rem' }}>
                                    Detalle del Pesaje
                                </h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                                            <th style={{ padding: '0.5rem' }}>Ítem</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Gramos</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'right' }}>%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.8rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                                                    {item.name}
                                                </td>
                                                <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right' }}>{item.weight.toFixed(decimals)}</td>
                                                <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right', fontWeight: 800 }}>{item.percentage}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ backgroundColor: '#f8fafc', fontWeight: 900 }}>
                                            <td style={{ padding: '0.8rem 0.5rem' }}>TOTAL MUESTRA</td>
                                            <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right' }}>{study.total_weight.toFixed(decimals)}</td>
                                            <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right' }}>100%</td>
                                        </tr>
                                    </tfoot>

                                </table>
                            </div>

                            {/* visual Chart */}
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1.5rem', borderBottom: '2px solid #e67e22', paddingBottom: '0.5rem' }}>
                                    Análisis de Participación
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    {items.map((item, idx) => (
                                        <div key={idx}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                                                <span style={{ fontWeight: 700 }}>{item.name}</span>
                                                <span style={{ color: '#64748b' }}>{item.percentage}%</span>
                                            </div>
                                            <div style={{
                                                width: '100%',
                                                height: '24px',
                                                backgroundColor: '#f1f5f9',
                                                borderRadius: '12px',
                                                overflow: 'hidden',
                                                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)'
                                            }}>
                                                <div style={{
                                                    width: `${item.percentage}%`,
                                                    height: '100%',
                                                    backgroundColor: item.color,
                                                    transition: 'width 1s ease-out'
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{
                                    marginTop: '2rem',
                                    padding: '1rem',
                                    border: '1px dashed #e67e22',
                                    borderRadius: '8px',
                                    color: '#a04000',
                                    fontSize: '0.85rem',
                                    backgroundColor: '#fffcf9'
                                }}>
                                    <b>Nota:</b> La "Astilla Pulpable" se calcula automáticamente deduciendo los elementos siniestrados del peso total de la muestra.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid #eee', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
                        Reporte de Calidad de Astilla Siniestrada | Generado el {formatSpanishDate(getLocalISODate())}
                    </div>
                </div>
            </div>
        </div>
    );
}
