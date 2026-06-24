@echo off
set "PROJECT_ROOT=%~dp0.."
set "VENV_PYTHON=%PROJECT_ROOT%\.venv\Scripts\python.exe"

if not exist "%VENV_PYTHON%" (
  echo Project virtual environment Python was not found:
  echo %VENV_PYTHON%
  exit /b 1
)

echo Starting MarketMind AI backend with:
echo %VENV_PYTHON%
cd /d "%~dp0"
"%VENV_PYTHON%" -m uvicorn main:app --reload
