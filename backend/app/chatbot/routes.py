import os
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from groq import Groq

from backend.app.auth.dependencies import get_current_user
from backend.app.db.database import SessionLocal
from backend.app.models.user import User
from backend.app.models.resume import Resume
from backend.app.models.analysis import AnalysisResult


router = APIRouter(prefix="/student", tags=["chatbot"])

client = Groq(api_key=os.getenv("CHATBOT_GROQ_API_KEY"))


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    resume_id: Optional[int] = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def build_system_prompt(user_email: str, analysis: dict | None) -> str:
    """Build a personalised system prompt using the user's resume analysis."""

    base = f"""You are SkillBot, a personalized AI career assistant for {user_email}.
You help users with:
1. Free learning resources (YouTube channels, freeCodeCamp, official docs, Coursera free tier, MIT OpenCourseWare, etc.)
2. Course suggestions mapped to their skill gaps
3. Resume improvement tips and ATS score observations
4. Career guidance and role recommendations

Always be encouraging, concise, and practical.
When suggesting resources, prefer free ones and include specific names/links where possible.
"""

    if not analysis:
        base += "\nThe user has not yet uploaded a resume. Encourage them to upload one for personalized advice."
        return base

    # Pull data from the pipeline result
    roles = analysis.get("roles", [])
    target_role = analysis.get("target_role", "Not selected yet")
    ats = analysis.get("ats", {})
    ats_score = ats.get("ats_score", "N/A")
    missing_skills_raw = ats.get("missing_skills", [])
    strengths = ats.get("strengths", [])
    recommendations = ats.get("recommendations", [])

    # Normalise missing_skills (can be list or dict with 'core' key)
    if isinstance(missing_skills_raw, dict):
        missing_skills = missing_skills_raw.get("core", [])
    else:
        missing_skills = missing_skills_raw

    # Learning path top 3
    lp = analysis.get("learning_path", {}) or {}
    lp_items = lp.get("learning_path", [])[:3]
    lp_summary = ""
    for item in lp_items:
        skill = item.get("skill", "")
        level = item.get("level", "")
        topics = ", ".join(item.get("focus_topics", [])[:3])
        lp_summary += f"\n  - {skill} ({level}): focus on {topics}"

    role_names = [r.get("role", "") for r in roles[:4]]

    context = f"""
### User's Resume Context
- **Detected Roles**: {', '.join(role_names) if role_names else 'None detected'}
- **Target Role**: {target_role}
- **ATS Score**: {ats_score}/100
- **Missing Skills**: {', '.join(missing_skills) if missing_skills else 'None'}
- **Strengths**: {', '.join(strengths) if strengths else 'Not analysed yet'}
- **ATS Recommendations**: {'; '.join(recommendations) if recommendations else 'None'}
- **Top Learning Path Items**: {lp_summary if lp_summary else ' None generated yet'}

Use this context to give highly personalised answers.
Only refer to skills, roles, and scores that appear above — do not invent data.
If the user asks about their resume, ATS score, or missing skills, use the exact values above.
"""

    return base + context


@router.post("/chat")
def chat(
    payload: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_email = current_user.get("sub", "User")

    # Load resume analysis for context
    analysis_data = None

    if payload.resume_id:
        db_user = db.query(User).filter(User.email == user_email).first()
        if db_user:
            resume = db.query(Resume).filter(
                Resume.id == payload.resume_id,
                Resume.user_id == db_user.id
            ).first()

            if resume:
                analysis = db.query(AnalysisResult).filter(
                    AnalysisResult.resume_id == resume.id
                ).order_by(AnalysisResult.id.desc()).first()
                if analysis:
                    analysis_data = analysis.result
    else:
        # Use latest resume if no specific resume_id
        db_user = db.query(User).filter(User.email == user_email).first()
        if db_user:
            latest_resume = db.query(Resume).filter(
                Resume.user_id == db_user.id
            ).order_by(Resume.id.desc()).first()

            if latest_resume:
                analysis = db.query(AnalysisResult).filter(
                    AnalysisResult.resume_id == latest_resume.id
                ).order_by(AnalysisResult.id.desc()).first()
                if analysis:
                    analysis_data = analysis.result

    system_prompt = build_system_prompt(user_email, analysis_data)

    # Build messages for Groq
    groq_messages = [{"role": "system", "content": system_prompt}]
    for msg in payload.messages:
        groq_messages.append({"role": msg.role, "content": msg.content})

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=groq_messages,
            max_tokens=1024,
            temperature=0.7,
        )
        reply = response.choices[0].message.content
        return {"reply": reply}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")
