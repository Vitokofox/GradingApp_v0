# GradingWebApp - Sistema de Gestión de Calidad

![Version](https://img.shields.io/badge/version-0.1-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

Este proyecto es una aplicación integral para la gestión, registro y análisis de calidad en procesos de clasificación de madera. Incluye módulos para inspecciones en línea, producto terminado, tipificación de rechazos y estudios comparativos con escáner (Finscan).

Esta versión (0.1) introduce una **renovación visual completa**, migrando de Tailwind CSS a un sistema de diseño personalizado (`gradingapp-theme.css`) para ofrecer una interfaz profesional, consistente y optimizada.

## Características Principales

*   **Inspecciones de Calidad**:
    *   **Grado en Línea**: Registro en tiempo real de piezas y defectos.
    *   **Producto Terminado**: Auditoría final de paquetes listos.
    *   **Tipificación de Rechazo**: Análisis detallado de material rechazado.
*   **Estudios Finscan**: Módulo avanzado para comparar la clasificación manual (Inspector) vs automatizada (Escáner).
*   **Reportes Detallados**:
    *   Generación de informes con gráficos de distribución de grados y pareto de defectos.
    *   Diseño optimizado para impresión ("paper-view").
*   **Gestión de Datos Maestros**: Panel administrativo para configurar Mercados, Productos, Defectos, Áreas, Máquinas, Turnos, etc.
*   **Seguridad**: Autenticación de usuarios basada en tokens JWT con roles (Admin/User).

## Estructura del Proyecto

*   **backend/**: API RESTful construida con **FastAPI** (Python).
    *   Gestión de base de datos SQLite con SQLAlchemy.
    *   Sistema de autenticación y autorización.
*   **frontend/**: SPA moderna construida con **React + Vite**.
    *   **Diseño**: Sistema de diseño propio (`gradingapp-theme.css`) con variables CSS, utilidades semánticas y soporte para modo oscuro (preparado).
    *   **Componentes**: Arquitectura modular con `layout` persistente y componentes reutilizables.
*   **GradingMobile/**: (En desarrollo) Versión adaptada para dispositivos móviles.

## Requisitos Previos

*   **Python 3.10+**
*   **Node.js 18+**
*   **Git**

## Instalación y Ejecución Rápida

El proyecto incluye scripts automatizados para Windows.

1.  **Instalación Inicial**:
    Ejecuta el script para instalar todas las dependencias (Backend y Frontend).
    ```cmd
    instalar_dependencias.bat
    ```

2.  **Iniciar la Aplicación**:
    Inicia tanto el servidor backend como el cliente frontend.
    ```cmd
    run_app.bat
    ```
     *   Frontend: [http://localhost:5174](http://localhost:5174)
     *   Backend API Docs: [http://localhost:8001/docs](http://localhost:8001/docs)

3.  **Detener la Aplicación**:
    ```cmd
    Detener_App.bat
    ```

## Ejecución Manual

### Backend
```bash
cd backend
# Activar entorno virtual (crear si no existe: python -m venv venv)
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```
El backend correrá en el puerto **8001**.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
El frontend correrá en el puerto **5174**.

## Configuración

*   **Variables de Entorno**:
    *   Backend: Revisar `backend/.env` para configuración de CORS, SECRET_KEY, y base de datos.
     *   Frontend: Configurado para conectar a `http://127.0.0.1:8001` por defecto.
*   **Despliegue compartido (recomendado en planta)**:
    *   Puede centralizar recursos en una carpeta de red compartida para todos los usuarios.
    *   En `backend/.env`:
        *   `DATABASE_URL=sqlite:///Y:/GradingApp/grading.db`
        *   `NORMAS_PATH=Y:/GradingApp/normas`
        *   `VECTORSTORE_PATH=Y:/GradingApp/vectorstore`
    *   Flujo recomendado: subir normas al backend y luego ejecutar `POST /indice/reconstruir` para regenerar el índice común.

## Historial de Cambios Recientes (v0.1)

*   **Refactorización UI**: Eliminación completa de Tailwind CSS. Implementación de `gradingapp-theme.css` global.
*   **Mejoras en Reportes**: Nuevas vistas de impresión para reportes de inspección y estudios.
*   **Correcciones**: Solución a problemas de CORS y conexión en entornos locales Windows.
*   **Login**: Flujo de autenticación mejorado con feedback visual de errores.

## Soporte

Para dudas técnicas o reporte de fallos, contactar al equipo de desarrollo del Departamento de Mejora Continua.

## Wagner L622

La aplicación puede capturar directamente los reportes del Wagner L622 mediante RS-232. Instala las dependencias del backend y conecta el adaptador USB; en Linux se usa `/dev/ttyUSB0` y en Windows puede configurarse `WAGNER_SERIAL_PORT=COM3`. Desde una inspección activa, pulsa `Capturar L622` y luego ejecuta `MENU -> Print -> STORE` en el equipo. Las lecturas quedan asociadas a la inspección y se conserva el reporte serial original.
