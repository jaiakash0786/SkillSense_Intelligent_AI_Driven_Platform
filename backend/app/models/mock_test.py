from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from backend.app.db.database import Base


class MockTest(Base):
    __tablename__ = "mock_tests"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recruiter_id = Column(Integer, ForeignKey("users.id"), nullable=True)   # NULL = voluntary
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False)
    role = Column(String, nullable=False)
    skill_topic = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)              # pending / completed
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
