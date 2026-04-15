from resume_reader import read_resume
from resume_parser import parse_resume_with_llm
from services.skill_normalizer import normalize_skills
from rag_engine_v2 import MetadataRAGEngine
from role_detector import detect_roles
from ats_evaluator import evaluate_ats
from learning_path_generator import generate_learning_path

# ── Singleton RAG engine ──────────────────────────────────────────────────────
# Loaded ONCE when the module is first imported (at server startup).
# Avoids reloading the 103-layer BERT model on every pipeline call.
_rag_engine: MetadataRAGEngine | None = None


def _get_rag() -> MetadataRAGEngine:
    global _rag_engine
    if _rag_engine is None:
        _rag_engine = MetadataRAGEngine()
    return _rag_engine


def infer_domain(role_name: str) -> str:
    role = role_name.lower()

    if "frontend" in role:
        return "Web Development"
    if "backend" in role:
        return "Web Development"
    if "full stack" in role:
        return "Web Development"
    if "data" in role:
        return "Data Science"
    if "ml" in role or "machine learning" in role:
        return "Machine Learning"

    return "Software Engineering"


def run_pipeline(resume_path: str, target_role: str | None = None):
    rag = _get_rag()  # ← Reuse singleton, no reload

    resume_text = read_resume(resume_path)
    parsed_resume = parse_resume_with_llm(resume_text)
    parsed_resume["skills"] = normalize_skills(parsed_resume.get("skills", []))

    role_context = rag.retrieve(
        query="job roles and required skills",
        doc_types=["roles"],
        top_k=5
    )

    roles = detect_roles(parsed_resume, role_context)

    if target_role is None:
        return {
            "roles": roles
        }

    selected_role = next(
        (r["role"] for r in roles if r["role"].lower() == target_role.lower()),
        target_role
    )

    domain = infer_domain(selected_role)

    role_key = selected_role.lower().replace(" ", "_")
    domain_key = domain.lower().replace(" ", "_")

    rag_context = rag.retrieve(
        query=f"{selected_role} {domain} ATS requirements",
        role=role_key,
        domain=domain_key,
        doc_types=["roles", "domains", "ats"],
        top_k=5
    )

    ats = evaluate_ats(
        resume_data=parsed_resume,
        rag_context=rag_context,
        target_role=f"{selected_role} ({domain})"
    )

    learning = None
    missing_skills = ats.get("missing_skills", [])

    if isinstance(missing_skills, dict):
        core_gaps = missing_skills.get("core", [])
    else:
        core_gaps = missing_skills

    if core_gaps:
        learning_ctx = rag.retrieve(
            query=" ".join(core_gaps),
            doc_types=["skills", "learning"],
            top_k=5
        )

        learning = generate_learning_path(
            core_gaps,
            learning_ctx,
            f"{selected_role} ({domain})"
        )

    return {
        "roles": roles,
        "target_role": selected_role,
        "ats": ats,
        "learning_path": learning
    }
