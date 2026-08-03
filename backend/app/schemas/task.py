"""
schemas/task.py
----------------
Pydantic v2 schemas used by the FastAPI endpoints for request validation
and response serialization.
"""

from datetime import date, datetime, time
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# /parse endpoint
# --------------------------------------------------------------------------- #

class ParseRequest(BaseModel):
    text: str = Field(..., min_length=1, examples=[
        "Complete my cloud computing report next Monday at 10 AM. It's urgent. #college"
    ])


class ParseResponse(BaseModel):
    title: str
    raw_text: str
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    priority: str
    priority_label: str
    priority_emoji: str
    priority_color: str
    category: str
    category_label: str
    category_color: str
    tags: List[str] = []
    recurrence: str = "none"
    matched_temporal_text: Optional[str] = None


# --------------------------------------------------------------------------- #
# CRUD schemas
# --------------------------------------------------------------------------- #

class TaskCreate(BaseModel):
    """Used when creating a task directly from raw natural language.
    parent_id: set this to create a subtask under an existing task."""
    text: str = Field(..., min_length=1)
    parent_id: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    reminder_offset_minutes: Optional[int] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    recurrence: Optional[str] = None
    is_completed: Optional[bool] = None
    reminder_notified: Optional[bool] = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    parent_id: Optional[str] = None
    title: str
    raw_text: str
    notes: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    reminder_offset_minutes: Optional[int] = None
    priority: str
    category: str
    tags: List[str] = []
    recurrence: str = "none"
    is_completed: bool
    reminder_notified: bool = False
    time_spent_seconds: int = 0
    created_at: datetime
    completed_at: Optional[datetime] = None
    subtasks: List["TaskOut"] = []


class TimeLogRequest(BaseModel):
    seconds: int = Field(..., ge=1, le=14400)  # cap a single log at 4 hours, sanity check


TaskOut.model_rebuild()
