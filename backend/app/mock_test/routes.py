import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.auth.dependencies import get_current_user
from backend.app.db.database import SessionLocal
from backend.app.models.user import User
from backend.app.models.resume import Resume
from backend.app.models.mock_test import MockTest
from backend.app.models.mock_test_result import MockTestResult
from backend.app.models.score_history import ScoreHistory
from backend.app.mock_test.question_generator import generate_mcq_questions, evaluate_coding_answer

router = APIRouter(prefix="/mock-test", tags=["mock-test"])


# ── DB Dependency ─────────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Auth Helpers ──────────────────────────────────────────────────────────────

def require_student(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Students only")
    return current_user


def require_recruiter(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="Recruiters only")
    return current_user


# ── Helper: look up latest ATS score for a student+role ──────────────────────

def _get_ats_score(db: Session, user_id: int, resume_id: int, role: str) -> Optional[float]:
    record = (
        db.query(ScoreHistory)
        .filter(
            ScoreHistory.user_id == user_id,
            ScoreHistory.resume_id == resume_id,
            ScoreHistory.role == role,
        )
        .order_by(ScoreHistory.evaluated_at.desc())
        .first()
    )
    return record.ats_score if record else None


# ── Request / Response Schemas ────────────────────────────────────────────────

class StartTestRequest(BaseModel):
    resume_id: int
    role: str
    skill_topic: str


class SubmitAnswer(BaseModel):
    question: str
    chosen: Optional[str] = None   # None = unanswered; "A"|"B"|"C"|"D" when answered
    correct: Optional[str] = None
    is_correct: bool = False


class CodingAnswer(BaseModel):
    question: str
    answer_text: str


class ViolationEvent(BaseModel):
    type: str        # "tab_switch" | "no_face" | "multiple_faces" | "fullscreen_exit" | "copy_attempt"
    timestamp: str   # ISO string


class SubmitTestRequest(BaseModel):
    mock_test_id: int
    answers: List[SubmitAnswer] = []        # empty = all skipped
    coding_answers: List[CodingAnswer] = []
    fullscreen_exits: int = 0
    violations: List[ViolationEvent] = []


class AssignTestRequest(BaseModel):
    student_email: str
    resume_id: int
    role: str
    skill_topic: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/start")
def start_test(
    payload: StartTestRequest,
    current_user: dict = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Student starts a voluntary mock test. Returns mock_test_id + generated questions."""
    db_user = db.query(User).filter(User.email == current_user["sub"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    resume = db.query(Resume).filter(
        Resume.id == payload.resume_id,
        Resume.user_id == db_user.id
    ).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Look up ATS score for adaptive difficulty
    ats_score = _get_ats_score(db, db_user.id, payload.resume_id, payload.role)

    try:
        questions = generate_mcq_questions(payload.role, payload.skill_topic, ats_score=ats_score)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Question generation failed: {str(e)}")

    mock_test = MockTest(
        student_id=db_user.id,
        recruiter_id=None,
        resume_id=payload.resume_id,
        role=payload.role,
        skill_topic=payload.skill_topic,
        status="pending",
    )
    db.add(mock_test)
    db.commit()
    db.refresh(mock_test)

    return {
        "mock_test_id": mock_test.id,
        "role": mock_test.role,
        "skill_topic": mock_test.skill_topic,
        "ats_score": ats_score,
        "questions": questions,
    }


@router.post("/start-assigned/{mock_test_id}")
def start_assigned_test(
    mock_test_id: int,
    current_user: dict = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Student starts a recruiter-assigned pending test. Returns questions."""
    db_user = db.query(User).filter(User.email == current_user["sub"]).first()
    mock_test = db.query(MockTest).filter(
        MockTest.id == mock_test_id,
        MockTest.student_id == db_user.id,
        MockTest.status == "pending",
    ).first()
    if not mock_test:
        raise HTTPException(status_code=404, detail="Assigned test not found or already completed")

    ats_score = _get_ats_score(db, db_user.id, mock_test.resume_id, mock_test.role)

    try:
        questions = generate_mcq_questions(mock_test.role, mock_test.skill_topic, ats_score=ats_score)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Question generation failed: {str(e)}")

    return {
        "mock_test_id": mock_test.id,
        "role": mock_test.role,
        "skill_topic": mock_test.skill_topic,
        "ats_score": ats_score,
        "questions": questions,
    }


@router.post("/submit")
def submit_test(
    payload: SubmitTestRequest,
    current_user: dict = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Submit answers + coding answers. AI-grades coding. Returns full score summary."""
    db_user = db.query(User).filter(User.email == current_user["sub"]).first()

    mock_test = db.query(MockTest).filter(
        MockTest.id == payload.mock_test_id,
        MockTest.student_id == db_user.id,
    ).first()
    if not mock_test:
        raise HTTPException(status_code=404, detail="Test not found")
    if mock_test.status == "completed":
        raise HTTPException(status_code=400, detail="Test already submitted")

    # ── MCQ scoring ───────────────────────────────────────────────────────────
    total_mcq = len(payload.answers)
    correct_mcq = sum(1 for a in payload.answers if a.is_correct)
    mcq_score = round((correct_mcq / total_mcq) * 100, 1) if total_mcq > 0 else 0.0

    # ── Coding answer AI evaluation ───────────────────────────────────────────
    evaluated_coding = []
    coding_total_score = 0
    for ca in payload.coding_answers:
        eval_result = evaluate_coding_answer(ca.question, ca.answer_text, mock_test.role)
        evaluated_coding.append({
            "question": ca.question,
            "answer_text": ca.answer_text,
            "ai_score": eval_result["score"],       # 0-10
            "ai_feedback": eval_result["feedback"],
        })
        coding_total_score += eval_result["score"]

    # ── Combined score (MCQ 70% weight, coding 30% weight) ───────────────────
    num_coding = len(evaluated_coding)
    if num_coding > 0:
        coding_score_pct = round((coding_total_score / (num_coding * 10)) * 100, 1)
        combined_score = round(mcq_score * 0.7 + coding_score_pct * 0.3, 1)
    else:
        combined_score = mcq_score

    result = MockTestResult(
        mock_test_id=mock_test.id,
        score=combined_score,
        total_questions=total_mcq + num_coding,   # MCQ + coding questions
        correct_answers=correct_mcq,
        answers_json=json.dumps([a.dict() for a in payload.answers]),
        coding_answers_json=json.dumps(evaluated_coding) if evaluated_coding else "[]",
        fullscreen_exits=payload.fullscreen_exits,
        violations_json=json.dumps([v.dict() for v in payload.violations]) if payload.violations else "[]",
    )
    db.add(result)

    mock_test.status = "completed"
    mock_test.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(result)

    return {
        "score": combined_score,
        "mcq_score": mcq_score,
        "correct_answers": correct_mcq,
        "total_questions": total_mcq,
        "coding_results": evaluated_coding,
        "fullscreen_exits": payload.fullscreen_exits,
        "violation_count": len(payload.violations),
        "mock_test_id": mock_test.id,
    }


@router.get("/my-tests")
def get_my_tests(
    current_user: dict = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Return all completed tests taken by the logged-in student (with scores)."""
    db_user = db.query(User).filter(User.email == current_user["sub"]).first()

    tests = (
        db.query(MockTest, MockTestResult)
        .outerjoin(MockTestResult, MockTest.id == MockTestResult.mock_test_id)
        .filter(MockTest.student_id == db_user.id)
        .order_by(MockTest.assigned_at.desc())
        .all()
    )

    return [
        {
            "mock_test_id": t.id,
            "role": t.role,
            "skill_topic": t.skill_topic,
            "status": t.status,
            "is_assigned": t.recruiter_id is not None,
            "assigned_at": str(t.assigned_at),
            "completed_at": str(t.completed_at) if t.completed_at else None,
            "score": r.score if r else None,
            "correct_answers": r.correct_answers if r else None,
            "total_questions": r.total_questions if r else None,
        }
        for t, r in tests
    ]


@router.get("/assigned")
def get_assigned_tests(
    current_user: dict = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Return pending recruiter-assigned tests for the logged-in student."""
    db_user = db.query(User).filter(User.email == current_user["sub"]).first()

    tests = (
        db.query(MockTest)
        .filter(
            MockTest.student_id == db_user.id,
            MockTest.recruiter_id != None,
            MockTest.status == "pending",
        )
        .order_by(MockTest.assigned_at.desc())
        .all()
    )

    return [
        {
            "mock_test_id": t.id,
            "role": t.role,
            "skill_topic": t.skill_topic,
            "assigned_at": str(t.assigned_at),
        }
        for t in tests
    ]


@router.post("/assign")
def assign_test(
    payload: AssignTestRequest,
    current_user: dict = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Recruiter assigns a mock test to a student by email."""
    recruiter = db.query(User).filter(User.email == current_user["sub"]).first()

    student = db.query(User).filter(
        User.email == payload.student_email,
        User.role == "student",
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    resume = db.query(Resume).filter(
        Resume.id == payload.resume_id,
        Resume.user_id == student.id,
    ).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found for this student")

    mock_test = MockTest(
        student_id=student.id,
        recruiter_id=recruiter.id,
        resume_id=payload.resume_id,
        role=payload.role,
        skill_topic=payload.skill_topic,
        status="pending",
    )
    db.add(mock_test)
    db.commit()
    db.refresh(mock_test)

    return {
        "message": f"Mock test assigned to {payload.student_email}",
        "mock_test_id": mock_test.id,
        "role": mock_test.role,
        "skill_topic": mock_test.skill_topic,
    }


@router.get("/results/{student_id}")
def get_student_results(
    student_id: int,
    current_user: dict = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Recruiter views all mock test results for a given student."""
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    tests = (
        db.query(MockTest, MockTestResult)
        .outerjoin(MockTestResult, MockTest.id == MockTestResult.mock_test_id)
        .filter(MockTest.student_id == student_id)
        .order_by(MockTest.assigned_at.desc())
        .all()
    )

    return {
        "student_email": student.email,
        "results": [
            {
                "mock_test_id": t.id,
                "role": t.role,
                "skill_topic": t.skill_topic,
                "status": t.status,
                "is_assigned": t.recruiter_id is not None,
                "assigned_at": str(t.assigned_at),
                "completed_at": str(t.completed_at) if t.completed_at else None,
                "score": r.score if r else None,
                "correct_answers": r.correct_answers if r else None,
                "total_questions": r.total_questions if r else None,
                "fullscreen_exits": r.fullscreen_exits if r else None,
                "violations": json.loads(r.violations_json) if r and r.violations_json else [],
                "coding_results": json.loads(r.coding_answers_json) if r and r.coding_answers_json else [],
            }
            for t, r in tests
        ],
    }


@router.get("/results/by-email/{student_email:path}")
def get_student_results_by_email(
    student_email: str,
    current_user: dict = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Recruiter views mock test results for a candidate — lookup by email."""
    student = db.query(User).filter(User.email == student_email, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return get_student_results(student.id, current_user, db)
