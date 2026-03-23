from sqlalchemy import Column, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from backend.app.db.database import Base


class MockTestResult(Base):
    __tablename__ = "mock_test_results"

    id = Column(Integer, primary_key=True, index=True)
    mock_test_id = Column(Integer, ForeignKey("mock_tests.id"), nullable=False)
    score = Column(Float, nullable=False)               # percentage 0-100
    total_questions = Column(Integer, nullable=False)
    correct_answers = Column(Integer, nullable=False)
    answers_json = Column(Text, nullable=True)           # JSON: [{question, chosen, correct, is_correct}]
    coding_answers_json = Column(Text, nullable=True)    # JSON: [{question, answer_text, ai_score, ai_feedback}]
    fullscreen_exits = Column(Integer, default=0)
    violations_json = Column(Text, nullable=True)        # JSON: [{type, timestamp}]
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())

