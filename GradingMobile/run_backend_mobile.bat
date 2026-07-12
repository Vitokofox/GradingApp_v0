@echo off
echo Starting Mobile Backend...
echo Access this backend from your phone using your PC's IP Address (e.g. http://10.67.51.114:8080)

echo Copiando base de datos principal...
copy /Y "..\backend\grading.db" "backend\grading.db"

cd backend
if not exist "venv" (
    echo Virtual environment not found. Please create it first.
    pause
    exit /b
)

venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8080
pause
