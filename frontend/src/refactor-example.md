# Refactor Example

## Component: Dashboard Card

### ANTES (Tailwind CSS)
```jsx
<div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 p-6 flex flex-col space-y-4">
  <div className="flex justify-between items-center border-b border-slate-800 pb-4">
    <h2 className="text-xl font-bold text-white">Resumen de Inspección</h2>
    <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full">Activo</span>
  </div>
  
  <div className="text-slate-400">
    <p>Total procesado: <span className="text-white font-mono">1,240</span></p>
  </div>

  <div className="flex space-x-2 mt-4">
    <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition">
      Ver Detalles
    </button>
    <button className="border border-slate-600 text-slate-300 hover:bg-slate-800 px-4 py-2 rounded-lg transition">
      Exportar
    </button>
  </div>
</div>
```

### DESPUÉS (GradingApp Custom CSS)
```jsx
<div className="ga-card">
  <div className="ga-card__header">
    <h2 className="ga-card__title">Resumen de Inspección</h2>
    <span className="ga-badge ga-badge--ok">Activo</span>
  </div>
  
  <div className="ga-card__body ga-stack">
    <div className="u-muted">
      <p>Total procesado: <span className="u-bold ga-text">1,240</span></p>
    </div>

    <div className="ga-row u-mt-4">
      <button className="ga-btn ga-btn--accent">
        Ver Detalles
      </button>
      <button className="ga-btn ga-btn--outline">
        Exportar
      </button>
    </div>
  </div>
</div>
```
