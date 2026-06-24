# MarketMind AI

MarketMind AI is a local full-stack starter project for market insight experiments. It includes a Next.js frontend, a FastAPI backend, and a small Python ML workspace.

## Project Structure

```text
MarketMind-AI/
  frontend/   Next.js React app
  backend/    FastAPI API service
  ml/         Machine learning scripts and sample model code
```

## Prerequisites

- VS Code
- Node.js 20.19 or newer
- Python 3.11 or newer
- Git

## Setup

Open this folder in VS Code, then use separate terminals for the frontend and backend.

### 1. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at:

```text
http://localhost:3000
```

### 2. Backend

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

You can also run one of the backend launchers:

```powershell
.\run_backend.ps1
```

or:

```bat
run_backend.bat
```

These launchers force the backend to use `C:\Projects\SPWA\.venv\Scripts\python.exe`, which includes the GPU-enabled PyTorch and ML dependencies.

The backend runs at:

```text
http://localhost:8000
```

FastAPI docs are available at:

```text
http://localhost:8000/docs
```

### 3. ML Workspace

```powershell
cd ml
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe train.py
```

The Transformer training script writes the global model artifact to
`ml/models/transformer_stock_model_global.pth`. The original
`ml/models/transformer_stock_model.pth` remains as a fallback backup.

Validation commands:

```powershell
..\.venv\Scripts\python.exe predict.py AAPL
..\.venv\Scripts\python.exe predict.py RELIANCE.NS
..\.venv\Scripts\python.exe predict.py TCS.NS
..\.venv\Scripts\python.exe predict.py ASML.AS
..\.venv\Scripts\python.exe predict.py EMAAR.AE
```

## Environment Variables

Create `frontend/.env.local` if the frontend needs a custom API URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Create `backend/.env` for backend settings:

```env
APP_NAME=MarketMind AI
ENVIRONMENT=development
```

## Development Notes

- This project is designed to run locally in VS Code.
- No Colab setup is required.
- Keep generated ML artifacts out of Git unless they are intentionally versioned.
