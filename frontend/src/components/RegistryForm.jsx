import { useState, useEffect } from 'react';
import { getMarkets, createInspection } from '../api';
import { useAuth } from '../context/AuthContext';

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
        <div className="p-8 bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-2xl max-w-lg mx-auto text-slate-100 border border-slate-700/50">
            <h2 className="text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                Nueva Inspección
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2 text-slate-400">Turno</label>
                        <input
                            type="text" name="shift" value={formData.shift} onChange={handleChange} required
                            className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="ej. Turno 1"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2 text-slate-400">Supervisor</label>
                        <input
                            type="text" name="supervisor" value={formData.supervisor} readOnly
                            className="w-full p-3 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-400 cursor-not-allowed"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2 text-slate-400">Producto</label>
                    <input
                        type="text" name="product_name" value={formData.product_name} onChange={handleChange} required
                        className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none transition-all"
                        placeholder="Nombre del Producto"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2 text-slate-400">Mercado</label>
                    <select
                        name="market_id"
                        value={formData.market_id}
                        onChange={handleChange}
                        required
                        className="w-full p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-emerald-500 outline-none transition-all"
                    >
                        <option value="">Seleccionar Mercado</option>
                        {markets.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>

                <button
                    type="submit"
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-semibold shadow-lg shadow-emerald-900/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    Crear Inspección
                </button>
            </form>
        </div>
    );
}
