import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.db.seed import seed_database
from main import app

# Setup in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    seed_database(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client():
    return TestClient(app)


def test_root_and_health(client):
    res = client.get("/", headers={"Accept": "application/json"})
    assert res.status_code == 200
    assert "JanSetu" in res.json()["app"]

    res_html = client.get("/")
    assert res_html.status_code == 200
    assert "JanSetu" in res_html.text

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "online"


def test_auth_login_citizen(client):
    res = client.post("/api/v1/auth/login", json={
        "email": "citizen@jansetu.in",
        "password": "password123"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "citizen@jansetu.in"
    assert data["user"]["role"] == "citizen"


def test_auth_login_officer(client):
    res = client.post("/api/v1/auth/login", json={
        "email": "officer@jansetu.in",
        "password": "password123"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "officer"


def test_auth_signup_new_user(client):
    res = client.post("/api/v1/auth/signup", json={
        "email": "newcitizen@jansetu.in",
        "password": "strongpassword123",
        "full_name": "Ramesh Patnaik",
        "role": "citizen",
        "ward": "Ward 14"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["user"]["email"] == "newcitizen@jansetu.in"
    assert data["user"]["ward"] == "Ward 14"


def test_ai_triage_preview(client):
    # Test Road Pothole in Hindi/English
    res = client.post("/api/v1/triage/preview", json={
        "description": "यूनिट 4 मार्केट के पास बड़ा गड्ढा है, dangerous pothole on main road",
        "language": "hi"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["category"] == "Road & Infrastructure"
    assert "Road" in data["suggested_department"]
    assert data["priority"] in ["Critical", "High"]

    # Test Water Leak
    res_water = client.post("/api/v1/triage/preview", json={
        "description": "Drinking water pipeline leakage flooding the street for 2 days",
        "language": "en"
    })
    assert res_water.status_code == 200
    data_water = res_water.json()
    assert data_water["category"] == "Water Supply"
    assert "ai_engine" in data_water
    assert "estimated_sla_hours" in data_water


def test_grievance_workflow(client):
    # 1. Login as citizen
    login_res = client.post("/api/v1/auth/login", json={
        "email": "citizen@jansetu.in",
        "password": "password123"
    })
    token = login_res.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 2. Submit new grievance
    grievance_payload = {
        "title": "Broken sewage drain near market",
        "description": "Sewage drain line is overflowing with dirty wastewater near Sector 5 market entrance.",
        "category": "Drainage",
        "latitude": 20.2950,
        "longitude": 85.8230,
        "landmark": "Sector 5 Market",
        "ward": "Ward 12"
    }
    create_res = client.post("/api/v1/grievances/", json=grievance_payload, headers=auth_headers)
    assert create_res.status_code == 201
    g_data = create_res.json()
    assert g_data["ticket_id"].startswith("JS-")
    assert g_data["category"] == "Drainage"
    assert g_data["status"] == "Pending"
    grievance_id = g_data["id"]

    # 3. Retrieve list and verify filtering
    list_res = client.get("/api/v1/grievances/?category=Drainage")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 4. Fetch detail
    detail_res = client.get(f"/api/v1/grievances/{grievance_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["ticket_id"] == g_data["ticket_id"]
    assert len(detail_res.json()["history"]) >= 1

    # 5. Officer status update
    officer_login = client.post("/api/v1/auth/login", json={
        "email": "officer@jansetu.in",
        "password": "password123"
    })
    officer_token = officer_login.json()["access_token"]
    officer_headers = {"Authorization": f"Bearer {officer_token}"}

    update_res = client.patch(
        f"/api/v1/grievances/{grievance_id}/status",
        json={
            "status": "In Progress",
            "comments": "Sewer cleaning squad scheduled for inspection.",
            "resolution_notes": "Inspection in progress."
        },
        headers=officer_headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "In Progress"

    # 6. Citizen Upvote / Support
    support_res = client.post(f"/api/v1/grievances/{grievance_id}/support", headers=auth_headers)
    assert support_res.status_code == 200
    assert support_res.json()["supported"] is True


def test_participatory_budget_and_voting(client):
    # Login citizen
    login_res = client.post("/api/v1/auth/login", json={
        "email": "citizen@jansetu.in",
        "password": "password123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # List projects
    res = client.get("/api/v1/budget/projects", headers=headers)
    assert res.status_code == 200
    projects = res.json()
    assert len(projects) >= 4
    project_id = projects[0]["id"]
    initial_votes = projects[0]["vote_count"]

    # Vote on project
    vote_res = client.post(f"/api/v1/budget/projects/{project_id}/vote", json={"vote_type": "support"}, headers=headers)
    assert vote_res.status_code == 200
    assert vote_res.json()["vote_count"] == initial_votes + 1

    # Get budget summary
    summary_res = client.get("/api/v1/budget/summary")
    assert summary_res.status_code == 200
    assert summary_res.json()["total_projects"] >= 4


def test_civic_map_and_hotspots(client):
    # Map config
    config_res = client.get("/api/v1/map/config")
    assert config_res.status_code == 200
    assert "google_maps_api_key" in config_res.json()

    # Map points
    res = client.get("/api/v1/map/points")
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) >= 1

    # Hotspots
    hotspots_res = client.get("/api/v1/map/hotspots")
    assert hotspots_res.status_code == 200
    assert "hotspots" in hotspots_res.json()


def test_analytics_endpoints(client):
    # Citizen analytics
    res_citizen = client.get("/api/v1/analytics/citizen")
    assert res_citizen.status_code == 200
    c_data = res_citizen.json()
    assert "reports_submitted" in c_data
    assert "community_impact" in c_data

    # Officer analytics
    res_officer = client.get("/api/v1/analytics/officer")
    assert res_officer.status_code == 200
    o_data = res_officer.json()
    assert "total_grievances" in o_data
    assert "resolution_rate_percent" in o_data


def test_notifications(client):
    login_res = client.post("/api/v1/auth/login", json={
        "email": "citizen@jansetu.in",
        "password": "password123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/notifications/", headers=headers)
    assert res.status_code == 200
    notifs = res.json()
    assert len(notifs) >= 1
    notif_id = notifs[0]["id"]

    # Mark as read
    patch_res = client.patch(f"/api/v1/notifications/{notif_id}/read", headers=headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["is_read"] is True


def test_frontend_static_serving(client):
    res_index = client.get("/index.html")
    assert res_index.status_code == 200
    assert "JanSetu" in res_index.text

    res_api = client.get("/api.js")
    assert res_api.status_code == 200
    assert "JanSetuAPI" in res_api.text

    res_citizendash = client.get("/citizendashboard.html")
    assert res_citizendash.status_code == 200
    assert "Citizen Dashboard" in res_citizendash.text


def test_evidence_workflow(client):
    # 1. Login citizen
    c_login = client.post("/api/v1/auth/login", json={"email": "citizen@jansetu.in", "password": "password123"})
    c_token = c_login.json()["access_token"]
    c_headers = {"Authorization": f"Bearer {c_token}"}

    # 2. Upload evidence
    file_payload = ("test_proof.jpg", b"fake image bytes content", "image/jpeg")
    upload_res = client.post(
        "/api/v1/evidence/upload",
        files={"file": file_payload},
        data={"evidence_type": "report_proof"},
        headers=c_headers
    )
    assert upload_res.status_code == 201
    ev_data = upload_res.json()
    assert ev_data["file_name"] == "test_proof.jpg"
    evidence_id = ev_data["id"]

    # 3. List evidence
    list_res = client.get("/api/v1/evidence/")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 4. Officer review evidence
    o_login = client.post("/api/v1/auth/login", json={"email": "officer@jansetu.in", "password": "password123"})
    o_token = o_login.json()["access_token"]
    o_headers = {"Authorization": f"Bearer {o_token}"}

    review_res = client.patch(
        f"/api/v1/evidence/{evidence_id}/review",
        data={"is_verified": "true", "notes": "Approved by testing officer"},
        headers=o_headers
    )
    assert review_res.status_code == 200
    assert review_res.json()["is_verified"] is True


def test_citizen_reviews_and_contractor_dispatch(client):
    # 1. Login citizen & officer
    c_login = client.post("/api/v1/auth/login", json={"email": "citizen@jansetu.in", "password": "password123"})
    c_headers = {"Authorization": f"Bearer {c_login.json()['access_token']}"}

    o_login = client.post("/api/v1/auth/login", json={"email": "officer@jansetu.in", "password": "password123"})
    o_headers = {"Authorization": f"Bearer {o_login.json()['access_token']}"}

    # 2. Create a grievance
    g_res = client.post(
        "/api/v1/grievances/",
        json={"title": "Broken culvert bridge", "description": "Culvert bridge has cracked railings.", "category": "Road & Infrastructure"},
        headers=c_headers
    )
    assert g_res.status_code == 201
    g_id = g_res.json()["id"]

    # 3. Officer assigns contractor & work order
    assign_res = client.post(
        f"/api/v1/grievances/{g_id}/assign",
        json={
            "contractor_name": "Apex Civic Infra Ltd.",
            "work_order_id": "WO-2026-999",
            "target_sla_date": "24 Hours (SLA Target)",
            "assigned_officer_name": "Er. Rajesh Mohapatra"
        },
        headers=o_headers
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["contractor_name"] == "Apex Civic Infra Ltd."
    assert assign_res.json()["work_order_id"] == "WO-2026-999"

    # 4. Officer resolves with resolution proof
    resolve_res = client.patch(
        f"/api/v1/grievances/{g_id}/status",
        json={
            "status": "Resolved",
            "resolution_notes": "Railing replaced and reinforced.",
            "resolution_proof_url": "https://images.unsplash.com/photo-1590496793929-36417d3117de?w=400"
        },
        headers=o_headers
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["resolution_proof_url"] is not None

    # 5. Citizen submits verification review with photo proof
    review_res = client.post(
        f"/api/v1/grievances/{g_id}/reviews",
        json={
            "user_name": "Sourav Resident",
            "rating": 5,
            "is_verified_fixed": 1,
            "comment": "Inspected the bridge railing today. Perfectly welded and safe!",
            "proof_image_url": "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=400"
        },
        headers=c_headers
    )
    assert review_res.status_code == 201
    review_data = review_res.json()
    assert review_data["rating"] == 5
    assert review_data["is_verified_fixed"] == 1
    review_id = review_data["id"]

    # 6. Upvote review helpfulness
    helpful_res = client.post(f"/api/v1/grievances/reviews/{review_id}/helpful", headers=c_headers)
    assert helpful_res.status_code == 200
    assert helpful_res.json()["helpful_count"] >= 1

    # 7. List reviews
    list_rev = client.get(f"/api/v1/grievances/{g_id}/reviews")
    assert list_rev.status_code == 200
    assert len(list_rev.json()) >= 1


def test_ward_bulletins_and_new_static_files(client):
    # 1. Test Static files
    res_pdf = client.get("/pdf-generator.js")
    assert res_pdf.status_code == 200
    assert "JanSetuPDF" in res_pdf.text

    res_wa = client.get("/whatsapp-bot.js")
    assert res_wa.status_code == 200
    assert "JanSetuWhatsApp" in res_wa.text

    # 2. Test Get bulletins
    res_b = client.get("/api/v1/grievances/bulletin/list")
    assert res_b.status_code == 200
    bulletins = res_b.json()
    assert len(bulletins) >= 1
    assert "title" in bulletins[0]

    # 3. Post officer bulletin
    o_login = client.post("/api/v1/auth/login", json={"email": "officer@jansetu.in", "password": "password123"})
    o_headers = {"Authorization": f"Bearer {o_login.json()['access_token']}"}

    create_b = client.post(
        "/api/v1/grievances/bulletin/create",
        json={
            "title": "Emergency Drain Silt Clearing Drive",
            "message": "Drain desilting squad dispatched to Saheed Nagar.",
            "category": "Drainage",
            "urgency": "High",
            "ward": "Ward 12"
        },
        headers=o_headers
    )
    assert create_b.status_code == 201
    assert create_b.json()["title"] == "Emergency Drain Silt Clearing Drive"


def test_ai_translation_and_geocoding(client):
    # 1. Test AI Translation to Hindi
    trans_hi = client.post("/api/v1/triage/translate", json={
        "text": "In Progress",
        "target_lang": "hi"
    })
    assert trans_hi.status_code == 200
    assert "प्रगति" in trans_hi.json()["translated_text"]

    # 2. Test AI Translation to Odia
    trans_or = client.post("/api/v1/triage/translate", json={
        "text": "Resolved",
        "target_lang": "or"
    })
    assert trans_or.status_code == 200
    assert "ସମାଧାନ" in trans_or.json()["translated_text"]

    # 3. Test Odisha Geocoding
    geo_res = client.post("/api/v1/triage/geocode", json={
        "query": "Saheed Nagar Main Road"
    })
    assert geo_res.status_code == 200
    data = geo_res.json()
    assert abs(data["latitude"] - 20.2894) < 0.01
    assert abs(data["longitude"] - 85.8431) < 0.01





