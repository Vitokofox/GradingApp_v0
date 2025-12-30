# GradingApp - Tailwind to Custom CSS Mapping

Use this guide to migrate components.

## Containers & Layout

| Tailwind Class | New Custom Class | Notes |
| :--- | :--- | :--- |
| `min-h-screen flex flex-col` | `.ga-app` | Root app container |
| `max-w-7xl mx-auto px-4` | `.ga-page` | Main content wrapper |
| `grid grid-cols-1 md:grid-cols-2 gap-4` | `.ga-grid .ga-grid--2` | Responsive grid |
| `flex flex-col space-y-4` | `.ga-stack` | Vertical stack |
| `flex items-center space-x-4` | `.ga-row` | Horizontal alignment |

## Cards & Surfaces

| Tailwind Class | New Custom Class | Notes |
| :--- | :--- | :--- |
| `bg-white shadow rounded-lg` | `.ga-card` | Base card style |
| `p-6`, `p-4` | `.ga-card__body` | Card padding is standardized |
| `border-b px-4 py-2` | `.ga-card__header` | Card header |
| `bg-slate-50` | `.ga-bg` | Page background |

## Typography

| Tailwind Class | New Custom Class | Notes |
| :--- | :--- | :--- |
| `text-2xl font-bold` | `.ga-card__title` or `.ga-topbar-title` | Headings |
| `text-gray-500`, `text-slate-400` | `.u-muted` | Secondary text |
| `text-center` | `.u-center` | Alignment |
| `text-right` | `.u-right` | Alignment |

## Buttons

| Tailwind Class | New Custom Class | Notes |
| :--- | :--- | :--- |
| `bg-blue-600 hover:bg-blue-700 text-white` | `.ga-btn .ga-btn--primary` | Primary action |
| `bg-orange-500 text-white` | `.ga-btn .ga-btn--accent` | Operational action |
| `border border-gray-300` | `.ga-btn .ga-btn--outline` | Secondary action |
| `px-2 py-1 text-sm` | `.ga-btn--sm` | Size modifier |

## Forms

| Tailwind Class | New Custom Class | Notes |
| :--- | :--- | :--- |
| `block text-sm font-medium` | `.ga-label` | Input labels |
| `mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500` | `.ga-control` | Inputs, Selects |
| `text-red-600 text-sm` | `.ga-error` | Validation messages |

## Badges

| Tailwind Class | New Custom Class | Notes |
| :--- | :--- | :--- |
| `inline-flex px-2 rounded-full bg-green-100 text-green-800` | `.ga-badge .ga-badge--ok` | Success badge |
| `bg-red-100 text-red-800` | `.ga-badge .ga-badge--error` | Error badge |

## Migration Strategy

1.  **Stop importing Tailwind**: Remove `@tailwind` directives from `index.css`.
2.  **Import Theme**: Add `import './gradingapp-theme.css';` in `main.jsx` or `App.jsx`.
3.  **Global Replace**: Use Search & Replace for common patterns (e.g. `className="` -> check context).
4.  **Simplify**: Remove arbitrary margins/paddings (`mt-10`, `pt-5`) and rely on standardized `.ga-stack` or `.ga-page` spacing.
