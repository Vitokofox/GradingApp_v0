# Plan de Implementación: Módulo de Estudio Finscan

## 1. Análisis de la Situación Actual (Excel)
Actualmente, el proceso se realiza manualmente en el archivo `estudio escaner.xlsx`. El flujo es:
1.  **Datos de Cabecera**: Se registra Fecha, Turno, Supervisor, Operador, Inspector, Producto y Mercado.
2.  **Muestra**: Un inspector selecciona un lote (ej. 20 piezas).
3.  **Evaluación Manual (Inspector)**: Para cada pieza, registra sus dimensiones (Espesor, Ancho, Largo) y el **Grado** que él determina visualmente.
4.  **Evaluación Automática (Scanner)**: Se pasan las piezas por el Finscan y se registra el **Grado** (y dimensiones) que la máquina determinó.
5.  **Comparación**: Se cruzan ambos datos para determinar:
    *   **En Grado**: Coincidencia.
    *   **Bajo Grado**: El escáner le dio menor valor de lo real (Perdida de valor).
    *   **Sobre Grado**: El escáner le dio mayor valor de lo real (Riesgo de calidad).
    *   **Valorización ($$)**: Se calcula el impacto económico (Volumen * Precio Grado).

## 2. Solución Propuesta en Grading Web App
Migraremos este flujo a la aplicación web para centralizar datos, automatizar cálculos y evitar errores de planilla.

### A. Base de Datos (Backend)
Necesitamos ampliar el modelo de datos para capturar lo mismo que el Excel.

**Tabla: `scanner_entries` (Detalle de pieza)**
-   **Dimensiones**: `thickness` (mm), `width` (mm), `length` (mm).
-   **Volumen**: Calculado automáticamente (`thickness * width * length`).
-   **Grado Inspector**: El "Gold Standard".
-   **Grado Scanner**: Lo que dijo la máquina.
-   **Evaluación**: `match` (En Grado), `overgrade` (Sobre), `undergrade` (Bajo).
-   **Observaciones**: Texto libre para notas (ej. "Peca al largo").

### B. Interfaz de Usuario (Frontend)

#### 1. Crear Nuevo Estudio
Un formulario simple para los metadatos (igual al Excel):
-   Fecha/Hora (Automático)
-   Turno, Supervisor, Inspector, Operador.
-   Producto y Mercado (Carga ajustes de dimensiones y grados válidos).

#### 2. Tabla de Carga (Tipo Excel Web)
En lugar de cargar pieza por pieza en un formulario lento, implementaremos una **Grilla Editable**:
-   Filas pre-generadas (1 a 10 o 1 a 20).
-   **Columnas Editables**:
    -   Dimensiones (Pre-llenadas con el estándar del producto, editables si varían).
    -   Grado Inspector (Dropdown rápido).
    -   Grado Scanner (Dropdown rápido).
-   **Cálculo en Tiempo Real**: Al ingresar los datos, la fila se ilumina:
    -   🟢 Verde: Coincidencia.
    -   🔴 Rojo: Bajo Grado.
    -   🟡 Amarillo: Sobre Grado.

#### 3. Reporte y Estadísticas
Reproducción fiel de los indicadores del Excel:
-   **Tabla de Resumen**:
    -   % Pzas En Grado
    -   % Pzas Sobre Grado
    -   % Pzas Bajo Grado
-   **Recuperación de Margen ($$)**: Comparación de valor total Inspector vs Scanner.
-   **Gráficos**: Torta o Barras de la distribución de errores.

## 3. Pasos de Desarrollo

1.  **Refinar Modelos de Datos**:
    -   Añadir campos de dimensiones a `ScannerItem`.
    -   Asegurar que los `Grades` tengan un atributo de `valor` o `ranking` claro para saber qué es "mejor" o "peor".

2.  **Interfaz de Grilla (Bulk Edit)**:
    -   Crear un componente `StudyGrid` que permita navegación con teclado (Enter, Tab) para carga ultra-rápida.

3.  **Lógica de Valorización**:
    -   Implementar cálculo de volumen (m3).
    -   (Opcional) Asignar precios a los grados para calcular "Pérdida de Valor".

4.  **Exportación**:
    -   Botón para descargar el estudio como PDF o Excel (para respaldo).

---
**Comentario**: Esta solución simplifica la carga de datos masiva (lotes completos) y entrega resultados inmediatos sin necesidad de fórmulas manuales.
