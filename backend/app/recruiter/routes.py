from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.auth.dependencies import get_current_user
from backend.app.db.database import SessionLocal
from backend.app.models.user import User
from backend.app.models.resume import Resume
from backend.app.models.analysis import AnalysisResult
from backend.app.models.score_history import ScoreHistory

router = APIRouter(
    prefix="/recruiter",
    tags=["recruiter"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_recruiter(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Access denied: recruiters only")
    return current_user


@router.get("/candidates")
def list_candidates(
    min_ats: Optional[int] = None,
    role: Optional[str] = None,
    skills: Optional[str] = None,
    current_user: dict = Depends(require_recruiter),
    db: Session = Depends(get_db)
):
    """
    Returns one entry per candidate.
    - Uses ScoreHistory as the source of truth for per-role ATS scores.
    - When `role` filter is provided, shows the ATS score for that specific role.
    - When `min_ats` filter is provided, filters using the role-specific score.
    - `best_resume` per candidate is the one with the best matching score for the requested role.
    """
    requested_skills = []
    if skills:
        requested_skills = [
            s.strip().lower() for s in skills.split(",") if s.strip()
        ]

    # Fetch all score_history entries joined with resume + user
    all_scores = (
        db.query(ScoreHistory, Resume, User)
        .join(Resume, ScoreHistory.resume_id == Resume.id)
        .join(User, ScoreHistory.user_id == User.id)
        .all()
    )

    # Build a dict: candidate_email → list of evaluation entries
    candidate_map = {}

    for score_entry, resume, user in all_scores:
        email = user.email

        # Fetch analysis for matched_skills (still from AnalysisResult for this resume)
        analysis = (
            db.query(AnalysisResult)
            .filter(AnalysisResult.resume_id == resume.id)
            .first()
        )

        matched_skills = []
        if analysis and analysis.result:
            matched_skills = analysis.result.get("ats", {}).get("matched_skills", []) or []

        normalized_skills = [s.strip().lower() for s in matched_skills]

        # Skills filter: skip if skill not matched
        if requested_skills:
            skill_match_count = len(set(requested_skills) & set(normalized_skills))
            if skill_match_count == 0:
                continue
        else:
            skill_match_count = len(normalized_skills)

        entry = {
            "candidate_email": email,
            "resume_id": resume.id,
            "filename": resume.original_filename,
            "role": score_entry.role,
            "ats_score": score_entry.ats_score,
            "evaluated_at": str(score_entry.evaluated_at),
            "matched_skills": matched_skills,
            "skill_match_count": skill_match_count,
        }

        if email not in candidate_map:
            candidate_map[email] = []
        candidate_map[email].append(entry)

    results = []

    for email, evaluations in candidate_map.items():
        # If role filter is active, only keep evaluations for that role
        if role:
            role_evals = [
                e for e in evaluations
                if e["role"].lower() == role.lower()
            ]
            if not role_evals:
                continue
            # Pick the best ATS score among role-specific evaluations
            best = max(role_evals, key=lambda e: e["ats_score"] or 0)
        else:
            # No role filter → pick the evaluation with the highest ATS score
            best = max(evaluations, key=lambda e: e["ats_score"] or 0)

        # Apply min_ats filter using the role-specific (or best) score
        if min_ats is not None:
            if (best["ats_score"] is None) or (best["ats_score"] < min_ats):
                continue

        # Collect all unique roles this candidate has been evaluated for
        all_roles = list({e["role"]: e["ats_score"] for e in evaluations}.items())
        all_roles_formatted = [
            {"role": r, "ats_score": s} for r, s in all_roles
        ]

        results.append({
            "candidate_email": best["candidate_email"],
            "resume_id": best["resume_id"],
            "filename": best["filename"],
            "role": best["role"],
            "ats_score": best["ats_score"],
            "evaluated_at": best["evaluated_at"],
            "matched_skills": best["matched_skills"],
            "all_roles": all_roles_formatted,   # All evaluations for this candidate
        })

    # Sort by ATS score descending
    results.sort(key=lambda x: (x["ats_score"] is None, -(x["ats_score"] or 0)))
    return results


@router.get("/resume/{resume_id}")
def get_candidate_analysis(
    resume_id: int,
    role: Optional[str] = None,
    current_user: dict = Depends(require_recruiter),
    db: Session = Depends(get_db)
):
    """
    Returns full analysis for a resume.
    Optionally accepts ?role= to also return the role-specific ATS score from ScoreHistory.
    """
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    user = db.query(User).filter(User.id == resume.user_id).first()

    analysis = (
        db.query(AnalysisResult)
        .filter(AnalysisResult.resume_id == resume.id)
        .first()
    )

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Fetch ALL role evaluations for this resume from ScoreHistory
    score_entries = (
        db.query(ScoreHistory)
        .filter(ScoreHistory.resume_id == resume_id)
        .order_by(ScoreHistory.evaluated_at.desc())
        .all()
    )

    role_history = [
        {
            "role": s.role,
            "ats_score": s.ats_score,
            "evaluated_at": str(s.evaluated_at),
        }
        for s in score_entries
    ]

    # Role-specific ATS score (from ScoreHistory)
    role_ats_score = None
    if role:
        for s in score_entries:
            if s.role.lower() == role.lower():
                role_ats_score = s.ats_score
                break

    return {
        "candidate_email": user.email if user else None,
        "resume_id": resume.id,
        "filename": resume.original_filename,
        "uploaded_at": resume.uploaded_at,
        "analysis": analysis.result,
        "role_history": role_history,           # All per-role ATS scores
        "role_ats_score": role_ats_score,       # Score for the requested role (if any)
    }
