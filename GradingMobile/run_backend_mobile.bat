@echo off
echo Starting Mobile Backend...
echo Access this backend from your phone using your PC's IP Address (e.g. http://192.168.x.x:8000)

cd backend
if not exist "venv" (
    echo Virtual environment not found. Please create it first.
    pause
    exit /b
)

venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
