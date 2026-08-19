# Instructivo de Puesta en Marcha - Servidor GradingApp

Este instructivo deja el PC empresa funcionando como servidor central para la app.

## 1. Alcance

- El servidor ejecuta GradingApp.exe.
- La base de datos SQLite queda local en el servidor.
- Las normas y el vectorstore quedan locales en el servidor.
- Los equipos cliente consumen por HTTP (no abren el .db por red).

## 2. Rutas oficiales del servidor

Usar estas rutas en el PC servidor:

- DB: C:/Users/Victor.Valenzuela/OneDrive - ARAUCO/DataBase/grading.db
- Normas: C:/Users/Victor.Valenzuela/OneDrive - ARAUCO/DataBase/normas
- Vectorstore: C:/Users/Victor.Valenzuela/OneDrive - ARAUCO/DataBase/vectorstore

## 3. Preparacion de carpetas

En el servidor, crear si no existen:

- C:/Users/Victor.Valenzuela/OneDrive - ARAUCO/DataBase/normas
- C:/Users/Victor.Valenzuela/OneDrive - ARAUCO/DataBase/vectorstore

Copiar los documentos de normas (pdf/docx/txt) a la carpeta normas.

## 4. Configuracion del ejecutable

Editar o crear el archivo:

- backend/dist/.env

Contenido recomendado:

```env
SECRET_KEY=09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=300

DATABASE_URL=sqlite:///C:/Users/Victor.Valenzuela/OneDrive - ARAUCO/DataBase/grading.db
NORMAS_PATH=C:/Users/Victor.Valenzuela/OneDrive - ARAUCO/DataBase/normas
VECTORSTORE_PATH=C:/Users/Victor.Valenzuela/OneDrive - ARAUCO/DataBase/vectorstore

CORS_ORIGINS=*
LOG_LEVEL=INFO
LOG_ROTATION=10 MB
```

## 5. Inicio del servidor

Ejecutar:

- backend/dist/GradingApp.exe

Al iniciar correctamente deberias ver:

- Uvicorn running on http://0.0.0.0:8000
- Uvicorn running on http://0.0.0.0:8080

## 6. Inicializacion de IA documental

Una vez iniciado, reconstruir indice una vez:

- POST http://IP_DEL_SERVIDOR:8080/indice/reconstruir

Despues, probar consulta:

- POST http://IP_DEL_SERVIDOR:8080/consultar
- Body ejemplo:

```json
{
  "pregunta": "Que dice la norma de canto muerto para COL?",
  "top_k": 3
}
```

## 7. Configuracion de clientes (otros PCs)

Los clientes NO deben abrir el archivo .db directo.

Deben usar URLs HTTP al servidor:

- App/API principal: http://IP_DEL_SERVIDOR:8000
- IA/bridge: http://IP_DEL_SERVIDOR:8080
- Docs API principal: http://IP_DEL_SERVIDOR:8000/docs
- Docs API IA: http://IP_DEL_SERVIDOR:8080/docs

Ejemplo real:

- http://10.53.119.13:8000
- http://10.53.119.13:8080

## 8. Reglas de red corporativa (importante)

- No compartir SQLite por SMB para acceso concurrente de varios clientes.
- Exponer solo el servicio HTTP del servidor.
- Solicitar excepcion de firewall para puertos 8000 y 8080 en el perfil de red corporativo.
- Verificar que antivirus/EDR no bloquee GradingApp.exe ni su carpeta de trabajo.

## 9. Troubleshooting rapido

### 9.1 Error 404 en /consultar

Causa tipica: no existe indice.

Accion:

1. Verificar que haya documentos en carpeta normas.
2. Ejecutar POST /indice/reconstruir.
3. Reintentar /consultar.

### 9.2 Warning de sentence-transformers / torch c10.dll

Si aparece warning de DLL de torch, el sistema usa fallback de embeddings hashing.

- Esto permite operar /indice/reconstruir y /consultar.
- Puede bajar calidad semantica respecto a sentence-transformers completo.

### 9.3 La app no responde desde otros PCs

1. Confirmar IP del servidor.
2. Confirmar puertos abiertos 8000 y 8080.
3. Confirmar GradingApp.exe en ejecucion.
4. Probar desde cliente:
   - http://IP_DEL_SERVIDOR:8000/openapi.json
   - http://IP_DEL_SERVIDOR:8080/openapi.json

## 10. Checklist de operacion diaria

1. Iniciar backend/dist/GradingApp.exe en el servidor.
2. Verificar puertos 8000 y 8080 activos.
3. Si se cambiaron normas, ejecutar /indice/reconstruir.
4. Verificar una consulta de IA de prueba.
5. Confirmar acceso desde al menos un cliente de red.
