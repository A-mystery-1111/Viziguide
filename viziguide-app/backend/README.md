# ViziGuide backend

FastAPI service with a health check and Supabase JWT verification dependency.

## Run on Windows

From the repository root, open PowerShell and run these setup commands once (the first command preserves an existing virtual environment):

```powershell
if (-not (Test-Path backend\.venv\Scripts\python.exe)) { py -m venv backend\.venv }
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

If you have not configured `backend\.env`, copy `backend\.env.example` to that path only if it does not already exist, then add `AI_API_KEY`, `SUPABASE_URL`, `SUPABASE_JWKS_URL`, and `SUPABASE_SECRET_KEY`. Never replace an existing `.env` file.

Each time you start the API, run this from the repository root:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

The API is available at `http://127.0.0.1:8000`. Interactive docs are at `/docs`.

## Endpoints

- `GET /health` returns `{"status": "ok"}`.
- `GET /auth/me` requires a Supabase access token in the `Authorization: Bearer <token>` header and returns the verified user ID.
- `POST /api/diagnose` requires the same bearer token and accepts multipart form data with an `image` file (JPG, PNG, or WebP, up to 8 MB) and an optional `description`. It sends the image to Gemini, saves the structured result under the verified user ID in `public.diagnoses`, and returns the result including a safety disclaimer.

JWTs are verified against `SUPABASE_JWKS_URL`, including signature, expiration, `aud=authenticated`, and the issuer derived from `SUPABASE_URL`. Invalid or expired tokens receive HTTP 401. Authentication configuration must be present for `/auth/me`; the health endpoint remains available without it.

CORS allows `http://localhost:5173`.

## Chat endpoint

`POST /api/chat` requires the same bearer token and a JSON body containing `message` and an optional `diagnosis_id`. A supplied diagnosis is loaded only if it belongs to the authenticated user. Gemini generates a simple-language reply, and both messages are saved to `public.chat_messages` in one conversation. Requests to bypass safety features are refused.

The diagnosis endpoint requests structured JSON from Gemini 2.5 Flash. It returns a request to upload a clearer photo when confidence is below 0.6, and marks tasks mentioning mains electricity, gas, or pressure as requiring a professional. Run the updated `frontend/supabase/schema.sql` in the Supabase SQL Editor to add the `disclaimer` column to existing installations.
