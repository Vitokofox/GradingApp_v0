const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const wb = XLSX.utils.book_new();

const categories = [
    'shifts', 'journeys', 'areas', 'machines',
    'origins', 'states', 'terminations', 'supervisors',
    'markets', 'products', 'defects'
];

const sampleData = {
    shifts: [{ id: 'shift_1', name: 'Turno A', category: 'shift' }],
    journeys: [{ id: 'journey_1', name: 'Diurna', category: 'journey' }],
    areas: [{ id: 'area_1', name: 'Area Ejemplo' }],
    machines: [{ id: 'machine_1', name: 'Maquina Ejemplo' }],
    origins: [{ id: 'origin_1', name: 'Origen Ejemplo' }],
    states: [{ id: 'state_1', name: 'Estado Ejemplo' }],
    terminations: [{ id: 'term_1', name: 'Terminacion Ejemplo' }],
    supervisors: [{ id: 'sup_1', name: 'Supervisor Ejemplo' }],
    markets: [{ id: '1', name: 'Mercado Ejemplo' }],
    products: [{ id: '1', name: 'Producto Ejemplo' }],
    defects: [{ id: '1', name: 'Defecto Ejemplo' }]
};

categories.forEach(category => {
    const data = sampleData[category] || [{ id: '1', name: 'Ejemplo' }];
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, category);
});

const outputPath = path.join(__dirname, 'Plantilla_Datos_Maestros.xlsx');
XLSX.writeFile(wb, outputPath);
console.log(`Template created at: ${outputPath}`);
