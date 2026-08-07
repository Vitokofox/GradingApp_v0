@echo off
echo Starting Grading Web App...

:: Start Backend
start "Grading Backend" cmd /k "cd backend && venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001"

:: Start Frontend
start "Grading Frontend" cmd /k "cd frontend && npm run dev -- --host 0.0.0.0 --port 5174 --strictPort"

echo.
echo Application started!
echo Backend: http://localhost:8001
echo Frontend: http://localhost:5174
echo.
pause
