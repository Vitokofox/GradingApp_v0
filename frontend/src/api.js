import axios from 'axios';

// Asegurar que axios use la misma configuración definida en la lógica de AuthContext si se importa allí,
// pero dado que AuthContext establece valores por defecto globales, importar axios aquí comparte esa configuración.

const api = axios.create({
    baseURL: 'http://localhost:8000',
});

// Interceptor para asegurar que usamos el último token si está en localStorage (redundante si AuthContext establece globales, pero seguro)
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// API de Registro
export const getMarkets = async () => {
    const response = await api.get('/api/markets');
    return response.data;
};

export const createMarket = async (data) => {
    const response = await api.post('/master-data/markets', data);
    return response.data;
};

export const deleteMarket = async (id) => {
    const response = await api.delete(`/master-data/markets/${id}`);
    return response.data;
};

export const createInspection = async (data) => {
    const response = await api.post('/api/inspections', data);
    return response.data;
};

// API de Gestión de Usuarios
export const getUsers = async () => {
    const response = await api.get('/users/');
    return response.data;
};

export const createUser = async (userData) => {
    const response = await api.post('/users/', userData);
    return response.data;
};

export const updateUser = async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
};

export const deleteUser = async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
};

// --- Datos Maestros ---

export const getCatalogItems = async (category) => {
    const response = await api.get(`/master-data/catalogs/${category}`);
    return response.data;
};

export const createCatalogItem = async (data) => {
    const response = await api.post('/master-data/catalogs', data);
    return response.data;
};

export const deleteCatalogItem = async (id) => {
    const response = await api.delete(`/master-data/catalogs/${id}`);
    return response.data;
};

export const getDefects = async () => {
    const response = await api.get('/master-data/defects');
    return response.data;
};

export const createDefect = async (data) => {
    const response = await api.post('/master-data/defects', data);
    return response.data;
};

export const deleteDefect = async (id) => {
    const response = await api.delete(`/master-data/defects/${id}`);
    return response.data;
};

export const uploadMasterData = async (type, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/master-data/upload?type=${type}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

// --- Jerarquía de Clasificación ---

export const getProducts = async () => {
    const response = await api.get('/master-data/products');
    return response.data;
};

export const createProduct = async (data) => {
    const response = await api.post('/master-data/products', data);
    return response.data;
};

export const deleteProduct = async (id) => {
    const response = await api.delete(`/master-data/products/${id}`);
    return response.data;
};

export const getGradesByProduct = async (productId) => {
    const response = await api.get(`/master-data/products/${productId}/grades`);
    return response.data;
};

export const createGrade = async (data) => {
    const response = await api.post('/master-data/grades', data);
    return response.data;
};

export const deleteGrade = async (id) => {
    const response = await api.delete(`/master-data/grades/${id}`);
    return response.data;
};

export const getDefectsByGrade = async (gradeId) => {
    const response = await api.get(`/master-data/grades/${gradeId}/defects`);
    return response.data;
};

export const addDefectToGrade = async (gradeId, defectId) => {
    const response = await api.post('/master-data/grades/defects', { grade_id: gradeId, defect_id: defectId });
    return response.data;
};

export const removeDefectFromGrade = async (gradeId, defectId) => {
    const response = await api.delete(`/master-data/grades/${gradeId}/defects/${defectId}`);
    return response.data;
};

export const getInspection = async (id) => {
    const response = await api.get(`/api/inspections/${id}`);
    return response.data;
};

export const addInspectionResult = async (inspectionId, gradeId, defectId, count) => {
    const response = await api.post(`/api/inspections/${inspectionId}/results`, {
        grade_id: gradeId,
        defect_id: defectId,
        pieces_count: count
    });
    return response.data;
};

export const getInspectionResults = async (inspectionId) => {
    const response = await api.get(`/api/inspections/${inspectionId}/results`);
    return response.data;
};

export const getInspectionsList = async () => {
    const response = await api.get('/api/inspections');
    return response.data;
};

export const deleteInspection = async (id) => {
    const response = await api.delete(`/api/inspections/${id}`);
    return response.data;
};

export const updateInspection = async (id, data) => {
    try {
        const response = await api.put(`/inspections/${id}`, data);
        return response.data;
    } catch (error) {
        console.error("Error updating inspection", error);
        throw error;
    }
};

export const updateInspectionResult = async (resultId, piecesCount) => {
    try {
        const response = await api.put(`/inspection-results/${resultId}`, { pieces_count: parseInt(piecesCount) });
        return response.data;
    } catch (error) {
        console.error("Error updating inspection result", error);
        throw error;
    }
};

// --- API de Estudio de Escáner ---

export const createScannerStep = async (data) => {
    const response = await api.post('/api/scanner/steps', data);
    return response.data;
};

export const getScannerSteps = async () => {
    const response = await api.get('/api/scanner/steps');
    return response.data;
};

export const getScannerStep = async (id) => {
    const response = await api.get(`/api/scanner/steps/${id}`);
    return response.data;
};

export const addScannerItem = async (stepId, data) => {
    const response = await api.post(`/api/scanner/steps/${stepId}/items`, data);
    return response.data;
};

export const getScannerStats = async (stepId) => {
    const response = await api.get(`/api/scanner/steps/${stepId}/stats`);
    return response.data;
};

export const downloadInspectionsCsv = async (filters) => {
    try {
        const response = await api.get('/api/exports/inspections/csv', {
            params: filters,
            responseType: 'blob', // Important
        });

        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const filename = response.headers['content-disposition']?.split('filename=')[1] || 'inspections.csv';
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (error) {
        console.error("Export error", error);
    }
};

export const downloadTemplate = async () => {
    try {
        const response = await api.get('/api/exports/template/csv', {
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'plantilla_carga_masiva.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (error) {
        console.error("Template download error", error);
    }
};

export const syncInspectionResults = async (inspectionId, results) => {
    try {
        const response = await api.post(`/api/inspections/${inspectionId}/sync_results`, results);
        return response.data;
    } catch (error) {
        console.error("Error syncing inspection results", error);
        throw error;
    }
};

export default api;


