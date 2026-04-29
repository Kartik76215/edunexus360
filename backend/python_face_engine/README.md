# Python Face Engine (ERP Integration)

This service provides Python-based face matching for the ERP backend.

## Run

```bash
cd backend/python_face_engine
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8001
```

## Backend configuration

Set these environment variables for the Node backend:

- `FACE_ENGINE=python`
- `PYTHON_FACE_ENGINE_URL=http://127.0.0.1:8001`

If Python engine is unavailable, backend automatically falls back to local Node matching.
