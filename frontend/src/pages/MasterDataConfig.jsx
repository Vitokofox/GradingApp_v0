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
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 h-full flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-400" />
                {title}
            </h3>

            <div className="flex-1 overflow-y-auto min-h-[150px] mb-4 space-y-2 pr-2 custom-scrollbar">
                {loading ? (
                    <div className="text-slate-500 text-sm text-center italic">Cargando...</div>
                ) : items.length === 0 ? (
                    <div className="text-slate-500 text-sm text-center italic">No hay ítems registrados</div>
                ) : (
                    <AnimatePresence>
                        {items.map(item => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg group"
                            >
                                <span className="text-slate-300 text-sm">{item.name}</span>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-800 rounded"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            <form onSubmit={handleAdd} className="flex gap-2">
                <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Nuevo ítem..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-purple-500 outline-none"
                />
                <button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </form>
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
    const [searchTerm, setSearchTerm] = useState(''); // New search state

    const [newProductName, setNewProductName] = useState('');
    const [newGradeName, setNewGradeName] = useState('');
    const [newGradeRank, setNewGradeRank] = useState(1);

    // Load Initial Data
    useEffect(() => {
        loadProducts();
        loadAllDefects();
    }, []);

    // Load Grades when Product selected
    useEffect(() => {
        if (selectedProduct) {
            loadGrades(selectedProduct.id);
            setSelectedGrade(null);
            setAssignedDefects([]);
        }
    }, [selectedProduct]);

    // Load Defects when Grade selected
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            {/* Column 1: Products */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-col">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><LayoutList className="w-5 h-5 text-blue-400" /> Productos</h3>
                <div className="flex-1 overflow-y-auto mb-4 space-y-2 custom-scrollbar">
                    {products.map(p => (
                        <div key={p.id}
                            onClick={() => setSelectedProduct(p)}
                            className={`p-3 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${selectedProduct?.id === p.id ? 'bg-blue-600/20 border border-blue-500/50' : 'bg-slate-900/50 hover:bg-slate-800'}`}>
                            <span className="text-slate-200">{p.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(p.id); }} className="text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
                <form onSubmit={handleCreateProduct} className="flex gap-2">
                    <input value={newProductName} onChange={e => setNewProductName(e.target.value)} placeholder="Nuevo Producto..." className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white" />
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded"><Plus className="w-4 h-4" /></button>
                </form>
            </div>

            {/* Column 2: Grades (Cascadas) */}
            <div className={`bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-col transition-opacity ${!selectedProduct ? 'opacity-50 pointer-events-none' : ''}`}>
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Layers className="w-5 h-5 text-purple-400" /> Cascadas (Grados)</h3>
                {!selectedProduct ? <div className="text-slate-500 text-sm italic text-center mt-10">Selecciona un producto</div> : (
                    <>
                        <div className="flex-1 overflow-y-auto mb-4 space-y-2 custom-scrollbar">
                            {grades.sort((a, b) => a.grade_rank - b.grade_rank).map(g => (
                                <div key={g.id}
                                    onClick={() => setSelectedGrade(g)}
                                    className={`p-3 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${selectedGrade?.id === g.id ? 'bg-purple-600/20 border border-purple-500/50' : 'bg-slate-900/50 hover:bg-slate-800'}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded">{g.grade_rank}</span>
                                        <span className="text-slate-200">{g.name}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteGrade(g.id); }} className="text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleCreateGrade} className="flex gap-2 items-center">
                            <input type="number" value={newGradeRank} onChange={e => setNewGradeRank(e.target.value)} className="w-12 bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white text-center" title="Rango" />
                            <input value={newGradeName} onChange={e => setNewGradeName(e.target.value)} placeholder="Nombre Grado..." className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white" />
                            <button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded"><Plus className="w-4 h-4" /></button>
                        </form>
                    </>
                )}
            </div>

            {/* Column 3: Defects Assignment */}
            <div className={`bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-col transition-opacity ${!selectedGrade ? 'opacity-50 pointer-events-none' : ''}`}>
                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><GitMerge className="w-5 h-5 text-emerald-400" /> Defectos Asociados</h3>
                {!selectedGrade ? <div className="text-slate-500 text-sm italic text-center mt-10">Selecciona una cascada</div> : (
                    <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                        {/* Search Bar */}
                        <div className="mb-2 relative">
                            <Search className="w-4 h-4 text-slate-500 absolute left-2 top-2.5" />
                            <input
                                type="text"
                                placeholder="Buscar defecto..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-emerald-500"
                            />
                        </div>

                        <p className="text-xs text-slate-400 mb-2">Selecciona los defectos que aplican a <span className="text-emerald-400 font-semibold">{selectedGrade.name}</span>:</p>
                        {allDefects
                            .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
                            .map(defect => {
                                const isAssigned = assignedDefects.some(d => d.id === defect.id);
                                return (
                                    <div key={defect.id}
                                        onClick={() => toggleDefectAssign(defect)}
                                        className={`p-2 rounded border cursor-pointer text-sm flex items-center gap-2 transition-all ${isAssigned ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100' : 'bg-slate-900/30 border-transparent text-slate-500 hover:bg-slate-800'}`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isAssigned ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                                            {isAssigned && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        {defect.name}
                                    </div>
                                )
                            })}
                    </div>
                )}
            </div>
        </div>
    );
};

const MasterDataConfig = () => {
    const [activeTab, setActiveTab] = useState('hierarchy'); // hierarchy, general, defects, upload

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

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
                    <Settings className="w-8 h-8 text-purple-500" />
                    Datos Maestros
                </h1>
                <p className="text-slate-400">Gestiona las listas desplegables, productos y reglas de clasificación.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-8 border-b border-slate-700/50 pb-1 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('hierarchy')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'hierarchy' ? 'border-purple-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                    Jerarquía (Productos/Cascadas)
                </button>
                <button
                    onClick={() => setActiveTab('defects')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'defects' ? 'border-purple-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                    Defectos y Rechazos
                </button>
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'general' ? 'border-purple-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                    Listas Generales
                </button>
                <button
                    onClick={() => setActiveTab('upload')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'upload' ? 'border-purple-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                    Carga Masiva
                </button>
            </div>

            <div className="min-h-[500px]">
                {activeTab === 'hierarchy' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <HierarchyManager />
                    </motion.div>
                )}

                {activeTab === 'general' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    >
                        {categories.map(cat => (
                            <ConfigSection key={cat.id} category={cat.id} title={cat.title} />
                        ))}
                    </motion.div>
                )}

                {activeTab === 'defects' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="max-w-xl mx-auto"
                    >
                        <ConfigSection type="defect" title="Catalogo Global de Defectos" />
                    </motion.div>
                )}

                {activeTab === 'upload' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="max-w-2xl mx-auto bg-slate-800/50 border border-slate-700 rounded-xl p-8"
                    >
                        <div className="text-center mb-8">
                            <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Carga Masiva de Datos</h3>
                            <p className="text-slate-400 text-sm">Sube archivos CSV para poblar las listas rápidamente.</p>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                                <h4 className="flex items-center gap-2 text-slate-300 font-semibold mb-2">
                                    <AlertCircle className="w-4 h-4 text-blue-400" /> Formato Requerido
                                </h4>
                                <p className="text-slate-400 text-sm mb-2">El archivo debe ser CSV delimitado por comas con las siguientes columnas:</p>
                                <ul className="list-disc list-inside text-slate-500 text-xs space-y-1 ml-2">
                                    <li><strong>Catálogo:</strong> category, name, active (opcional)</li>
                                    <li><strong>Defectos:</strong> name, description (opcional)</li>
                                </ul>
                                <button onClick={downloadTemplate} className="mt-4 text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                    <FileText className="w-3 h-3" /> Descargar Plantilla Ejemplo
                                </button>
                            </div>

                            <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-purple-500/50 transition-colors cursor-pointer bg-slate-900/20">
                                <input type="file" className="hidden" id="file-upload" />
                                <label htmlFor="file-upload" className="cursor-pointer">
                                    <span className="text-slate-400 text-sm block">Haz clic para seleccionar o arrastra un archivo aquí</span>
                                </label>
                            </div>

                            <button className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold shadow-lg">
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
