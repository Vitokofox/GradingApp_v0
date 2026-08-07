# Contexto Wagner L622

## Estado de la conexión

- Equipo: Wagner L622 Digital Recording.
- Adaptador USB-RS232 detectado como `/dev/ttyUSB0`.
- Chipset del adaptador: CH340.
- Configuración confirmada: `9600 8N1`, sin paridad ni control de flujo.
- Cable: RJ12 6P6C a DB9 hembra, conectado al adaptador USB-DB9 macho.
- Manual: `wagner-meters-l622-manual.pdf`.

## Prueba realizada

El equipo transmite mediante `MENU -> Print -> STORE`.

Se capturó correctamente este reporte:

- Registro 30: `8.5 %`
- Registro 31: `8.4 %`

El formato recibido es texto ASCII con espacios, saltos de línea y caracteres de control. El L622 puede repetir el reporte, por lo que el parser elimina duplicados.

## Implementación aplicada

- Servicio serial: `backend/services/wagner_l622_service.py`.
- Router API: `backend/routers/moisture.py`.
- Modelos: `MoistureCapture` y `MoistureReading` en `backend/database/models.py`.
- Schemas: `backend/schemas.py`.
- Migración: `backend/alembic/versions/20260806_add_moisture_l622.py`.
- API frontend: `frontend/src/api.js`.
- Panel de captura: `frontend/src/pages/GradingInterface.jsx`.
- Dependencia: `pyserial==3.5` en `backend/requirements.txt`.

## Flujo de uso

1. Abrir una inspección.
2. Pulsar `Capturar L622`.
3. En el equipo ejecutar `MENU -> Print -> STORE`.
4. Esperar el resultado en el panel de humedad.

Las lecturas quedan asociadas al `inspection_id` y se conserva el reporte serial original.

## Verificaciones

- Parser validado con `30 8.5` y `31 8.4`.
- Archivos Python compilados correctamente.
- Frontend compilado correctamente con `npm run build`.
- El lint general del frontend tiene errores preexistentes en otros archivos.

## Pendientes posibles

- Instalar todas las dependencias del backend en el entorno de ejecución.
- Probar el flujo completo desde la interfaz con el L622 conectado.
- Confirmar la creación de tablas mediante la migración Alembic en la base productiva.
- Opcional: agregar visualización de humedad en reportes y exportaciones.
