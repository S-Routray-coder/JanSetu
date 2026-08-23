from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class NotificationCreate(BaseModel):
    user_id: int
    title: str
    message: str
    notification_type: Optional[str] = "status_update"
    link: Optional[str] = None


class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    notification_type: str
    link: Optional[str]
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
