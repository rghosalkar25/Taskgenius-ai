"""
models/task.py
---------------
SQLAlchemy ORM model representing a single task row in SQLite.

New in this version:
    - user_id      -> owning user (all tasks are now scoped to a user)
    - tags         -> JSON list of strings, e.g. ["urgent", "college"]
    - parent_id    -> self-referential FK; non-null means this row is a subtask
    - recurrence   -> "none" | "daily" | "weekly" | "monthly"
    - reminder_notified -> whether the frontend has already fired a browser
                            notification for this task's due time (prevents repeats)
    - notes        -> free-text notes field
    - reminder_offset_minutes -> minutes before due_time to notify (None = at due time)
    - time_spent_seconds -> cumulative focus-timer time logged against this task
"""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import backref, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    parent_id = Column(String, ForeignKey("tasks.id"), nullable=True, index=True)

    title = Column(String, nullable=False)
    raw_text = Column(String, nullable=False)
    notes = Column(Text, nullable=True)

    due_date = Column(Date, nullable=True)
    due_time = Column(Time, nullable=True)
    reminder_offset_minutes = Column(Integer, nullable=True)  # None = notify exactly at due time

    priority = Column(String, nullable=False, default="low")       # high | medium | low
    category = Column(String, nullable=False, default="general")   # study | work | personal | health | finance | general
    tags = Column(JSON, nullable=False, default=list)               # ["tag1", "tag2"]
    recurrence = Column(String, nullable=False, default="none")     # none | daily | weekly | monthly

    is_completed = Column(Boolean, nullable=False, default=False)
    reminder_notified = Column(Boolean, nullable=False, default=False)
    time_spent_seconds = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    owner = relationship("User", back_populates="tasks")
    subtasks = relationship(
        "Task",
        cascade="all, delete-orphan",
        backref=backref("parent", remote_side=[id]),
    )
