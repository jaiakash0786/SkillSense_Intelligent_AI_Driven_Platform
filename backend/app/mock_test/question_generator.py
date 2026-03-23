import os
import json
import re
from groq import Groq

client = Groq(api_key=os.getenv("MOCK_TEST_GROQ_API_KEY"))


def _difficulty_split(ats_score: float) -> dict:
    """Return how many easy/medium/hard MCQ questions to generate based on ATS score."""
    if ats_score is None:
        return {"easy": 3, "medium": 4, "hard": 1}   # default balanced
    if ats_score >= 70:
        return {"easy": 2, "medium": 3, "hard": 3}   # strong candidate → harder
    if ats_score >= 40:
        return {"easy": 3, "medium": 3, "hard": 2}   # average
    return {"easy": 4, "medium": 3, "hard": 1}        # beginner → easier


def generate_mcq_questions(role: str, skill_topic: str,
                           ats_score: float = None,
                           num_mcq: int = 8,
                           num_coding: int = 2) -> list:
    """
    Generate MCQ + coding/pseudo-code questions using Groq LLM.

    MCQ item:    {type:"mcq",    question, options:{A,B,C,D}, answer, difficulty}
    Coding item: {type:"coding", question, hint}
    """
    split = _difficulty_split(ats_score)

    prompt = f"""You are an expert technical interviewer. Generate exactly {num_mcq} MCQ questions and {num_coding} coding/pseudo-code questions for a {role} candidate on the topic: "{skill_topic}".

ATS score of the candidate: {ats_score if ats_score is not None else "unknown"}.

MCQ difficulty breakdown:
- {split['easy']} EASY questions (basic definitions, recall)
- {split['medium']} MEDIUM questions (application, how it works)
- {split['hard']} HARD questions (edge cases, optimization, debugging)

Return ONLY a valid JSON array with no explanation or markdown.

MCQ item format:
{{
  "type": "mcq",
  "difficulty": "easy" | "medium" | "hard",
  "question": "...",
  "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
  "answer": "A" | "B" | "C" | "D"
}}

Coding item format (NO options or answer fields):
{{
  "type": "coding",
  "question": "Write pseudo-code / short code for: ...",
  "hint": "Think about: ..."
}}

Generate {num_mcq} MCQ items followed by {num_coding} coding items now:"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=4000,
    )

    raw = response.choices[0].message.content.strip()
    json_match = re.search(r'\[.*\]', raw, re.DOTALL)
    if json_match:
        raw = json_match.group(0)

    questions = json.loads(raw)

    validated = []
    for q in questions:
        qtype = q.get("type", "mcq")
        if qtype == "coding":
            validated.append({
                "type": "coding",
                "question": q.get("question", ""),
                "hint": q.get("hint", ""),
            })
        else:
            if all(k in q for k in ("question", "options", "answer")):
                validated.append({
                    "type": "mcq",
                    "difficulty": q.get("difficulty", "medium"),
                    "question": q["question"],
                    "options": {
                        "A": q["options"].get("A", ""),
                        "B": q["options"].get("B", ""),
                        "C": q["options"].get("C", ""),
                        "D": q["options"].get("D", ""),
                    },
                    "answer": q["answer"].upper(),
                })

    return validated[:num_mcq + num_coding]


def evaluate_coding_answer(question: str, student_answer: str, role: str) -> dict:
    """
    AI-grade a pseudo-code / coding answer.
    Returns: {score: 0-10, feedback: "one-line feedback"}
    """
    if not student_answer or not student_answer.strip():
        return {"score": 0, "feedback": "No answer provided."}

    prompt = f"""You are a senior {role} interviewer. Evaluate this pseudo-code/coding answer.

Question: {question}

Student's Answer:
{student_answer}

Grade the answer on a scale of 0 to 10 where:
- 0: No answer or completely wrong
- 5: Partially correct logic, some major gaps
- 8: Mostly correct with minor issues
- 10: Perfect answer with correct logic

Respond ONLY with a JSON object like this (no markdown, no explanation):
{{"score": 7, "feedback": "Correct approach but missing edge case handling for empty input."}}"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=200,
        )
        raw = response.choices[0].message.content.strip()
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group(0))
            return {
                "score": max(0, min(10, int(result.get("score", 0)))),
                "feedback": result.get("feedback", ""),
            }
    except Exception as e:
        print(f"Coding evaluation error: {e}")

    return {"score": 0, "feedback": "Evaluation failed — please review manually."}
