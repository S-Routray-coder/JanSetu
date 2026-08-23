import sys
import os
from datetime import datetime, timedelta

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.grievance import Grievance, GrievanceStatusHistory, GrievanceStatus, GrievancePriority, GrievanceCategory
from app.models.evidence import Evidence
from app.models.budget import BudgetProject, ProjectVote
from app.models.notification import Notification


def seed_database(db: Session = None):
    should_close = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        should_close = True

    try:
        # Check if already seeded
        if db.query(User).first():
            print("Database already contains data. Skipping seed.")
            return

        print("Seeding initial JanSetu database...")

        # 1. Create Default Users
        citizen = User(
            email="citizen@jansetu.in",
            hashed_password=get_password_hash("password123"),
            full_name="Citizen",
            role=UserRole.CITIZEN,
            phone="+91 98765 43210",
            ward="Ward 12",
            is_active=True
        )

        officer = User(
            email="officer@jansetu.in",
            hashed_password=get_password_hash("password123"),
            full_name="Officer Admin",
            role=UserRole.OFFICER,
            phone="+91 98765 01234",
            ward="Ward 12",
            department="Road & Infrastructure Division",
            is_active=True
        )

        admin = User(
            email="admin@jansetu.in",
            hashed_password=get_password_hash("password123"),
            full_name="Municipal Administrator",
            role=UserRole.ADMIN,
            phone="+91 98765 99999",
            ward="Ward 12",
            department="Municipal Administration",
            is_active=True
        )

        db.add_all([citizen, officer, admin])
        db.commit()
        db.refresh(citizen)
        db.refresh(officer)
        db.refresh(admin)

        # 2. Create Initial Grievances
        now = datetime.utcnow()

        g1 = Grievance(
            ticket_id="JS-20481",
            title="Major road damage near Unit 4",
            description="Large pothole near the main entrance of Unit 4 Market. It becomes difficult for vehicles and pedestrians to pass safely during rain. Multiple two-wheelers have skidded.",
            category=GrievanceCategory.ROAD.value,
            status=GrievanceStatus.IN_PROGRESS.value,
            priority=GrievancePriority.CRITICAL.value,
            language="en",
            latitude=20.2961,
            longitude=85.8245,
            address="Unit 4 Market Entrance Road",
            landmark="Near Unit 4 Main Gate",
            ward="Ward 12",
            department="Road & Infrastructure Division",
            ai_confidence=0.94,
            ai_summary="Infrastructure hazard identified. High risk of traffic disruption and accidents. Routed to Road Division.",
            resolution_notes="Work order #RD-884 issued. Repair team dispatched for patch work.",
            community_impact_count=17,
            citizen_id=citizen.id,
            assigned_officer_id=officer.id,
            created_at=now - timedelta(days=2, hours=4)
        )

        g2 = Grievance(
            ticket_id="JS-20475",
            title="Overflowing waste collection point",
            description="Garbage has not been cleared for 3 days near Saheed Nagar community park. Bad smell spreading and stray dogs scattering waste onto the street.",
            category=GrievanceCategory.WASTE.value,
            status=GrievanceStatus.PENDING.value,
            priority=GrievancePriority.HIGH.value,
            language="en",
            latitude=20.2915,
            longitude=85.8450,
            address="Saheed Nagar Community Park Road",
            landmark="Opposite Community Park",
            ward="Ward 12",
            department="Solid Waste & Sanitation Department",
            ai_confidence=0.91,
            ai_summary="Sanitation concern with public health risk. Multiple complaints detected in vicinity.",
            community_impact_count=9,
            citizen_id=citizen.id,
            created_at=now - timedelta(days=1, hours=6)
        )

        g3 = Grievance(
            ticket_id="JS-20469",
            title="Non-functional street lights on 3rd Cross",
            description="Three consecutive street lights are not functioning on 3rd Cross Road, leaving the entire stretch in complete darkness after 7 PM.",
            category=GrievanceCategory.LIGHTING.value,
            status=GrievanceStatus.PENDING.value,
            priority=GrievancePriority.MEDIUM.value,
            language="en",
            latitude=20.3010,
            longitude=85.8300,
            address="3rd Cross Road, Ward 12",
            landmark="Near Electrical Transformer",
            ward="Ward 12",
            department="Electrical & Lighting Department",
            ai_confidence=0.89,
            ai_summary="Electrical utility issue. High impact on nighttime safety.",
            community_impact_count=5,
            citizen_id=citizen.id,
            created_at=now - timedelta(days=3)
        )

        g4 = Grievance(
            ticket_id="JS-20462",
            title="Broken street light near community hall",
            description="Lamp post fixture broken and hanging dangerously from wire near Ward 12 Community Hall.",
            category=GrievanceCategory.LIGHTING.value,
            status=GrievanceStatus.RESOLVED.value,
            priority=GrievancePriority.MEDIUM.value,
            language="en",
            latitude=20.3025,
            longitude=85.8315,
            address="Community Hall Approach Road",
            landmark="Ward 12 Community Hall",
            ward="Ward 12",
            department="Electrical & Lighting Department",
            ai_confidence=0.92,
            ai_summary="Electrical fixture replacement completed.",
            resolution_notes="New LED bulb and fixture replaced by Electrical line team. Tested and fully operational.",
            community_impact_count=12,
            citizen_id=citizen.id,
            assigned_officer_id=officer.id,
            created_at=now - timedelta(days=5),
            resolved_at=now - timedelta(days=1)
        )

        g5 = Grievance(
            ticket_id="JS-20431",
            title="Garbage collection issue in Block B",
            description="Door to door waste collection vehicle skipped Block B for two consecutive mornings.",
            category=GrievanceCategory.WASTE.value,
            status=GrievanceStatus.PENDING.value,
            priority=GrievancePriority.MEDIUM.value,
            language="en",
            latitude=20.2980,
            longitude=85.8390,
            address="Block B Residential Colony",
            landmark="Block B Gate",
            ward="Ward 12",
            department="Solid Waste & Sanitation Department",
            ai_confidence=0.88,
            ai_summary="Routine sanitation route discrepancy.",
            community_impact_count=4,
            citizen_id=citizen.id,
            created_at=now - timedelta(days=4)
        )

        g6 = Grievance(
            ticket_id="JS-20410",
            title="Water pipe leakage flooding footpath",
            description="Main drinking water supply pipeline joint is leaking near Water Tank Road. Clean water is wasting and accumulating on pedestrian sidewalk.",
            category=GrievanceCategory.WATER.value,
            status=GrievanceStatus.IN_PROGRESS.value,
            priority=GrievancePriority.HIGH.value,
            language="en",
            latitude=20.2940,
            longitude=85.8200,
            address="Water Tank Road",
            landmark="Near Municipal Water Reservoir",
            ward="Ward 12",
            department="Public Water Works & Supply Division",
            ai_confidence=0.95,
            ai_summary="Water loss and public pedestrian obstruction. Urgent valve inspection required.",
            resolution_notes="Pipe joint clamp applied; final welding scheduled for tomorrow morning.",
            community_impact_count=14,
            citizen_id=citizen.id,
            assigned_officer_id=officer.id,
            created_at=now - timedelta(days=6)
        )

        db.add_all([g1, g2, g3, g4, g5, g6])
        db.commit()

        # 3. Add Status History
        h1 = GrievanceStatusHistory(
            grievance_id=g1.id,
            old_status="Pending",
            new_status="In Progress",
            changed_by_user_id=officer.id,
            comments="Work order #RD-884 issued to contractor. Inspection team on site.",
            created_at=now - timedelta(days=1)
        )
        h2 = GrievanceStatusHistory(
            grievance_id=g4.id,
            old_status="In Progress",
            new_status="Resolved",
            changed_by_user_id=officer.id,
            comments="Street light fixture replaced and verified functioning.",
            created_at=now - timedelta(days=1)
        )
        db.add_all([h1, h2])

        # 4. Create Participatory Budgeting Projects
        p1 = BudgetProject(
            title="Smart LED Street Lighting Upgrade",
            description="Upgrade 150 old sodium vapor lamps to energy-efficient smart LED lights with automatic dawn/dusk dimming across Ward 12.",
            category="Street Lighting",
            ward="Ward 12",
            estimated_cost=350000.0,
            allocated_funds=200000.0,
            status="In Progress",
            vote_count=42,
            created_by_user_id=officer.id,
            created_at=now - timedelta(days=15)
        )

        p2 = BudgetProject(
            title="Community Rainwater Harvesting & Storm Drain Network",
            description="Construct underground percolation pits and concrete storm drain lines along market area to eliminate monsoon water logging.",
            category="Drainage",
            ward="Ward 12",
            estimated_cost=780000.0,
            allocated_funds=500000.0,
            status="Approved",
            vote_count=88,
            created_by_user_id=officer.id,
            created_at=now - timedelta(days=20)
        )

        p3 = BudgetProject(
            title="Automated Waste Segregation & Composting Unit",
            description="Install decentralized aerobic composting units in the municipal park for organic vegetable and leaf waste.",
            category="Waste Management",
            ward="Ward 12",
            estimated_cost=420000.0,
            allocated_funds=150000.0,
            status="Under Review",
            vote_count=65,
            created_by_user_id=officer.id,
            created_at=now - timedelta(days=10)
        )

        p4 = BudgetProject(
            title="Pedestrian Walkway & Solar Benches along Unit 4 Market",
            description="Paved pedestrian walkway with disabled-friendly ramps, solar mobile charging benches, and green planter boxes.",
            category="Road & Infrastructure",
            ward="Ward 12",
            estimated_cost=550000.0,
            allocated_funds=0.0,
            status="Proposed",
            vote_count=34,
            created_by_user_id=officer.id,
            created_at=now - timedelta(days=5)
        )

        db.add_all([p1, p2, p3, p4])
        db.commit()

        # 5. Create Initial Notifications
        n1 = Notification(
            user_id=citizen.id,
            title="Grievance Status Updated",
            message="Your report #JS-20481 ('Major road damage near Unit 4') is now In Progress.",
            notification_type="status_update",
            link="/citizendashboard.html#reports",
            is_read=False,
            created_at=now - timedelta(hours=8)
        )

        n2 = Notification(
            user_id=citizen.id,
            title="Issue Resolved",
            message="Grievance #JS-20462 ('Broken street light near community hall') has been successfully resolved.",
            notification_type="status_update",
            link="/citizendashboard.html#reports",
            is_read=True,
            created_at=now - timedelta(days=1)
        )

        n3 = Notification(
            user_id=citizen.id,
            title="Participatory Budget Voting Open",
            message="Ward 12 participatory budgeting has 4 active proposals open for citizen voting.",
            notification_type="alert",
            link="/citizendashboard.html#budget",
            is_read=False,
            created_at=now - timedelta(days=2)
        )

        db.add_all([n1, n2, n3])
        db.commit()

        print("JanSetu seed data inserted successfully!")

    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    seed_database()
