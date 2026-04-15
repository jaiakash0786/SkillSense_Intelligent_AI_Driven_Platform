import json
import re
from groq import Groq
from dotenv import load_dotenv
import os

load_dotenv()

API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=API_KEY)


def _clean_json(content: str):
    # Remove markdown code blocks
    content = re.sub(r"```json|```", "", content)

    # Remove // comments
    content = re.sub(r"//.*", "", content)

    # Remove trailing commas
    content = re.sub(r",\s*([}\]])", r"\1", content)

    # Extract JSON object
    match = re.search(r"\{.*\}", content, re.DOTALL)
    return match.group(0).strip() if match else content.strip()


def evaluate_ats(resume_data: dict, rag_context: list[str], target_role: str):
    context_text = "\n\n".join(rag_context)

    prompt = f"""
You are a strict ATS (Applicant Tracking System) scoring engine.

TARGET ROLE: {target_role}

RETRIEVED JOB KNOWLEDGE (use ONLY this to evaluate):
{context_text}

CANDIDATE RESUME DATA:
{json.dumps(resume_data, indent=2)}

SCORING FORMULA (must follow exactly):
- Skill match vs required skills for the role  → up to 50 points
- Relevant experience (years, job titles)       → up to 25 points
- Projects with measurable/quantified impact    → up to 15 points
- Education relevance (degree, certifications)  → up to 10 points

Compute each component separately, then sum them for the final ats_score.
A candidate missing most required skills should score below 40.
A candidate matching most required skills should score above 70.
Never give a generic middle score — be specific to THIS resume.

Return ONLY valid JSON:
{{
  "ats_score": <integer between 0 and 100>,
  "matched_skills": [<list of skills from resume that match the role>],
  "missing_skills": [<list of required skills NOT found in resume>],
  "strengths": [<2-4 specific strengths of this candidate>],
  "improvements": [<2-4 specific improvements needed>]
}}

RULES:
- Do NOT invent skills not present in the resume data
- Do NOT use any knowledge outside the retrieved job knowledge
- No text, explanations, or markdown outside the JSON object
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3
    )

    raw = response.choices[0].message.content
    cleaned = _clean_json(raw)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {
            "error": "ATS JSON parsing failed",
            "raw_response": raw
        }
