
import React, { useEffect, useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    Users, Shield, UserPlus, Edit2, Trash2, X, Check, Search, Filter, Settings
} from 'lucide-react';

const AdminDashboard = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '', password: '', first_name: '', last_name: '',
        position: '', level: 'user', process_type: 'Verde'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => setSearchTerm(e.target.value.toLowerCase());

    const filteredUsers = users.filter(u =>
        u.first_name.toLowerCase().includes(searchTerm) ||
        u.last_name.toLowerCase().includes(searchTerm) ||
        u.username.toLowerCase().includes(searchTerm) ||
        u.position.toLowerCase().includes(searchTerm)
    );

    const openModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({ ...user, password: '' }); // Don't show hash
        } else {
            setEditingUser(null);
            setFormData({
                username: '', password: '', first_name: '', last_name: '',
                position: '', level: 'user', process_type: 'Verde'
            });
        }
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este usuario?')) {
            try {
                await deleteUser(id);
                setUsers(users.filter(u => u.id !== id));
            } catch (error) {
                alert('Eror al eliminar usuario');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                // Update
                const updated = await updateUser(editingUser.id, formData);
                setUsers(users.map(u => u.id === updated.id ? updated : u));
            } else {
                // Create
                const created = await createUser(formData);
                setUsers([...users, created]);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Save error", error);
            alert("Error al guardar usuario. Verifique los datos.");
        }
    };

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    // Permissions Logic
    const canAdd = currentUser?.level === 'admin';
    const canEdit = currentUser?.level === 'admin' || currentUser?.level === 'assistant';
    const canDelete = currentUser?.level === 'admin';
    const canChangePermissions = currentUser?.level === 'admin';

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Shield className="w-8 h-8 text-purple-500" />
                        Gestión de Usuarios
                    </h1>
                    <p className="text-slate-400 mt-1">Administra accesos y permisos del personal</p>
                </div>
                <div className="flex gap-3">
                    <Link to="/admin/config">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-6 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl shadow-lg flex items-center gap-2 font-semibold hover:bg-slate-700"
                        >
                            <Settings className="w-5 h-5" />
                            Configuración
                        </motion.button>
                    </Link>
                    {canAdd && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => openModal()}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl shadow-lg flex items-center gap-2 font-semibold"
                        >
                            <UserPlus className="w-5 h-5" />
                            Agregar Usuario
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Buscar por nombre, usuario o cargo..."
                    onChange={handleSearch}
                    className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 outline-none"
                />
            </div>

            {/* Table */}
            <div className="bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-slate-300">
                        <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs font-semibold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Usuario</th>
                                <th className="px-6 py-4">Cargo</th>
                                <th className="px-6 py-4">Nivel</th>
                                <th className="px-6 py-4">Proceso</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {filteredUsers.map((u) => (
                                <motion.tr
                                    key={u.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="hover:bg-slate-700/30 transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-xs">
                                                {u.first_name[0]}{u.last_name[0]}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-white">{u.first_name} {u.last_name}</div>
                                                <div className="text-xs text-slate-500">@{u.username}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{u.position}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${u.level === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                u.level === 'assistant' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    'bg-green-500/10 text-green-400 border-green-500/20'
                                            }`}>
                                            {u.level === 'admin' ? 'Administrador' : u.level === 'assistant' ? 'Asistente' : 'Usuario'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${u.process_type === 'Verde' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            }`}>
                                            {u.process_type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {canEdit && (
                                                <button
                                                    onClick={() => openModal(u)}
                                                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDelete(u.id)}
                                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-white">
                                    {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs uppercase text-slate-500 font-semibold">Nombre</label>
                                        <input className="w-full mt-1 p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white outline-none focus:border-purple-500"
                                            name="first_name" value={formData.first_name} onChange={handleChange} required />
                                    </div>
                                    <div>
                                        <label className="text-xs uppercase text-slate-500 font-semibold">Apellido</label>
                                        <input className="w-full mt-1 p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white outline-none focus:border-purple-500"
                                            name="last_name" value={formData.last_name} onChange={handleChange} required />
                                    </div>
                                    <div>
                                        <label className="text-xs uppercase text-slate-500 font-semibold">Cargo</label>
                                        <input className="w-full mt-1 p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white outline-none focus:border-purple-500"
                                            name="position" value={formData.position} onChange={handleChange} required />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs uppercase text-slate-500 font-semibold">Usuario</label>
                                        <input className="w-full mt-1 p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white outline-none focus:border-purple-500"
                                            name="username" value={formData.username} onChange={handleChange} required
                                            readOnly={!!editingUser} // Prevent changing username on edit if desired, or allow it.
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs uppercase text-slate-500 font-semibold">
                                            {editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}
                                        </label>
                                        <input className="w-full mt-1 p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white outline-none focus:border-purple-500"
                                            type="password" name="password" value={formData.password} onChange={handleChange}
                                            required={!editingUser}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs uppercase text-slate-500 font-semibold">Nivel</label>
                                            <select className="w-full mt-1 p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white outline-none focus:border-purple-500"
                                                name="level" value={formData.level} onChange={handleChange} disabled={!canChangePermissions}>
                                                <option value="user">Usuario</option>
                                                <option value="assistant">Asistente</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs uppercase text-slate-500 font-semibold">Proceso</label>
                                            <select className="w-full mt-1 p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white outline-none focus:border-purple-500"
                                                name="process_type" value={formData.process_type} onChange={handleChange} disabled={!canChangePermissions}>
                                                <option value="Verde">Verde</option>
                                                <option value="Seco">Seco</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-2 pt-4 border-t border-slate-700 flex justify-end gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors">
                                        Cancelar
                                    </button>
                                    <button type="submit"
                                        className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg shadow-lg font-semibold hover:scale-105 transition-transform">
                                        {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminDashboard;
