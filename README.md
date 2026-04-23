# 🧠 SkillSense — Intelligent AI-Driven Skill Analysis Platform

<p align="center">
  <img src="https://img.shields.io/badge/AI%20Powered-LLM%20%2B%20RAG-blueviolet?style=for-the-badge&logo=openai" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi" />
  <img src="https://img.shields.io/badge/Frontend-React.js-61DAFB?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/Database-SQLite-003B57?style=for-the-badge&logo=sqlite" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</p>

> **SkillSense** is an end-to-end AI-powered career intelligence platform that analyses student resumes, evaluates them against ATS (Applicant Tracking System) standards, generates personalized learning paths, conducts adaptive mock tests, and provides recruiters with AI-assisted candidate shortlisting — all powered by a RAG-augmented LLM pipeline.

---

## 📌 Table of Contents

- [✨ Features](#-features)
- [🏗️ System Architecture](#️-system-architecture)
- [🧩 Tech Stack](#-tech-stack)
- [📁 Project Structure](#-project-structure)
- [⚙️ Setup & Installation](#️-setup--installation)
  - [Backend](#backend-fastapi)
  - [Frontend](#frontend-reactjs)
- [🔐 Environment Variables](#-environment-variables)
- [🚀 Running the Application](#-running-the-application)
- [🌐 API Overview](#-api-overview)
- [🎓 Student Workflow](#-student-workflow)
- [🏢 Recruiter Workflow](#-recruiter-workflow)
- [📊 AI Pipeline](#-ai-pipeline)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

### 🎓 For Students
| Feature | Description |
|---|---|
| **Resume Upload & Parsing** | Upload PDF resumes; LLM extracts structured skills, experience, and education |
| **ATS Score Evaluation** | AI evaluates resume against role-specific ATS criteria using RAG context |
| **Skill Gap Analysis** | Identifies missing skills for target roles with confidence scores |
| **Personalized Learning Path** | Generates step-by-step learning roadmaps for skill gaps |
| **Adaptive Mock Tests** | Role-specific, difficulty-adaptive DSA and domain quizzes |
| **Progress Tracker** | Tracks completed skills, mock test performance, and learning milestones |
| **AI Chatbot Assistant** | Context-aware chatbot powered by RAG for career Q&A |

### 🏢 For Recruiters
| Feature | Description |
|---|---|
| **Candidate Dashboard** | View all registered students with ATS scores and skill summaries |
| **AI-Powered Resume Review** | LLM generates detailed candidate assessments |
| **Smart Shortlisting** | Filter and rank candidates by role fit, ATS score, and skill match |
| **Batch Analysis** | Analyze multiple resumes and export insights |

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React.js)                        │
│  Login │ Register │ Student Dashboard │ Recruiter Dashboard       │
│  Mock Test │ Learning Path │ Progress Tracker │ ChatBot            │
└─────────────────────────┬────────────────────────────────────────┘
                          │ REST API (HTTP/JSON)
┌─────────────────────────▼────────────────────────────────────────┐
│                      BACKEND (FastAPI)                            │
│  /auth  │  /student  │  /recruiter  │  /mock_test  │  /chatbot   │
│  /progress  │  /learning_path  │  /ats  │  /resume               │
└──────┬──────────────────────────────────────────────────┬────────┘
       │                                                  │
┌──────▼──────────┐                          ┌───────────▼──────────┐
│   SQLite DB     │                          │   AI/ML Pipeline     │
│  (mimini.db)    │                          │                       │
│  Users          │                          │  ┌─────────────────┐ │
│  Resumes        │                          │  │  LLM (Gemini)   │ │
│  Skills         │                          │  │  Resume Parser  │ │
│  Progress       │                          │  │  ATS Evaluator  │ │
│  Mock Tests     │                          │  │  Learning Path  │ │
│  Sessions       │                          │  │  Role Detector  │ │
└─────────────────┘                          │  └────────┬────────┘ │
                                             │           │          │
                                             │  ┌────────▼────────┐ │
                                             │  │   RAG Engine    │ │
                                             │  │ (ChromaDB +     │ │
                                             │  │  Sentence       │ │
                                             │  │  Transformers)  │ │
                                             │  └─────────────────┘ │
                                             └──────────────────────┘
```

---

## 🧩 Tech Stack

### Backend
| Layer | Technology |
|---|---|
| **Framework** | FastAPI (Python) |
| **Database** | SQLite via SQLAlchemy ORM |
| **AI / LLM** | Google Gemini Pro API |
| **RAG Engine** | ChromaDB + Sentence Transformers (`all-MiniLM-L6-v2`) |
| **Resume Parsing** | PyMuPDF (fitz) + LLM extraction |
| **Authentication** | JWT (JSON Web Tokens) + bcrypt |
| **Skill Normalization** | Custom fuzzy matching service |

### Frontend
| Layer | Technology |
|---|---|
| **Framework** | React.js (CRA) |
| **Routing** | React Router v6 |
| **State Management** | React Hooks (useState, useEffect, useContext) |
| **HTTP Client** | Axios |
| **Styling** | Vanilla CSS (custom design system) |
| **Charts** | Recharts |

---

## 📁 Project Structure

```
SkillSense_Intelligent_AI_Driven_Platform/
│
├── backend/
│   └── app/
│       ├── main.py                  # FastAPI app entry point & router registration
│       ├── auth/                    # JWT authentication (login, register, token)
│       ├── student/                 # Student endpoints (dashboard, resume upload)
│       ├── recruiter/               # Recruiter endpoints (candidate list, AI review)
│       ├── mock_test/               # Adaptive mock test engine
│       ├── progress/                # Progress tracking & skill checklist
│       ├── chatbot/                 # RAG-powered chatbot endpoint
│       ├── models/                  # SQLAlchemy ORM models
│       ├── schemas/                 # Pydantic request/response schemas
│       ├── db/                      # Database session & initialization
│       ├── services/                # Business logic services
│       └── utils/                   # Helper utilities
│
├── frontend/
│   └── src/
│       ├── App.js                   # Root component with routing
│       ├── pages/
│       │   ├── Login.js             # Login page
│       │   ├── Register.js          # Registration page
│       │   ├── StudentDashboard.js  # Student home with skill analysis
│       │   ├── RecruiterDashboard.js# Recruiter candidate management
│       │   ├── MockTest.js          # Adaptive mock test interface
│       │   ├── LearningPath.js      # Personalized learning roadmap
│       │   └── ProgressTracker.js   # Skill progress & milestones
│       ├── components/
│       │   ├── ChatBot.js           # Floating AI chatbot widget
│       │   ├── Navbar.js            # Navigation bar
│       │   ├── SplashScreen.js      # Animated loading screen
│       │   └── ProtectedRoute.js    # JWT-guarded route wrapper
│       └── utils/                   # API helpers & constants
│
├── rag/                             # RAG knowledge base documents
├── services/                        # Standalone AI service scripts
├── rag_engine_v2.py                 # MetadataRAGEngine (ChromaDB-based)
├── ats_evaluator.py                 # ATS scoring logic
├── learning_path_generator.py       # Learning path generation
├── resume_parser.py                 # LLM resume extraction
├── resume_reader.py                 # PDF text extractor
├── role_detector.py                 # AI role inference
├── main.py                          # Standalone pipeline runner (dev/test)
├── architecture.html                # Interactive architecture diagrams
├── requirements.txt                 # Python dependencies
└── README.md
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- Google Gemini API Key

---

### Backend (FastAPI)

```bash
# 1. Clone the repository
git clone https://github.com/jaiakash0786/SkillSense_Intelligent_AI_Driven_Platform.git
cd SkillSense_Intelligent_AI_Driven_Platform

# 2. Create and activate virtual environment
python -m venv venv

# On Windows
venv\Scripts\activate

# On macOS/Linux
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment variables (see below)
# Create a .env file in the root directory

# 5. Start the FastAPI backend
uvicorn backend.app.main:app --reload --port 8000
```

---

### Frontend (React.js)

```bash
# Navigate to the frontend directory
cd frontend

# Install npm dependencies
npm install

# Start the React development server
npm start
```

The frontend will be available at **http://localhost:3000** and the backend API at **http://localhost:8000**.

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Google Gemini API Key
GOOGLE_API_KEY=your_gemini_api_key_here

# JWT Secret Key
SECRET_KEY=your_super_secret_jwt_key

# JWT Token Expiry (in minutes)
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Database URL (SQLite default)
DATABASE_URL=sqlite:///./mimini.db
```

> ⚠️ **Never commit your `.env` file** to version control. It is already included in `.gitignore`.

---

## 🚀 Running the Application

| Service | Command | URL |
|---|---|---|
| **Backend API** | `uvicorn backend.app.main:app --reload` | http://localhost:8000 |
| **API Docs (Swagger)** | *(auto-generated)* | http://localhost:8000/docs |
| **Frontend** | `npm start` (inside `/frontend`) | http://localhost:3000 |

---

## 🌐 API Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new user (student/recruiter) |
| `POST` | `/auth/login` | Login and receive JWT token |
| `POST` | `/student/upload-resume` | Upload and analyze a PDF resume |
| `GET` | `/student/dashboard` | Get student skill analysis summary |
| `GET` | `/student/learning-path` | Retrieve personalized learning path |
| `GET` | `/student/progress` | Get skill checklist and progress |
| `POST` | `/mock_test/start` | Start a new adaptive mock test session |
| `POST` | `/mock_test/submit` | Submit answers and get results |
| `GET` | `/recruiter/candidates` | List all candidates with ATS scores |
| `POST` | `/recruiter/ai-review` | Generate AI review for a candidate |
| `POST` | `/chatbot/query` | Query the RAG-powered chatbot |

---

## 🎓 Student Workflow

```
1. Register / Login
       ↓
2. Upload Resume (PDF)
       ↓
3. AI parses resume → extracts skills, experience, education
       ↓
4. RAG retrieves role-specific ATS criteria
       ↓
5. LLM evaluates ATS score + identifies skill gaps
       ↓
6. Student Dashboard → View score, missing skills, role suggestions
       ↓
7. Learning Path → Personalized study roadmap for missing skills
       ↓
8. Mock Test → Adaptive quiz to test knowledge
       ↓
9. Progress Tracker → Track skill completion over time
       ↓
10. ChatBot → Ask career-related questions anytime
```

---

## 🏢 Recruiter Workflow

```
1. Register / Login as Recruiter
       ↓
2. View Candidate Dashboard → all students with ATS scores
       ↓
3. Click on a candidate → View detailed resume analysis
       ↓
4. AI Review → LLM generates comprehensive candidate assessment
       ↓
5. Shortlist / Filter candidates by role fit and skill match
```

---

## 📊 AI Pipeline

```
PDF Resume
    │
    ▼
[PyMuPDF] → Raw Text
    │
    ▼
[Gemini LLM] → Structured JSON (skills, experience, education, projects)
    │
    ▼
[Skill Normalizer] → Canonical skill names (fuzzy matching)
    │
    ├──────────────────────────────────────────┐
    ▼                                          ▼
[RAG Engine]                            [Role Detector]
ChromaDB + Sentence Transformers        Gemini LLM infers
retrieves role/domain/ATS context       suitable job roles
    │
    ▼
[ATS Evaluator] → Score (0-100), matched skills, missing skills
    │
    ▼
[Learning Path Generator] → Ordered study plan for missing skills
    │
    ▼
[SQLite DB] → Persisted for student dashboard & recruiter view
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

Please ensure your code follows PEP 8 (Python) and ESLint rules (JavaScript).

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ by <strong>Jaiakash P</strong> · Powered by Google Gemini + RAG
</p>
