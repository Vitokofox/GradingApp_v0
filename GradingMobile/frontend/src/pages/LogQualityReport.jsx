import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { ArrowLeft, Printer, FileText, Calendar, Activity, User, Maximize2, ChartBarDecreasing, Clipboard } from 'lucide-react';
import {
    ComposedChart, Line, ReferenceLine, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

export default function LogQualityReport() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [control, setControl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchControl = async () => {
            try {
                const response = await api.get(`/api/log-inspections/${id}`);
                setControl(response.data);
            } catch (err) {
                setError('Error al cargar la inspección.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchControl();
    }, [id]);

    if (loading) return <div className="ga-page u-center u-muted">Cargando reporte...</div>;
    if (error) return <div className="ga-page u-center u-error">{error}</div>;
    if (!control) return <div className="ga-page u-center u-error">Inspección no encontrada</div>;

    const logs = control.logs || [];
    const totalLogs = logs.length;

    // Calcular defectos
    let sanoCount = 0;
    const defectCounts = {};
    const defectLabels = {
        freckles: 'Pecas',
        splintering: 'Astillamiento',
        fissures: 'Fisuras',
        spores: 'Esporas',
        blue_stain: 'M. Azul',
        bark: 'Corteza',
        rot: 'Pudrición',
        bad_pruning: 'Mal Desrame'
    };

    let hasDetailedData = false;

    logs.forEach(log => {
        let hasDefect = false;

        if (log.jas_diameter !== null || log.actual_length !== null) {
            hasDetailedData = true;
        }

        Object.keys(defectLabels).forEach(key => {
            if (log[key]) {
                const label = defectLabels[key];
                defectCounts[label] = (defectCounts[label] || 0) + 1;
                hasDefect = true;
            }
        });

        if (log.other) {
            defectCounts[log.other] = (defectCounts[log.other] || 0) + 1;
            hasDefect = true;
        }

        if (!hasDefect) {
            sanoCount++;
        }
    });

    const breakdown = [];
    if (sanoCount > 0) {
        breakdown.push({ name: 'Sin defecto', count: sanoCount });
    }
    Object.keys(defectCounts).forEach(key => {
        breakdown.push({ name: key, count: defectCounts[key] });
    });

    // Ordenar de mayor a menor (excepto "Sin defecto" que suele ir primero en visual)
    breakdown.sort((a, b) => b.count - a.count);

    // Si queremos obligar a que "Sin defecto" sea el primero:
    const finalBreakdown = [];
    const sinDefectoIdx = breakdown.findIndex(i => i.name === 'Sin defecto');
    if (sinDefectoIdx > -1) {
        finalBreakdown.push(breakdown[sinDefectoIdx]);
        breakdown.splice(sinDefectoIdx, 1);
    }
    finalBreakdown.push(...breakdown);

    // Add percentages
    finalBreakdown.forEach(item => {
        item.percentage = totalLogs > 0 ? ((item.count / totalLogs) * 100).toFixed(2) : 0;
    });

    // Funciones para modo detallado
    const targetLength = parseFloat(control.target_length) || 0;
    const targetDiameter = parseFloat(control.target_diameter) || 0;

    const diameterLogs = logs.filter(l => l.jas_diameter !== null).map((l, i) => ({
        index: i + 1,
        diameter: parseFloat(l.jas_diameter)
    }));

    const lengthLogs = logs.filter(l => l.actual_length !== null).map((l, i) => ({
        index: i + 1,
        length: parseFloat(l.actual_length)
    }));


    return (
        <div className="ga-page">
            <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>

                {/* Header Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }} className="print:hidden">
                    <button
                        onClick={() => navigate('/process/log-quality')}
                        className="ga-btn ga-btn--text"
                    >
                        <ArrowLeft size={20} style={{ marginRight: '0.5rem' }} /> Volver a Controles
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
                                        Reporte de Calidad Trozos
                                    </h1>
                                </div>
                                <div style={{ fontSize: '1.1rem', opacity: 0.9 }}>
                                    Buzón: {control.bin_number}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>ID: {control.id}</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                                    Registrado: {new Date(control.timestamp).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Meta Data Section */}
                    <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1.5rem', backgroundColor: '#fcfcfc', borderBottom: '1px solid #eee' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                                <Calendar size={12} style={{ marginRight: '0.25rem' }} /> Fecha
                            </span>
                            <span style={{ fontWeight: 600 }}>{control.date}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                                <Activity size={12} style={{ marginRight: '0.25rem' }} /> Turno
                            </span>
                            <span style={{ fontWeight: 600 }}>{control.shift}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                                <User size={12} style={{ marginRight: '0.25rem' }} /> Inspector
                            </span>
                            <span style={{ fontWeight: 600 }}>{control.responsible}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                                <Maximize2 size={12} style={{ marginRight: '0.25rem' }} /> Diám. Obj
                            </span>
                            <span style={{ fontWeight: 600 }}>{control.target_diameter || 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                                <Maximize2 size={12} style={{ marginRight: '0.25rem' }} /> Largo Obj
                            </span>
                            <span style={{ fontWeight: 600 }}>{control.target_length || 'N/A'}</span>
                        </div>
                    </div>

                    {/* Summary & Chart Section */}
                    <div style={{ padding: '2rem', borderBottom: hasDetailedData ? '1px solid #eee' : 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '3rem' }}>

                            {/* Summary Table */}
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1.5rem', borderBottom: '2px solid var(--ga-primary)', paddingBottom: '0.5rem' }}>
                                    <Clipboard size={12} style={{ marginRight: '0.25rem' }} /> Resumen de Datos
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Trozos</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--ga-primary)' }}>{totalLogs}</div>
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
                                            {finalBreakdown.map((d, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{d.name}</td>
                                                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{d.count}</td>
                                                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>{d.percentage}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Visual Chart */}
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1.5rem', borderBottom: '2px solid var(--ga-primary)', paddingBottom: '0.5rem' }}>
                                    <ChartBarDecreasing size={12} style={{ marginRight: '0.25rem' }} /> Grafico
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {finalBreakdown.map((item, idx) => (
                                        <div key={idx}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                                                <span style={{ fontWeight: 700 }}>{item.name}</span>
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
                                                    background: item.name === 'Sin defecto' || item.name === 'Sanos'
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

                    {/* Detailed Data SECTION (Only visible if there is data) */}
                    {hasDetailedData && (
                        <div style={{ padding: '2rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem', borderBottom: '2px solid var(--ga-primary)', paddingBottom: '0.5rem' }}>
                                Análisis Detallado (Dispersión)
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

                                {diameterLogs.length > 0 && (
                                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <h4 style={{ fontWeight: 700, marginBottom: '1rem', textAlign: 'center' }}>Distribución de Diámetros (JAS)</h4>
                                        <div style={{ height: '250px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={diameterLogs}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="index" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />

                                                    {targetDiameter > 0 && (
                                                        <>
                                                            <ReferenceLine y={targetDiameter - 0.3} stroke="#ef4444" strokeDasharray="3 3" />
                                                            <ReferenceLine y={targetDiameter + 1.8} stroke="#ef4444" strokeDasharray="3 3" />
                                                        </>
                                                    )}
                                                    <Line type="monotone" dataKey="diameter" name="Diámetro JAS" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                                {lengthLogs.length > 0 && (
                                    <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <h4 style={{ fontWeight: 700, marginBottom: '1rem', textAlign: 'center' }}>Distribución de Largos Real</h4>
                                        <div style={{ height: '250px' }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={lengthLogs}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="index" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />

                                                    {targetLength > 0 && (
                                                        <ReferenceLine y={targetLength} stroke="#ef4444" strokeDasharray="3 3" />
                                                    )}
                                                    <Line type="monotone" dataKey="length" name="Largo Real (mm)" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    )}

                    {/* Footer / Notes */}
                    <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderTop: '1px solid #eee', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
                        Este reporte fue generado automáticamente por el Sistema de Control de Calidad | {new Date().getFullYear()}
                    </div>
                </div>
            </div>
        </div>
    );
}
