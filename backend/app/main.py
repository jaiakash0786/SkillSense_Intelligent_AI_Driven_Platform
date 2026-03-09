from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from backend.app.db.database import Base, engine
from backend.app.models.user import User
from backend.app.models.resume import Resume
from backend.app.models.analysis import AnalysisResult
from backend.app.models.score_history import ScoreHistory
from backend.app.models.skill_progress import SkillProgress

from backend.app.auth.routes import router as auth_router
from backend.app.student.routes import router as student_router
from backend.app.recruiter.routes import router as recruiter_router
from backend.app.chatbot.routes import router as chatbot_router
from backend.app.progress.routes import router as progress_router

app = FastAPI(
    title="Mimini Backend",
    description="JWT Authentication Backend",
    version="1.0.0",
)

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(student_router)
app.include_router(recruiter_router)
app.include_router(chatbot_router)
app.include_router(progress_router)

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )

    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }

    for path in openapi_schema["paths"].values():
        for method in path.values():
            method["security"] = [{"BearerAuth": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

@app.get("/")
def root():
    return {"status": "Backend is running"}
