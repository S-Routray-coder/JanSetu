from typing import Optional
from sqlalchemy.orm import Session
from app.models.notification import Notification


class NotificationManager:
    """
    Manages in-app notification dispatch and logging.
    """

    @staticmethod
    def notify_user(
        db: Session,
        user_id: int,
        title: str,
        message: str,
        notification_type: str = "status_update",
        link: Optional[str] = None
    ) -> Notification:
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            link=link
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif

    @classmethod
    def notify_grievance_status_change(
        cls,
        db: Session,
        citizen_id: int,
        ticket_id: str,
        title: str,
        old_status: str,
        new_status: str
    ):
        msg = f"Your report #{ticket_id} ('{title}') status changed from {old_status} to {new_status}."
        cls.notify_user(
            db=db,
            user_id=citizen_id,
            title=f"Grievance #{ticket_id} {new_status}",
            message=msg,
            notification_type="status_update",
            link=f"/citizendashboard.html#reports"
        )
