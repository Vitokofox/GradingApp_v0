
import { useState, useEffect } from 'react';
import { getMarkets, createInspection } from '../api';
import { useAuth } from '../context/AuthContext';
import { Plus, Briefcase, User, Clock, Package } from 'lucide-react';

export default function RegistryForm() {
    const { user } = useAuth();
    const [markets, setMarkets] = useState([]);
    const [formData, setFormData] = useState({
        shift: '',
        supervisor: '',
        product_name: '',
        market_id: '',
    });

    useEffect(() => {
        getMarkets().then(setMarkets).catch(console.error);
        if (user) {
            setFormData(prev => ({
                ...prev,
                supervisor: `${user.first_name} ${user.last_name}`
            }));
        }
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await createInspection(formData);
            alert('¡Inspección registrada exitosamente!');
            // Reset form but keep supervisor
            setFormData({
                shift: '',
                supervisor: `${user.first_name} ${user.last_name}`,
                product_name: '',
                market_id: ''
            });
        } catch (error) {
            console.error(error);
            alert('Error al registrar la inspección');
        }
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
            <div className="ga-card">
                <div className="ga-card__header">
                    <h2 className="ga-card__title" style={{ background: 'linear-gradient(to right, #34d399, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={24} className="u-success" style={{ WebkitTextFillColor: 'initial' }} />
                        Nueva Inspección Simple
                    </h2>
                </div>

                <div className="ga-card__body">
                    <form onSubmit={handleSubmit} className="ga-stack">
                        <div className="ga-grid ga-grid--2">
                            <div>
                                <label className="ga-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Clock size={14} className="u-muted" /> Turno
                                </label>
                                <input
                                    type="text" name="shift" value={formData.shift} onChange={handleChange} required
                                    className="ga-control"
                                    placeholder="ej. Turno 1"
                                />
                            </div>
                            <div>
                                <label className="ga-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <User size={14} className="u-muted" /> Supervisor
                                </label>
                                <input
                                    type="text" name="supervisor" value={formData.supervisor} readOnly
                                    className="ga-control"
                                    style={{ opacity: 0.7, cursor: 'not-allowed' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="ga-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Package size={14} className="u-muted" /> Producto
                            </label>
                            <input
                                type="text" name="product_name" value={formData.product_name} onChange={handleChange} required
                                className="ga-control"
                                placeholder="Nombre del Producto"
                            />
                        </div>

                        <div>
                            <label className="ga-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Briefcase size={14} className="u-muted" /> Mercado
                            </label>
                            <select
                                name="market_id"
                                value={formData.market_id}
                                onChange={handleChange}
                                required
                                className="ga-select"
                            >
                                <option value="">Seleccionar Mercado</option>
                                {markets.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="submit"
                            className="ga-btn ga-btn--primary"
                            style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
                        >
                            Crear Inspección
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
