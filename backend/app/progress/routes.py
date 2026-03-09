from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.auth.dependencies import get_current_user
from backend.app.db.database import SessionLocal
from backend.app.models.user import User
from backend.app.models.score_history import ScoreHistory
from backend.app.models.skill_progress import SkillProgress


router = APIRouter(
    prefix="/progress",
    tags=["progress"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_student(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: students only"
        )
    return current_user


class SkillToggleRequest(BaseModel):
    resume_id: int
    skill_name: str
    topic: str


# ── Score History ────────────────────────────────────────────────────────────

@router.get("/score-history")
def get_score_history(
    resume_id: int,
    current_user: dict = Depends(require_student),
    db: Session = Depends(get_db)
):
    """Return ATS score history for the given resume, ordered oldest→newest."""
    db_user = db.query(User).filter(User.email == current_user["sub"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    history = (
        db.query(ScoreHistory)
        .filter(
            ScoreHistory.resume_id == resume_id,
            ScoreHistory.user_id == db_user.id
        )
        .order_by(ScoreHistory.evaluated_at.asc())
        .all()
    )

    return [
        {
            "role": h.role,
            "ats_score": h.ats_score,
            "evaluated_at": h.evaluated_at.isoformat() if h.evaluated_at else None,
        }
        for h in history
    ]


# ── Skill Progress ───────────────────────────────────────────────────────────

@router.get("/skill-status")
def get_skill_status(
    resume_id: int,
    current_user: dict = Depends(require_student),
    db: Session = Depends(get_db)
):
    """Return all skill topic checkbox states for the given resume."""
    db_user = db.query(User).filter(User.email == current_user["sub"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    rows = (
        db.query(SkillProgress)
        .filter(
            SkillProgress.resume_id == resume_id,
            SkillProgress.user_id == db_user.id
        )
        .all()
    )

    return [
        {
            "skill_name": r.skill_name,
            "topic": r.topic,
            "is_done": r.is_done,
        }
        for r in rows
    ]


@router.post("/skill/toggle")
def toggle_skill(
    payload: SkillToggleRequest,
    current_user: dict = Depends(require_student),
    db: Session = Depends(get_db)
):
    """Toggle a skill topic's is_done state. Creates the row if it doesn't exist."""
    db_user = db.query(User).filter(User.email == current_user["sub"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    row = (
        db.query(SkillProgress)
        .filter(
            SkillProgress.resume_id == payload.resume_id,
            SkillProgress.user_id == db_user.id,
            SkillProgress.skill_name == payload.skill_name,
            SkillProgress.topic == payload.topic,
        )
        .first()
    )

    if row:
        row.is_done = not row.is_done
    else:
        row = SkillProgress(
            user_id=db_user.id,
            resume_id=payload.resume_id,
            skill_name=payload.skill_name,
            topic=payload.topic,
            is_done=True,
        )
        db.add(row)

    db.commit()
    db.refresh(row)

    return {
        "skill_name": row.skill_name,
        "topic": row.topic,
        "is_done": row.is_done,
    }
