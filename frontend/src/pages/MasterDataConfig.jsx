import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    getCatalogItems, createCatalogItem, deleteCatalogItem,
    getDefects, createDefect, deleteDefect, uploadMasterData,
    getProducts, createProduct, deleteProduct,
    getGradesByProduct, createGrade, deleteGrade,
    getDefectsByGrade, addDefectToGrade, removeDefectFromGrade,
    getMarkets, createMarket, deleteMarket, downloadTemplate
} from '../api';
import {
    Settings, Plus, Trash2, Upload, FileText, Check, AlertCircle, Database,
    ChevronRight, Layers, LayoutList, GitMerge, Search, Download
} from 'lucide-react';

const ConfigSection = ({ title, category, type = 'catalog' }) => {
    const [items, setItems] = useState([]);
    const [newItem, setNewItem] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchItems = async () => {
        setLoading(true);
        try {
            if (type === 'defect') {
                const data = await getDefects();
                setItems(data);
            } else if (category === 'market') {
                const data = await getMarkets();
                setItems(data);
            } else {
                const data = await getCatalogItems(category);
                setItems(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [category]);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newItem.trim()) return;
        try {
            if (type === 'defect') {
                const created = await createDefect({ name: newItem });
                setItems([...items, created]);
            } else if (category === 'market') {
                const created = await createMarket({ name: newItem });
                setItems([...items, created]);
            } else {
                const created = await createCatalogItem({ category, name: newItem });
                setItems([...items, created]);
            }
            setNewItem('');
        } catch (error) {
            alert('Error creating item');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar ítem?')) return;
        try {
            if (type === 'defect') {
                await deleteDefect(id);
            } else if (category === 'market') {
                await deleteMarket(id);
            } else {
                await deleteCatalogItem(id);
            }
            setItems(items.filter(i => i.id !== id));
        } catch (error) {
            alert('Error deleting item');
        }
    };

    return (
        <div className="ga-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="ga-card__body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 className="ga-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Database size={16} className="u-muted" />
                    {title}
                </h3>

                <div className="ga-scrollbar" style={{ flex: 1, overflowY: 'auto', minHeight: '150px' }}>
                    {loading ? (
                        <div className="u-center u-muted u-italic" style={{ fontSize: '0.875rem' }}>Cargando...</div>
                    ) : items.length === 0 ? (
                        <div className="u-center u-muted u-italic" style={{ fontSize: '0.875rem' }}>No hay ítems registrados</div>
                    ) : (
                        <AnimatePresence>
                            <div className="ga-stack" style={{ gap: '0.5rem' }}>
                                {items.map(item => (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '0.5rem', background: 'var(--ga-bg)', borderRadius: 'var(--ga-radius-sm)'
                                        }}
                                        className="group"
                                    >
                                        <span style={{ fontSize: '0.875rem' }}>{item.name}</span>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            style={{ color: 'var(--ga-danger)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                                            title="Eliminar"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        </AnimatePresence>
                    )}
                </div>

                <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        placeholder="Nuevo ítem..."
                        className="ga-control"
                        style={{ flex: 1, fontSize: '0.875rem', padding: '0.4rem 0.5rem' }}
                    />
                    <button
                        type="submit"
                        className="ga-btn ga-btn--primary"
                        style={{ padding: '0.4rem 0.6rem' }}
                    >
                        <Plus size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
};

const HierarchyManager = () => {
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [grades, setGrades] = useState([]);
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [assignedDefects, setAssignedDefects] = useState([]);
    const [allDefects, setAllDefects] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [newProductName, setNewProductName] = useState('');
    const [newGradeName, setNewGradeName] = useState('');
    const [newGradeRank, setNewGradeRank] = useState(1);

    useEffect(() => {
        loadProducts();
        loadAllDefects();
    }, []);

    useEffect(() => {
        if (selectedProduct) {
            loadGrades(selectedProduct.id);
            setSelectedGrade(null);
            setAssignedDefects([]);
        }
    }, [selectedProduct]);

    useEffect(() => {
        if (selectedGrade) {
            loadAssignedDefects(selectedGrade.id);
        }
    }, [selectedGrade]);

    const loadProducts = async () => setProducts(await getProducts());
    const loadAllDefects = async () => setAllDefects(await getDefects());
    const loadGrades = async (pid) => setGrades(await getGradesByProduct(pid));
    const loadAssignedDefects = async (gid) => setAssignedDefects(await getDefectsByGrade(gid));

    const handleCreateProduct = async (e) => {
        e.preventDefault();
        if (!newProductName) return;
        try {
            await createProduct({ name: newProductName });
            setNewProductName('');
            loadProducts();
        } catch (error) {
            console.error(error);
            alert("Error al crear producto");
        }
    };

    const handleDeleteProduct = async (id) => {
        if (!window.confirm('Al eliminar un producto se eliminarán sus grados. ¿Continuar?')) return;
        try {
            await deleteProduct(id);
            if (selectedProduct?.id === id) setSelectedProduct(null);
            loadProducts();
        } catch (error) {
            console.error(error);
            alert("Error al eliminar producto");
        }
    };

    const handleCreateGrade = async (e) => {
        e.preventDefault();
        if (!newGradeName) return;
        try {
            await createGrade({
                product_id: selectedProduct.id,
                name: newGradeName,
                grade_rank: parseInt(newGradeRank)
            });
            setNewGradeName('');
            loadGrades(selectedProduct.id);
        } catch (error) {
            console.error(error);
            alert(`Error al crear grado: ${error.response?.data?.detail || error.message}`);
        }
    };

    const handleDeleteGrade = async (id) => {
        if (!window.confirm('¿Eliminar grado?')) return;
        try {
            await deleteGrade(id);
            if (selectedGrade?.id === id) setSelectedGrade(null);
            loadGrades(selectedProduct.id);
        } catch (error) {
            console.error(error);
            alert("Error al eliminar grado");
        }
    };

    const toggleDefectAssign = async (defect) => {
        if (!selectedGrade) return;
        const isAssigned = assignedDefects.some(d => d.id === defect.id);

        try {
            if (isAssigned) {
                await removeDefectFromGrade(selectedGrade.id, defect.id);
                setAssignedDefects(assignedDefects.filter(d => d.id !== defect.id));
            } else {
                await addDefectToGrade(selectedGrade.id, defect.id);
                setAssignedDefects([...assignedDefects, defect]);
            }
        } catch (error) {
            alert('Error actualizando asignación');
        }
    };

    return (
        <div className="ga-grid ga-grid--3" style={{ height: '600px' }}>
            {/* Column 1: Products */}
            <div className="ga-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="ga-card__body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 className="ga-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <LayoutList size={20} className="u-muted" /> Productos
                    </h3>

                    <div className="ga-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                        <div className="ga-stack" style={{ gap: '0.5rem' }}>
                            {products.map(p => (
                                <div key={p.id}
                                    onClick={() => setSelectedProduct(p)}
                                    style={{
                                        padding: '0.75rem',
                                        borderRadius: 'var(--ga-radius-sm)',
                                        cursor: 'pointer',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        backgroundColor: selectedProduct?.id === p.id ? 'var(--ga-bg)' : 'transparent',
                                        border: selectedProduct?.id === p.id ? '1px solid var(--ga-accent)' : '1px solid transparent',
                                        color: selectedProduct?.id === p.id ? 'var(--ga-accent)' : 'inherit'
                                    }}
                                >
                                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(p.id); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ga-danger)' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <form onSubmit={handleCreateProduct} style={{ display: 'flex', gap: '0.5rem' }}>
                        <input value={newProductName} onChange={e => setNewProductName(e.target.value)} placeholder="Nuevo Producto..." className="ga-control" style={{ flex: 1 }} />
                        <button type="submit" className="ga-btn ga-btn--primary"><Plus size={16} /></button>
                    </form>
                </div>
            </div>

            {/* Column 2: Grades */}
            <div className="ga-card" style={{ display: 'flex', flexDirection: 'column', opacity: !selectedProduct ? 0.5 : 1, pointerEvents: !selectedProduct ? 'none' : 'auto' }}>
                <div className="ga-card__body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 className="ga-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Layers size={20} className="u-muted" /> Cascadas (Grados)
                    </h3>

                    {!selectedProduct ? (
                        <div className="u-center u-muted u-italic" style={{ marginTop: '2rem' }}>Selecciona un producto</div>
                    ) : (
                        <>
                            <div className="ga-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                                <div className="ga-stack" style={{ gap: '0.5rem' }}>
                                    {grades.sort((a, b) => a.grade_rank - b.grade_rank).map(g => (
                                        <div key={g.id}
                                            onClick={() => setSelectedGrade(g)}
                                            style={{
                                                padding: '0.75rem',
                                                borderRadius: 'var(--ga-radius-sm)',
                                                cursor: 'pointer',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                backgroundColor: selectedGrade?.id === g.id ? 'var(--ga-bg)' : 'transparent',
                                                border: selectedGrade?.id === g.id ? '1px solid var(--ga-accent)' : '1px solid transparent',
                                                color: selectedGrade?.id === g.id ? 'var(--ga-accent)' : 'inherit'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{
                                                    background: 'var(--ga-bg)', padding: '0.1rem 0.4rem',
                                                    borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold'
                                                }}>{g.grade_rank}</span>
                                                <span style={{ fontWeight: 500 }}>{g.name}</span>
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteGrade(g.id); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ga-danger)' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <form onSubmit={handleCreateGrade} style={{ display: 'flex', gap: '0.5rem' }}>
                                <input type="number" value={newGradeRank} onChange={e => setNewGradeRank(e.target.value)} className="ga-control" style={{ width: '60px', textAlign: 'center' }} title="Rango" />
                                <input value={newGradeName} onChange={e => setNewGradeName(e.target.value)} placeholder="Nombre Grado..." className="ga-control" style={{ flex: 1 }} />
                                <button type="submit" className="ga-btn ga-btn--primary"><Plus size={16} /></button>
                            </form>
                        </>
                    )}
                </div>
            </div>

            {/* Column 3: Defects */}
            <div className="ga-card" style={{ display: 'flex', flexDirection: 'column', opacity: !selectedGrade ? 0.5 : 1, pointerEvents: !selectedGrade ? 'none' : 'auto' }}>
                <div className="ga-card__body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 className="ga-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <GitMerge size={20} className="u-muted" /> Defectos Asociados
                    </h3>

                    {!selectedGrade ? (
                        <div className="u-center u-muted u-italic" style={{ marginTop: '2rem' }}>Selecciona una cascada</div>
                    ) : (
                        <div className="ga-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ position: 'relative' }}>
                                <Search className="u-muted" size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="text"
                                    placeholder="Buscar defecto..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="ga-control"
                                    style={{ paddingLeft: '1.75rem', fontSize: '0.875rem', paddingBlock: '0.35rem' }}
                                />
                            </div>

                            <p className="u-muted" style={{ fontSize: '0.75rem' }}>
                                Selecciona los defectos que aplican a <b style={{ color: 'var(--ga-accent)' }}>{selectedGrade.name}</b>:
                            </p>

                            <div className="ga-stack" style={{ gap: '0.25rem' }}>
                                {allDefects
                                    .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map(defect => {
                                        const isAssigned = assignedDefects.some(d => d.id === defect.id);
                                        return (
                                            <div key={defect.id}
                                                onClick={() => toggleDefectAssign(defect)}
                                                style={{
                                                    padding: '0.5rem',
                                                    borderRadius: 'var(--ga-radius-sm)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.875rem',
                                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                    backgroundColor: isAssigned ? 'rgba(46, 125, 50, 0.1)' : 'transparent',
                                                    border: isAssigned ? '1px solid var(--ga-success)' : '1px solid transparent',
                                                    color: isAssigned ? 'var(--ga-success)' : 'var(--ga-text)'
                                                }}
                                                className={!isAssigned ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : ''}
                                            >
                                                <div style={{
                                                    width: '16px', height: '16px', borderRadius: '4px', border: '1px solid',
                                                    borderColor: isAssigned ? 'var(--ga-success)' : 'var(--ga-muted)',
                                                    background: isAssigned ? 'var(--ga-success)' : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    {isAssigned && <Check size={12} color="white" />}
                                                </div>
                                                {defect.name}
                                            </div>
                                        )
                                    })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const MasterDataConfig = () => {
    const [activeTab, setActiveTab] = useState('hierarchy');

    const categories = [
        { id: 'area', title: 'Áreas' },
        { id: 'machine', title: 'Máquinas' },
        { id: 'shift', title: 'Turnos' },
        { id: 'journey', title: 'Jornadas' },
        { id: 'origin', title: 'Orígenes' },
        { id: 'state', title: 'Estados' },
        { id: 'termination', title: 'Terminaciones' },
        { id: 'market', title: 'Mercado' },
        { id: 'supervisor', title: 'Supervisores' },
        { id: 'length', title: 'Largos Configurados' },
    ];

    const tabStyle = (tabName) => ({
        padding: '0.5rem 1rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        background: 'transparent',
        border: 'none',
        borderBottom: activeTab === tabName ? '2px solid var(--ga-accent)' : '2px solid transparent',
        color: activeTab === tabName ? 'var(--ga-text)' : 'var(--ga-muted)',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
    });

    return (
        <div className="ga-page">
            <div className="u-mb-4">
                <h1 className="u-flex" style={{ alignItems: 'center', gap: '1rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    <Settings className="u-muted" size={28} />
                    Datos Maestros
                </h1>
                <p className="u-muted" style={{ marginLeft: '3rem' }}>Gestiona las listas desplegables, productos y reglas de clasificación.</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--ga-border)', overflowX: 'auto' }}>
                <button onClick={() => setActiveTab('hierarchy')} style={tabStyle('hierarchy')}>Jerarquía (Productos/Cascadas)</button>
                <button onClick={() => setActiveTab('defects')} style={tabStyle('defects')}>Defectos y Rechazos</button>
                <button onClick={() => setActiveTab('general')} style={tabStyle('general')}>Listas Generales</button>
                <button onClick={() => setActiveTab('upload')} style={tabStyle('upload')}>Carga Masiva</button>
            </div>

            <div style={{ minHeight: '500px' }}>
                {activeTab === 'hierarchy' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <HierarchyManager />
                    </motion.div>
                )}

                {activeTab === 'general' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="ga-grid ga-grid--3"
                    >
                        {categories.map(cat => (
                            <ConfigSection key={cat.id} category={cat.id} title={cat.title} />
                        ))}
                    </motion.div>
                )}

                {activeTab === 'defects' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        style={{ maxWidth: '600px', margin: '0 auto' }}
                    >
                        <ConfigSection type="defect" title="Catalogo Global de Defectos" />
                    </motion.div>
                )}

                {activeTab === 'upload' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="ga-card"
                        style={{ maxWidth: '600px', margin: '0 auto' }}
                    >
                        <div className="ga-card__body u-center">
                            <Upload size={48} className="u-muted u-mb-4" style={{ margin: '0 auto' }} />
                            <h3 className="ga-card__title u-mb-2">Carga Masiva de Datos</h3>
                            <p className="u-muted u-mb-4">Sube archivos CSV para poblar las listas rápidamente.</p>

                            <div className="ga-alert ga-alert--info" style={{ textAlign: 'left' }}>
                                <div>
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                                        <AlertCircle size={16} /> Formato Requerido
                                    </h4>
                                    <ul style={{ fontSize: '0.75rem', marginTop: '0.5rem', paddingLeft: '1rem' }}>
                                        <li><strong>Catálogo:</strong> category, name, active (opcional)</li>
                                        <li><strong>Defectos:</strong> name, description (opcional)</li>
                                    </ul>
                                    <button onClick={downloadTemplate} style={{ background: 'none', border: 'none', color: 'var(--ga-accent)', fontSize: '0.75rem', cursor: 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <FileText size={12} /> Descargar Plantilla Ejemplo
                                    </button>
                                </div>
                            </div>

                            <div style={{ border: '2px dashed var(--ga-border)', borderRadius: 'var(--ga-radius-md)', padding: '2rem', cursor: 'pointer', marginBottom: '1rem' }}>
                                <input type="file" id="file-upload" style={{ display: 'none' }} />
                                <label htmlFor="file-upload" style={{ cursor: 'pointer', color: 'var(--ga-muted)' }}>
                                    Haz clic para seleccionar o arrastra un archivo aquí
                                </label>
                            </div>

                            <button className="ga-btn ga-btn--primary" style={{ width: '100%' }}>
                                Procesar Archivo
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default MasterDataConfig;
