import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
    Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from 'recharts';
import { BarChart3, FileSpreadsheet, Loader2, Upload } from 'lucide-react';

const COLORS = {
    teal: '#00968F',
    lime: '#BCC300',
    orange: '#E27000',
    gray: '#5F5953',
};

const monthNames = ['Todos', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const ChartCard = ({ title, children }) => (
    <section className="ga-card" style={{ minHeight: 360 }}>
        <div className="ga-card__header">
            <h2 className="ga-card__title" style={{ fontSize: '1.05rem' }}>{title}</h2>
        </div>
        <div style={{ height: 290, padding: '1rem 0.5rem 0' }}>{children}</div>
    </section>
);

const RollizosReport = () => {
    const [report, setReport] = useState(null);
    const [imports, setImports] = useState([]);
    const [filters, setFilters] = useState({ year: '', month: '', product_length: '', destination: '', origin: '', zone: '', wood_state: '', age_bucket: '' });
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const { user } = useAuth();

    const loadReport = async () => {
        setLoading(true);
        try {
            const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
            const response = await api.get('/api/rollizos/report', { params });
            setReport(response.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'No se pudo cargar el reporte de antigüedad.');
        } finally {
            setLoading(false);
        }
    };

    const loadImports = async () => {
        try {
            const response = await api.get('/api/rollizos/imports');
            setImports(response.data);
        } catch (err) {
            console.error('No se pudo cargar el historial de importaciones', err);
        }
    };

    useEffect(() => { loadReport(); loadImports(); }, []);

    const updateFilter = (event) => {
        setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
    };

    const handleUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setMessage('Procesando Tablas de datos 2026 y omitiendo duplicados...');
        setError('');
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await api.post('/api/rollizos/imports', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            const data = response.data;
            setMessage(`Importación completada: ${data.rows_inserted} insertados, ${data.duplicates_skipped} duplicados omitidos, ${data.invalid_rows} inválidos.`);
            await Promise.all([loadReport(), loadImports()]);
        } catch (err) {
            setError(err.response?.data?.detail || 'No se pudo importar el archivo.');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const options = report?.options || {};
    const chartData = report?.charts || {};
    const woodKeys = useMemo(() => options.wood_states || [], [options.wood_states]);

    return (
        <div className="ga-stack" style={{ gap: '1rem' }}>
            <div className="ga-card">
                <div className="ga-card__header" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                        <h1 className="ga-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart3 size={21} /> Datos de Antigüedad</h1>
                        <p className="u-muted" style={{ margin: '0.35rem 0 0' }}>Fuente: Tablas de datos 2026 · entidad datos_antiguedad</p>
                    </div>
                    {user?.level === 'admin' && <label className="ga-btn ga-btn--secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: uploading ? 'wait' : 'pointer' }}>
                        {uploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
                        {uploading ? 'Procesando...' : 'Cargar Excel'}
                        <input type="file" accept=".xlsx,.xlsm" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
                    </label>}
                </div>
                <div className="ga-card__body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.75rem' }}>
                        {[
                            ['year', 'Año', options.years || []],
                            ['month', 'Mes', (options.months || []).map((value) => ({ value, label: monthNames[value] || value }))],
                            ['product_length', 'Largo', options.lengths || []],
                            ['wood_state', 'Estado madera', options.wood_states || []],
                            ['age_bucket', 'Antigüedad', options.age_buckets || []],
                            ['zone', 'Zona', options.zones || []],
                            ['destination', 'Destino', options.destinations || []],
                            ['origin', 'Origen', options.origins || []],
                        ].map(([name, label, values]) => (
                            <label className="ga-label" key={name}>{label}
                                <select className="ga-control" name={name} value={filters[name]} onChange={updateFilter}>
                                    <option value="">Todos</option>
                                    {values.map((item) => {
                                        const value = typeof item === 'object' ? item.value : item;
                                        const text = typeof item === 'object' ? item.label : item;
                                        return <option key={value} value={value}>{text}</option>;
                                    })}
                                </select>
                            </label>
                        ))}
                    </div>
                    <button type="button" className="ga-btn ga-btn--primary" onClick={loadReport} disabled={loading} style={{ marginTop: '1rem' }}>Aplicar filtros</button>
                    {message && <p className="ga-alert ga-alert--success" style={{ marginBottom: 0 }}>{message}</p>}
                    {error && <p className="ga-alert ga-alert--error" style={{ marginBottom: 0 }}>{error}</p>}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                {[
                    ['Registros', report?.summary?.records ?? 0],
                    ['Antigüedad promedio', `${report?.summary?.average_age ?? 0} días`],
                    ['Peso total', report?.summary?.total_weight ?? 0],
                ].map(([label, value]) => <div className="ga-card" key={label}><span className="u-muted">{label}</span><strong style={{ display: 'block', fontSize: '1.5rem', color: 'var(--ga-primary)', marginTop: '0.4rem' }}>{value}</strong></div>)}
            </div>

            {loading ? <div className="ga-card u-center u-muted">Cargando reporte...</div> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem' }}>
                    <ChartCard title="Antigüedad promedio por mes"><ResponsiveContainer><LineChart data={chartData.age_by_month}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke={COLORS.teal} strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></ChartCard>
                    <ChartCard title="Volumen por rango de antigüedad"><ResponsiveContainer><BarChart data={chartData.age_volume}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="<10 días" stackId="age" fill={COLORS.teal} /><Bar dataKey=">10 días" stackId="age" fill={COLORS.orange} /></BarChart></ResponsiveContainer></ChartCard>
                    <ChartCard title="Participación por rango de antigüedad"><ResponsiveContainer><BarChart data={chartData.age_percent}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis unit="%" /><Tooltip /><Legend /><Bar dataKey="<10 días" stackId="percent" fill={COLORS.teal} /><Bar dataKey=">10 días" stackId="percent" fill={COLORS.orange} /></BarChart></ResponsiveContainer></ChartCard>
                    <ChartCard title="Volumen por estado de madera"><ResponsiveContainer><BarChart data={chartData.wood_volume}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />{woodKeys.map((state, index) => <Bar key={state} dataKey={state} stackId="wood" fill={[COLORS.teal, COLORS.orange, COLORS.gray, COLORS.lime][index % 4]} />)}</BarChart></ResponsiveContainer></ChartCard>
                    <ChartCard title="Antigüedad promedio por mes y largo"><ResponsiveContainer><LineChart data={chartData.age_by_length}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend />{(options.lengths || []).map((length, index) => <Line key={length} type="monotone" dataKey={`largo_${length}`} name={`${length} m`} stroke={[COLORS.lime, COLORS.teal, COLORS.orange, COLORS.gray][index % 4]} strokeWidth={2} />)}</LineChart></ResponsiveContainer></ChartCard>
                    <ChartCard title="Participación por estado de madera"><ResponsiveContainer><BarChart data={chartData.wood_percent}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis unit="%" /><Tooltip /><Legend />{woodKeys.map((state, index) => <Bar key={state} dataKey={state} stackId="wood-percent" fill={[COLORS.teal, COLORS.orange, COLORS.gray, COLORS.lime][index % 4]} />)}</BarChart></ResponsiveContainer></ChartCard>
                </div>
            )}

            <div className="ga-card">
                <div className="ga-card__header"><h2 className="ga-card__title" style={{ fontSize: '1rem' }}><FileSpreadsheet size={18} /> Historial de importaciones</h2></div>
                <div className="ga-card__body" style={{ overflowX: 'auto' }}>
                    <table className="ga-table"><thead><tr><th>Archivo</th><th>Leídos</th><th>Insertados</th><th>Duplicados</th><th>Inválidos</th><th>Estado</th></tr></thead><tbody>{imports.map((item) => <tr key={item.id}><td>{item.filename}</td><td>{item.rows_read}</td><td>{item.rows_inserted}</td><td>{item.duplicates_skipped}</td><td>{item.invalid_rows}</td><td>{item.status}</td></tr>)}</tbody></table>
                </div>
            </div>
        </div>
    );
};

export default RollizosReport;
