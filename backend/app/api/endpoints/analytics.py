"""
api/endpoints/analytics.py
----------------------------
Productivity analytics used by the dashboard:
    GET /api/analytics/summary -> completion %, streaks, overdue count,
                                   distributions, and a 7-day completion trend
"""

from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.database import get_db
from app.models.task import Task
from app.models.user import User

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _current_streak(all_tasks: list[Task]) -> int:
    """Consecutive days (ending today or yesterday) with at least one completed task."""
    completed_dates = {
        t.completed_at.date() for t in all_tasks if t.is_completed and t.completed_at
    }
    if not completed_dates:
        return 0

    today = datetime.utcnow().date()
    cursor = today if today in completed_dates else today - timedelta(days=1)
    if cursor not in completed_dates:
        return 0

    streak = 0
    while cursor in completed_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


@router.get("/summary")
def get_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = datetime.utcnow().date()

    all_tasks = db.query(Task).filter(Task.user_id == current_user.id).all()
    today_tasks = [t for t in all_tasks if t.due_date == today]

    total_today = len(today_tasks)
    completed_today = len([t for t in today_tasks if t.is_completed])
    completion_pct = round((completed_today / total_today) * 100, 1) if total_today else 0.0

    overdue = [
        t for t in all_tasks
        if t.due_date and t.due_date < today and not t.is_completed
    ]

    category_counts: dict[str, int] = {}
    priority_counts: dict[str, int] = {}
    tag_counter: Counter = Counter()

    for t in all_tasks:
        category_counts[t.category] = category_counts.get(t.category, 0) + 1
        priority_counts[t.priority] = priority_counts.get(t.priority, 0) + 1
        for tag in (t.tags or []):
            tag_counter[tag] += 1

    # Last 7 days completion trend
    trend = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        count = len([
            t for t in all_tasks
            if t.is_completed and t.completed_at and t.completed_at.date() == day
        ])
        trend.append({"date": day.isoformat(), "completed": count})

    return {
        "completion_percentage": completion_pct,
        "total_today": total_today,
        "completed_today": completed_today,
        "overdue_count": len(overdue),
        "current_streak": _current_streak(all_tasks),
        "total_time_spent_seconds": sum(t.time_spent_seconds or 0 for t in all_tasks),
        "category_distribution": [
            {"category": k, "count": v} for k, v in category_counts.items()
        ],
        "priority_distribution": [
            {"priority": k, "count": v} for k, v in priority_counts.items()
        ],
        "top_tags": [
            {"tag": tag, "count": count} for tag, count in tag_counter.most_common(8)
        ],
        "completion_trend": trend,
        "total_tasks": len(all_tasks),
        "total_completed": len([t for t in all_tasks if t.is_completed]),
    }
