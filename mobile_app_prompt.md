# Prompt para Android Studio (Copiar y Pegar)

**Rol:** Actúa como un Arquitecto de Software Senior experto en Android Nativo.

**Objetivo:** Crear una aplicación móvil Android desde cero para "Control de Calidad y Clasificación de Maderas" (Grading App).
**Enfoque de Datos:** La app funcionará **completamente offline** y obtendrá sus datos iniciales (Usuarios, Productos, Grados) leyendo directamente un archivo `grading.db` (SQLite) que el usuario copiará manualmente desde su PC a la memoria interna del dispositivo móvil.

**Stack Tecnológico Requerido:**
*   **Lenguaje:** Kotlin.
*   **UI:** Jetpack Compose (Material Design 3).
*   **Persistencia:** Room Database (Mapeando tablas existentes).
*   **Almacenamiento:** Acceso a archivos (SAF o permisos de lectura) para importar la DB.

**Flujo de Instalación de Datos:**
1.  El usuario conecta el móvil al PC y copia el archivo `grading.db` (generado por el sistema de escritorio) a la carpeta raíz del almacenamiento interno del móvil (ej: `/sdcard/` o `Documents`).
2.  Al abrir la app por primera vez, esta busca el archivo `grading.db` en las ubicaciones estándar.
3.  Si lo encuentra, lo **importa** (copia) a su directorio privado de base de datos (`/data/data/com.app/databases/`) y lo inicializa con Room.
4.  Si no lo encuentra, muestra una pantalla pidiendo al usuario que copie el archivo.

---

### Especificaciones Técnicas Detalladas

#### 1. Mapeo de Base de Datos (Schema-First)
La base de datos original viene de Python (SQLAlchemy). Tus Entidades de Room deben coincidir **exactamente** con las tablas existentes para que la lectura funcione.

**Tablas Críticas a Mapear (Nombres exactos):**
*   `users` (cols: username, password_hash, level...)
*   `products` (cols: id, name)
*   `grades` (cols: id, product_id, name, grade_rank, market_id...)
*   `defects` (cols: id, name, description)
*   `catalog_items` (cols: category, name, active) - *Contiene Turnos, Máquinas, etc.*
*   `inspections` (Esta tabla crecerá con nuevos datos generados en el móvil).
*   `inspection_results` (Detalle de conteos).

*Nota: Asegúrate de configurar Room con `createFromFile` o implementar una lógica de copiado de archivos crudo antes de inicializar Room.*

#### 2. Funcionalidad Core (UI)

**A. Pantalla de Bienvenida / Carga:**
*   Botón "Buscar Base de Datos".
*   Lógica para verificar permisos de lectura de almacenamiento.
*   Busca `grading.db` en `/Download`, `/Documents` y raíz.

**B. Pantalla de Configuración de Inspección:**
*   Selectores para: Producto, Turno, Máquina (leídos directamente de la DB cargada).
*   Input para Lote.

**C. Pantalla de Clasificación (Grading Screen):**
*   **Diseño Landscape**.
*   **Izquierda:** Botón GIGANTE para "Grado Base" (Aceptado/Bueno).
*   **Derecha:** Grid de botones para "Grados de Rechazo" o inferiores.
*   **Flujo:**
    *   Click en Grado Base -> Suma 1.
    *   Click en Grado Rechazo -> Muestra Popup/Overlay de Defectos -> Click en Defecto -> Suma 1 (Grado + Defecto).

#### 3. Instrucciones de Generación
Genera el código en este orden:
1.  **Entidades Room:** Código Kotlin para `Product`, `Grade`, `Defect`, `User`, `Inspection`. *IMPORTANTE:* Usa `@ColumnInfo(name = "original_name")` si es necesario para asegurar match exacto con la DB legacy.
2.  **Módulo de Base de Datos:** Configuración de Room (`DatabaseModule`) incluyendo la lógica para `builder.createFromFile(file)` o la rutina de copiado de archivos al inicio.
3.  **UI de Clasificación:** El Composable principal de la pantalla de botones.

**Nota sobre Migraciones:** Como la DB viene externa, asume que la versión del esquema es la 1. Si necesitas agregar tablas para control interno móvil, créalas aparte o maneja una migración destructiva controlada, pero lo ideal es leer la estructura tal cual.
