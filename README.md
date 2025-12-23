# GradingWebApp

Este proyecto es una aplicación para la gestión y análisis de calificaciones, compuesta por módulos de backend, frontend y móvil.

## Estructura del proyecto

- **backend/**: Lógica del servidor, scripts de análisis, base de datos y rutas API.
  - `main.py`: Punto de entrada del backend.
  - `database/`: Modelos y gestión de la base de datos.
  - `routers/`: Rutas para autenticación, exportaciones, datos maestros, registro, escaneo y usuarios.
  - `requirements.txt`: Dependencias de Python.
- **frontend/**: Aplicación web desarrollada con React y Vite.
  - `src/`: Componentes, páginas y lógica de la interfaz.
  - `public/`: Archivos estáticos.
  - `package.json`: Dependencias de Node.js.
- **GradingMobile/**: Versión móvil con estructura similar a backend/frontend.
- **scripts y archivos raíz**:
  - `.bat` y `.py`: Scripts para iniciar, detener y analizar la aplicación.
  - `EXCEL GRADING - Cepillado 2025.xlsm`: Archivo Excel utilizado en el análisis.

## Requisitos previos

- Python 3.8+
- Node.js 16+
- npm o yarn

## Instalación y ejecución

### Backend
1. Instala las dependencias:
   ```sh
   cd backend
   pip install -r requirements.txt
   ```
2. Ejecuta el backend:
   ```sh
   python main.py
   ```
   O usa el script:
   ```sh
   ..\run_app.bat
   ```

### Frontend
1. Instala las dependencias:
   ```sh
   cd frontend
   npm install
   ```
2. Ejecuta la aplicación web:
   ```sh
   npm run dev
   ```
   Accede a la interfaz en [http://localhost:5173](http://localhost:5173)

### Móvil
1. Sigue los pasos de instalación en `GradingMobile/README.md`.

## Scripts útiles
- `instalar_dependencias.bat`: Instala dependencias automáticamente.
- `run_app.bat`: Inicia la aplicación.
- `Detener_App.bat`: Detiene la aplicación.
- `analyze_excel.py`: Analiza el archivo Excel.

## Contacto y soporte
Para dudas o soporte, contacta al equipo de desarrollo.
