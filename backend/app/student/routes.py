from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
import os
import shutil
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.auth.dependencies import get_current_user
from backend.app.db.database import SessionLocal
from backend.app.models.resume import Resume
from backend.app.models.user import User
from backend.app.models.analysis import AnalysisResult
from backend.app.models.score_history import ScoreHistory
from backend.app.services.pipeline import run_pipeline


router = APIRouter(
    prefix="/student",
    tags=["student"]
)


class RoleSelectionRequest(BaseModel):
    target_role: str


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_student(current_user: dict = Depends(get_current_user)):
    """Ensures only users with role='student' can access student routes."""
    if current_user.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: students only"
        )
    return current_user


@router.post("/resume/upload")
def upload_resume(
    resume: UploadFile = File(...),
    current_user: dict = Depends(require_student),
    db: Session = Depends(get_db)
):
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, resume.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(resume.file, buffer)

    db_user = db.query(User).filter(
        User.email == current_user["sub"]
    ).first()

    if not db_user:
        return {"error": "User not found"}

    new_resume = Resume(
        user_id=db_user.id,
        file_path=file_path,
        original_filename=resume.filename
    )

    db.add(new_resume)
    db.commit()
    db.refresh(new_resume)

    # Run AI pipeline within the same session — no manual db.close() + re-open
    ai_result = run_pipeline(
        resume_path=file_path,
        target_role=None
    )

    analysis = AnalysisResult(
        resume_id=new_resume.id,
        result=ai_result
    )

    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    return {
        "message": "Resume uploaded successfully. Select a role to evaluate ATS.",
        "resume_id": new_resume.id,
        "analysis_id": analysis.id,
        "analysis": ai_result
    }


@router.post("/resume/{resume_id}/evaluate")
def evaluate_resume_for_role(
    resume_id: int,
    payload: RoleSelectionRequest,
    current_user: dict = Depends(require_student),
    db: Session = Depends(get_db)
):
    db_user = db.query(User).filter(
        User.email == current_user["sub"]
    ).first()

    if not db_user:
        return {"error": "User not found"}

    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == db_user.id
    ).first()

    if not resume:
        return {"error": "Resume not found or access denied"}

    result = run_pipeline(
        resume_path=resume.file_path,
        target_role=payload.target_role
    )

    # Always create a NEW AnalysisResult per role evaluation.
    # Do NOT overwrite — this preserves history so the recruiter
    # sees the correct score per role via ScoreHistory.
    analysis = AnalysisResult(
        resume_id=resume.id,
        result=result
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    # Auto-record ATS score in history for the Progress Tracker
    ats_score = result.get("ats", {}).get("ats_score") if result.get("ats") else None
    score_entry = ScoreHistory(
        user_id=db_user.id,
        resume_id=resume.id,
        role=payload.target_role,
        ats_score=ats_score
    )
    db.add(score_entry)
    db.commit()

    return {
        "target_role": payload.target_role,
        "ats": result.get("ats"),
        "learning_path": result.get("learning_path")
    }


@router.get("/resume/{resume_id}")
def get_resume_analysis(
    resume_id: int,
    current_user: dict = Depends(require_student),
    db: Session = Depends(get_db)
):
    db_user = db.query(User).filter(
        User.email == current_user["sub"]
    ).first()

    if not db_user:
        return {"error": "User not found"}

    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == db_user.id
    ).first()

    if not resume:
        return {"error": "Resume not found or access denied"}

    analysis = db.query(AnalysisResult).filter(
        AnalysisResult.resume_id == resume.id
    ).first()

    if not analysis:
        return {"error": "Analysis not found for this resume"}

    return {
        "resume_id": resume.id,
        "filename": resume.original_filename,
        "uploaded_at": resume.uploaded_at,
        "analysis": analysis.result
    }


@router.get("/learning-path")
def get_learning_path(
    current_user: dict = Depends(require_student),
    db: Session = Depends(get_db)
):
    """Return the learning path from the most recent resume evaluation for this student."""
    db_user = db.query(User).filter(
        User.email == current_user["sub"]
    ).first()

    if not db_user:
        return {"error": "User not found"}

    # Get all resumes for this user, find the one with analysis containing a learning_path
    resumes = db.query(Resume).filter(
        Resume.user_id == db_user.id
    ).all()

    if not resumes:
        return {"learning_path": None, "message": "No resumes found"}

    latest_analysis = None
    latest_role = None

    # Check analyses in reverse order — get the MOST RECENT AnalysisResult per resume
    for resume in reversed(resumes):
        analysis = (
            db.query(AnalysisResult)
            .filter(AnalysisResult.resume_id == resume.id)
            .order_by(AnalysisResult.id.desc())
            .first()
        )
        if analysis and analysis.result:
            lp = analysis.result.get("learning_path")
            role = analysis.result.get("target_role") or (
                analysis.result.get("ats", {}) or {}
            ).get("target_role")
            if lp:
                latest_analysis = lp
                latest_role = role
                break

    if not latest_analysis:
        return {"learning_path": None, "message": "No learning path generated yet. Please evaluate a resume first."}

    return {
        "target_role": latest_role,
        "learning_path": latest_analysis
    }


@router.get("/resumes")
def list_my_resumes(
    current_user: dict = Depends(require_student),
    db: Session = Depends(get_db)
):
    db_user = db.query(User).filter(
        User.email == current_user["sub"]
    ).first()

    if not db_user:
        return {"error": "User not found"}

    resumes = db.query(Resume).filter(
        Resume.user_id == db_user.id
    ).all()

    results = []

    for resume in resumes:
        analysis = db.query(AnalysisResult).filter(
            AnalysisResult.resume_id == resume.id
        ).first()

        ats_score = None
        if analysis:
            ats_score = analysis.result.get("ats", {}).get("ats_score")

        results.append({
            "resume_id": resume.id,
            "filename": resume.original_filename,
            "uploaded_at": resume.uploaded_at,
            "ats_score": ats_score
        })

    return results
