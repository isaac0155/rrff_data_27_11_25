@echo off
echo Iniciando sistema RRFF...

powershell -ExecutionPolicy Bypass -File "C:\Program Files\requerimientos_fiscales\setup_rrff.ps1"

timeout /t 3 > nul

cd /d "C:\Program Files\nginx-1.27.4"
start "" nginx.exe

tasklist | findstr nginx.exe > nul
if errorlevel 1 (
    echo nginx.exe no se esta ejecutando.
) else (
    echo nginx.exe iniciado correctamente.
)

pause
