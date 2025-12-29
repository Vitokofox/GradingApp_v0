@echo off
:: Navigate to backend and start uvicorn in background
cd backend
start /B "Backend" venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000

:: Navigate to frontend and start npm in background
cd ..\frontend
start /B "Frontend" npm run dev -- --host

:: Return to root (optional)
cd ..
exit
