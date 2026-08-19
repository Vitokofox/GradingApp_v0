import { Bar, BarChart, CartesianGrid, Label, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { calculateMoistureDistribution } from '../utils/moistureCalculations';
import './MoistureHistogram.css';

const decimalFormatter = new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'medium',
});

function formatDateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : dateTimeFormatter.format(date);
}

export default function MoistureHistogram({ readings = [] }) {
    const distribution = calculateMoistureDistribution(readings);

    if (distribution.count === 0) {
        return <div className="moisture-report moisture-report--empty">Sin registros de humedad</div>;
    }

    const summary = [
        ['Muestras', distribution.count.toLocaleString('es-CL')],
        ['Mínimo', `${decimalFormatter.format(distribution.min)}%`],
        ['Máximo', `${decimalFormatter.format(distribution.max)}%`],
        ['Promedio', `${decimalFormatter.format(distribution.mean)}%`],
        ['Desv. estándar', `${decimalFormatter.format(distribution.standardDeviation)}%`],
    ];

    return (
        <section className="moisture-report">
            <h2 className="moisture-report__title">Distribución de Humedad</h2>

            <div className="moisture-report__summary">
                {summary.map(([label, value]) => (
                    <div className="moisture-report__stat" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                    </div>
                ))}
            </div>

            <div className="moisture-report__chart">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribution.bins} margin={{ top: 24, right: 16, bottom: 34, left: 14 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe4ee" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }}>
                            <Label value="% Humedad" position="insideBottom" offset={-22} />
                        </XAxis>
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }}>
                            <Label value="Muestras" angle={-90} position="insideLeft" />
                        </YAxis>
                        <Tooltip formatter={(value) => [value, 'Muestras']} labelFormatter={(label) => `Humedad: ${label} a <${Number.parseInt(label, 10) + 1}%`} />
                        <Bar dataKey="count" fill="#2563a6" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                            <LabelList dataKey="count" position="top" formatter={value => value || ''} fill="#1e3a5f" fontSize={11} fontWeight={700} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="moisture-report__table-wrap">
                <table className="moisture-report__table">
                    <thead>
                        <tr>
                            <th>Registro</th>
                            <th>Humedad</th>
                            <th>Fecha-Hora</th>
                        </tr>
                    </thead>
                    <tbody>
                        {distribution.readings.map(reading => (
                            <tr key={`${reading.device_record_number}-${reading.moisture_percent}`}>
                                <td>{reading.device_record_number}</td>
                                <td>{decimalFormatter.format(reading.moisture_percent)}%</td>
                                <td>{formatDateTime(reading.captured_at)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
