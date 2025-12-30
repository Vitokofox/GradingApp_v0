import React, { useEffect, useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    Shield, UserPlus, Edit2, Trash2, X, Search, Settings, User, Briefcase, Award
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
                const updated = await updateUser(editingUser.id, formData);
                setUsers(users.map(u => u.id === updated.id ? updated : u));
            } else {
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
        <div className="ga-page">
            {/* Header */}
            <div className="ga-card u-mb-4">
                <div className="ga-card__body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Shield className="u-muted" size={24} />
                            <h1 className="ga-card__title">Gestión de Usuarios</h1>
                        </div>
                        <p className="u-muted" style={{ margin: '0.25rem 0 0 2rem' }}>Administra accesos y permisos del personal</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link to="/admin/config">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="ga-btn ga-btn--outline"
                            >
                                <Settings size={18} style={{ marginRight: '0.5rem' }} />
                                Configuración
                            </motion.button>
                        </Link>
                        {canAdd && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => openModal()}
                                className="ga-btn ga-btn--primary"
                            >
                                <UserPlus size={18} style={{ marginRight: '0.5rem' }} />
                                Agregar Usuario
                            </motion.button>
                        )}
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="u-mb-4" style={{ position: 'relative' }}>
                <Search className="u-muted" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} size={18} />
                <input
                    type="text"
                    placeholder="Buscar por nombre, usuario o cargo..."
                    onChange={handleSearch}
                    className="ga-control"
                    style={{ paddingLeft: '2.5rem' }}
                />
            </div>

            {/* Table */}
            <div className="ga-card">
                <div className="ga-table-wrap">
                    <table className="ga-table">
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Cargo</th>
                                <th>Nivel / Rol</th>
                                <th>Proceso Destino</th>
                                <th className="u-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((u) => (
                                <motion.tr
                                    key={u.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%',
                                                backgroundColor: 'var(--ga-bg)', color: 'var(--ga-primary)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 'bold', fontSize: '12px', border: '1px solid var(--ga-border)'
                                            }}>
                                                {u.first_name?.[0]}{u.last_name?.[0]}
                                            </div>
                                            <div>
                                                <div className="u-bold">{u.first_name} {u.last_name}</div>
                                                <div className="u-muted" style={{ fontSize: '0.85em' }}>@{u.username}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Briefcase size={14} className="u-muted" />
                                            {u.position}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`ga-badge ${u.level === 'admin' ? 'ga-badge--error' : // Using error color for high privilege visibility? Or custom. Theme has warn/ok/error.
                                                u.level === 'assistant' ? 'ga-badge--warn' :
                                                    'ga-badge--ok'
                                            }`}>
                                            {u.level === 'admin' ? 'Administrador' : u.level === 'assistant' ? 'Asistente' : 'Usuario'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`ga-badge ${u.process_type === 'Verde' ? 'ga-badge--ok' : 'ga-badge--warn'}`}>
                                            {u.process_type}
                                        </span>
                                    </td>
                                    <td className="u-right">
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                            {canEdit && (
                                                <button
                                                    onClick={() => openModal(u)}
                                                    className="ga-btn ga-btn--sm ga-btn--ghost"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDelete(u.id)}
                                                    className="ga-btn ga-btn--sm ga-btn--ghost"
                                                    style={{ color: 'var(--ga-danger)' }}
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="u-center u-muted" style={{ padding: '2rem' }}>
                                        No se encontraron usuarios
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="ga-modal-backdrop">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="ga-modal"
                        >
                            <div className="ga-modal__header">
                                <span>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</span>
                                <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div className="ga-modal__content ga-stack">
                                    <div className="ga-grid ga-grid--2">
                                        <div>
                                            <label className="ga-label">Nombre</label>
                                            <input className="ga-control"
                                                name="first_name" value={formData.first_name} onChange={handleChange} required />
                                        </div>
                                        <div>
                                            <label className="ga-label">Apellido</label>
                                            <input className="ga-control"
                                                name="last_name" value={formData.last_name} onChange={handleChange} required />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="ga-label">Cargo</label>
                                        <input className="ga-control"
                                            name="position" value={formData.position} onChange={handleChange} required />
                                    </div>

                                    <div>
                                        <label className="ga-label">Usuario</label>
                                        <input className="ga-control"
                                            name="username" value={formData.username} onChange={handleChange} required
                                            readOnly={!!editingUser}
                                        />
                                    </div>

                                    <div>
                                        <label className="ga-label">
                                            {editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña'}
                                        </label>
                                        <input className="ga-control"
                                            type="password" name="password" value={formData.password} onChange={handleChange}
                                            required={!editingUser}
                                        />
                                    </div>

                                    <div className="ga-grid ga-grid--2">
                                        <div>
                                            <label className="ga-label">Nivel / Rol</label>
                                            <select className="ga-select"
                                                name="level" value={formData.level} onChange={handleChange} disabled={!canChangePermissions}>
                                                <option value="user">Usuario</option>
                                                <option value="assistant">Asistente</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="ga-label">Proceso</label>
                                            <select className="ga-select"
                                                name="process_type" value={formData.process_type} onChange={handleChange} disabled={!canChangePermissions}>
                                                <option value="Verde">Verde</option>
                                                <option value="Seco">Seco</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="ga-modal__footer">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="ga-btn ga-btn--outline">
                                        Cancelar
                                    </button>
                                    <button type="submit" className="ga-btn ga-btn--primary">
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
