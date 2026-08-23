# Import all the models, so that Base has them before being
# used by Alembic or Base.metadata.create_all()
from app.core.database import Base
from app.models.user import User
from app.models.grievance import Grievance, GrievanceStatusHistory, GrievanceSupport
from app.models.evidence import Evidence
from app.models.budget import BudgetProject, ProjectVote
from app.models.notification import Notification
