# JanSetu AI Civic Intelligence Backend

Welcome to the backend service for **JanSetu** — an AI-powered civic intelligence and governance platform connecting citizens with municipal authorities for evidence-based grievance triage, automated department routing, participatory budgeting, and real-time civic impact analytics.

---

## 🚀 Quick Start

### 1. Requirements
- Python 3.9+

### 2. Setup Virtual Environment & Install Dependencies
```bash
# In the backend directory
cd backend

# Create or activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Run the Backend API Server
```bash
python run.py
# Or using uvicorn directly:
# uvicorn main:app --reload --port 8000
```

The database (`jansetu.db`) and realistic seed data will be automatically generated on first run.

---

## 📚 Interactive API Documentation

Once the server is running, explore and test the interactive API docs:
- **Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc UI:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **OpenAPI Schema:** [http://127.0.0.1:8000/api/v1/openapi.json](http://127.0.0.1:8000/api/v1/openapi.json)

---

## 🔑 Default Seed Credentials

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Citizen** | `citizen@jansetu.in` | `password123` | General Citizen (Ward 12) |
| **Officer Admin** | `officer@jansetu.in` | `password123` | Municipal Road & Infrastructure Officer |
| **Administrator** | `admin@jansetu.in` | `password123` | Full Municipal Admin Privileges |

---

## 🛠️ API Endpoints Summary

### Authentication & Users (`/api/v1/auth`)
- `POST /api/v1/auth/signup` - Register a new Citizen or Officer account.
- `POST /api/v1/auth/login` - JSON login returning JWT Bearer token.
- `GET /api/v1/auth/me` - Fetch profile of currently authenticated user.
- `PUT /api/v1/auth/me` - Update profile, ward, or department.

### Grievances & Resolutions (`/api/v1/grievances`)
- `POST /api/v1/grievances/` - Submit a new civic issue with automated AI triage.
- `GET /api/v1/grievances/` - List grievances with filters (`status`, `category`, `priority`, `ward`, `search`).
- `GET /api/v1/grievances/my` - List grievances submitted by the logged-in citizen.
- `GET /api/v1/grievances/{id}` - Fetch detailed grievance history and evidence proofs.
- `PATCH /api/v1/grievances/{id}/status` - Officer status update and resolution notes.
- `POST /api/v1/grievances/{id}/support` - Citizen "Upvote / Me-Too" corroboration.

### AI Triage & Civic Intelligence (`/api/v1/triage`)
- `POST /api/v1/triage/preview` - Real-time NLP triage preview for 11+ Indian languages.
- `POST /api/v1/triage/check-duplicates` - Geo-spatial & textual duplicate grievance detector.

### Evidence & Uploads (`/api/v1/evidence`)
- `POST /api/v1/evidence/upload` - Upload photos, documents, and media proofs.
- `PATCH /api/v1/evidence/{id}/review` - Officer approve/reject resolution evidence.

### Participatory Budgeting (`/api/v1/budget`)
- `GET /api/v1/budget/projects` - List civic proposals with citizen vote statuses.
- `POST /api/v1/budget/projects` - Create new budget proposal (Officer only).
- `POST /api/v1/budget/projects/{id}/vote` - Citizen cast vote / support for neighborhood projects.
- `GET /api/v1/budget/summary` - Ward-level budget KPI statistics.

### Civic Map & Geo-Intelligence (`/api/v1/map`)
- `GET /api/v1/map/points` - GeoJSON coordinates for interactive mapping.
- `GET /api/v1/map/hotspots` - Concentrated problem hotspots by ward & category.

### Analytics & Reporting (`/api/v1/analytics`)
- `GET /api/v1/analytics/citizen` - Citizen impact KPIs and report resolution stats.
- `GET /api/v1/analytics/officer` - Officer control center metrics, SLA adherence, and priority queue counts.

### Notifications (`/api/v1/notifications`)
- `GET /api/v1/notifications/` - Get user notification alert feed.
- `PATCH /api/v1/notifications/{id}/read` - Mark single notification as read.
- `PATCH /api/v1/notifications/read-all` - Mark all notifications as read.

---

## 🧪 Running Automated Tests

```bash
pytest test_backend.py -v
```
