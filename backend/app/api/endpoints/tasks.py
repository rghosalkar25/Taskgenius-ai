"""
api/endpoints/tasks.py
-----------------------
FastAPI router exposing (all endpoints require a bearer token and are
scoped to the authenticated user):

    POST   /api/tasks/parse        -> run the NLP pipeline only (no DB write), for
                                       the SmartInputBar live-preview feature
    POST   /api/tasks/             -> parse + persist a new task (or subtask) from raw text
    GET    /api/tasks/             -> list top-level tasks (optionally filtered), with subtasks nested
    GET    /api/tasks/{id}         -> fetch a single task
    PATCH  /api/tasks/{id}         -> update a task (e.g. mark complete, edit tags)
    DELETE /api/tasks/{id}         -> delete a task (and its subtasks)
"""

from datetime import date, datetime, time, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database import get_db
from app.models.task import Task
from app.models.user import User
from app.schemas.task import ParseRequest, ParseResponse, TaskCreate, TaskOut, TaskUpdate, TimeLogRequest
from app.services.nlp_engine import parse_task

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _next_recurrence_date(current: date, recurrence: str) -> Optional[date]:
    if recurrence == "daily":
        return current + timedelta(days=1)
    if recurrence == "weekly":
        return current + timedelta(weeks=1)
    if recurrence == "monthly":
        # simple +30 days rollover, good enough for a student project
        return current + timedelta(days=30)
    return None


@router.post("/parse", response_model=ParseResponse)
def parse_text(payload: ParseRequest, current_user: User = Depends(get_current_user)):
    """Run the NLP pipeline on raw text WITHOUT saving to the DB.
    Powers the SmartInputBar's real-time tag preview."""
    result = parse_task(payload.text)
    return ParseResponse(**result.__dict__)


@router.post("/", response_model=TaskOut, status_code=201)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parse raw text and persist the resulting task. If parent_id is set,
    this becomes a subtask of that task (must belong to the same user)."""
    if payload.parent_id:
        parent = (
            db.query(Task)
            .filter(Task.id == payload.parent_id, Task.user_id == current_user.id)
            .first()
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Parent task not found")

    parsed = parse_task(payload.text)

    parsed_due_date = date.fromisoformat(parsed.due_date) if parsed.due_date else None
    parsed_due_time = time.fromisoformat(parsed.due_time) if parsed.due_time else None

    task = Task(
        user_id=current_user.id,
        parent_id=payload.parent_id,
        title=parsed.title,
        raw_text=parsed.raw_text,
        due_date=parsed_due_date,
        due_time=parsed_due_time,
        priority=parsed.priority,
        category=parsed.category,
        tags=parsed.tags,
        recurrence=parsed.recurrence,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/", response_model=List[TaskOut])
def list_tasks(
    filter: Optional[str] = Query(
        default=None,
        description="today | upcoming | high_priority | completed",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only top-level tasks here; subtasks come nested via the relationship.
    query = db.query(Task).filter(Task.user_id == current_user.id, Task.parent_id.is_(None))

    if filter == "today":
        query = query.filter(Task.due_date == datetime.utcnow().date(), Task.is_completed.is_(False))
    elif filter == "upcoming":
        query = query.filter(Task.due_date > datetime.utcnow().date(), Task.is_completed.is_(False))
    elif filter == "high_priority":
        query = query.filter(Task.priority == "high", Task.is_completed.is_(False))
    elif filter == "completed":
        query = query.filter(Task.is_completed.is_(True))

    return query.order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc()).all()


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("is_completed") is True and not task.is_completed:
        task.completed_at = datetime.utcnow()

        # Recurring task: spin up the next occurrence automatically
        if task.recurrence != "none" and task.due_date:
            next_due = _next_recurrence_date(task.due_date, task.recurrence)
            if next_due:
                clone = Task(
                    user_id=current_user.id,
                    parent_id=task.parent_id,
                    title=task.title,
                    raw_text=task.raw_text,
                    due_date=next_due,
                    due_time=task.due_time,
                    priority=task.priority,
                    category=task.category,
                    tags=task.tags,
                    recurrence=task.recurrence,
                )
                db.add(clone)
    elif update_data.get("is_completed") is False:
        task.completed_at = None

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/log-time", response_model=TaskOut)
def log_time(
    task_id: str,
    payload: TimeLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Increment a task's cumulative focus-timer time server-side, so
    concurrent tabs/sessions can't clobber each other's totals."""
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.time_spent_seconds = (task.time_spent_seconds or 0) + payload.seconds
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return None
