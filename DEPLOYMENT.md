# JanSetu Deployment & Cloud Run Guide

This guide explains how to run **JanSetu** locally via Docker, configure Google Gemini AI, and deploy to modern cloud providers (Google Cloud Run, Render, Railway, AWS).

---

## 🔑 1. Environment Variables & AI Configuration

Create a `.env` file in the root directory (or in `backend/`):

```env
# Optional: Google Gemini API Key for LLM-powered deep semantic triage
# Get your free key at: https://aistudio.google.com/
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Security
SECRET_KEY=jansetu-super-secret-production-jwt-key-2026

# Database (Default: SQLite; or use PostgreSQL in production)
# DATABASE_URL=postgresql://user:password@host:5432/jansetu
```

> **Note:** If `GEMINI_API_KEY` is not provided, JanSetu automatically uses its built-in multilingual rule-based NLP engine.

---

## 🐳 2. Running with Docker Compose (Local or VPS)

### Build and Start
```bash
docker compose up --build -d
```

### View Logs
```bash
docker compose logs -f
```

### Stop
```bash
docker compose down
```

Once running:
- **Web App:** [http://localhost:8000/index.html](http://localhost:8000/index.html)
- **API Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Citizen Dashboard:** [http://localhost:8000/citizendashboard.html](http://localhost:8000/citizendashboard.html)
- **Officer Dashboard:** [http://localhost:8000/officerdashboard.html](http://localhost:8000/officerdashboard.html)

---

## ☁️ 3. Deploying to Google Cloud Run (Serverless)

### Prerequisites
- Install [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install)
- Authenticate: `gcloud auth login`

### Deploy Command
```bash
# 1. Set your GCP Project ID
gcloud config set project YOUR_PROJECT_ID

# 2. Build and Deploy in one command
gcloud run deploy jansetu \
  --source . \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=your_key,SECRET_KEY=production_secret"
```

Cloud Run will output your live HTTPS URL (e.g. `https://jansetu-xyz-el.a.run.app`).

---

## 🚀 4. Deploying to Render / Railway

### Render
1. Create a new **Web Service** connected to your GitHub repository.
2. Select **Docker** environment.
3. Add Environment Variables:
   - `GEMINI_API_KEY`: your API key
   - `SECRET_KEY`: generated random string
4. Click **Deploy**.

### Railway
1. Click **New Project** $\rightarrow$ **Deploy from GitHub repo**.
2. Railway automatically detects the `Dockerfile`.
3. Add your `GEMINI_API_KEY` in the **Variables** tab.
4. Generate a public domain under **Settings $\rightarrow$ Networking**.

---

## 🧪 5. Testing & Verification

Run automated test suite:
```bash
cd backend
./venv/bin/pytest test_backend.py -v
```
