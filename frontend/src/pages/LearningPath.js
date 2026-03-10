import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../utils/auth";
import "./LearningPath.css";

const LEVEL_CONFIG = {
    Beginner: { color: "#22c55e", bg: "rgba(34,197,94,0.12)", icon: "🌱" },
    Intermediate: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: "🔥" },
    Advanced: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: "⚡" },
};

function SkillCard({ item, index, totalSkills, checkedTopics, setCheckedTopics }) {
    const [expanded, setExpanded] = useState(false);
    const cfg = LEVEL_CONFIG[item.level] || LEVEL_CONFIG["Beginner"];
    const topics = item.focus_topics || [];
    const projects = item.projects || [];

    const skillKey = `skill-${index}`;
    const checked = checkedTopics[skillKey] || {};
    const doneCount = Object.values(checked).filter(Boolean).length;

    const toggleTopic = (i) => {
        setCheckedTopics((prev) => ({
            ...prev,
            [skillKey]: { ...(prev[skillKey] || {}), [i]: !((prev[skillKey] || {})[i]) },
        }));
    };

    return (
        <div className="lp-item" style={{ animationDelay: `${index * 0.08}s` }}>
            {/* Timeline node */}
            <div className="lp-node-col">
                <div className="lp-node" style={{ borderColor: cfg.color, boxShadow: `0 0 12px ${cfg.color}55` }}>
                    <span>{index + 1}</span>
                </div>
                {index < totalSkills - 1 && <div className="lp-connector" />}
            </div>

            {/* Card */}
            <div className="lp-card" style={{ borderColor: `${cfg.color}33` }}>
                <div className="lp-card-header" onClick={() => setExpanded(!expanded)}>
                    <div className="lp-card-title-row">
                        <span className="lp-skill-name">{item.skill}</span>
                        <span className="lp-level-badge" style={{ color: cfg.color, background: cfg.bg }}>
                            {cfg.icon} {item.level}
                        </span>
                    </div>
                    <div className="lp-card-meta">
                        <span className="lp-topic-count">{topics.length} topics · {projects.length} projects</span>
                        {doneCount > 0 && (
                            <span className="lp-done-count" style={{ color: cfg.color }}>
                                ✓ {doneCount}/{topics.length} done
                            </span>
                        )}
                        <span className="lp-expand-chevron">{expanded ? "▲" : "▼"}</span>
                    </div>
                </div>

                {expanded && (
                    <div className="lp-card-body">
                        <div className="lp-section">
                            <h4>📚 Focus Topics</h4>
                            <ul className="lp-checklist">
                                {topics.map((topic, i) => (
                                    <li
                                        key={i}
                                        className={`lp-check-item ${checked[i] ? "done" : ""}`}
                                        onClick={() => toggleTopic(i)}
                                    >
                                        <span className="lp-checkbox" style={{ borderColor: cfg.color }}>
                                            {checked[i] && <span style={{ color: cfg.color }}>✓</span>}
                                        </span>
                                        <span>{topic}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="lp-section">
                            <h4>🏗️ Projects to Build</h4>
                            <ul className="lp-projects">
                                {projects.map((proj, i) => (
                                    <li key={i} className="lp-project-item" style={{ borderLeftColor: cfg.color }}>
                                        {proj}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function LearningPath() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [checkedTopics, setCheckedTopics] = useState({});

    useEffect(() => {
        const fetchLearningPath = async () => {
            try {
                const res = await fetch("http://127.0.0.1:8000/student/learning-path", {
                    headers: { Authorization: `Bearer ${getToken()}` },
                });
                const json = await res.json();
                if (!res.ok) {
                    setError(json.detail || "Failed to load learning path");
                } else if (!json.learning_path) {
                    setError(json.message || "No learning path available yet. Please evaluate a resume first.");
                } else {
                    setData(json);
                }
            } catch {
                setError("Server error — make sure the backend is running.");
            } finally {
                setLoading(false);
            }
        };
        fetchLearningPath();
    }, []);

    const skills = data?.learning_path?.learning_path || [];
    const timeline = data?.learning_path?.timeline || "";
    const targetRole = data?.target_role || "Your Target Role";

    // Overall progress: count all checked topics across all skills
    const totalTopics = skills.reduce((s, item) => s + (item.focus_topics?.length || 0), 0);
    const doneTotalTopics = Object.values(checkedTopics).reduce((sum, skillMap) => {
        return sum + Object.values(skillMap).filter(Boolean).length;
    }, 0);
    const progressPct = totalTopics > 0 ? Math.round((doneTotalTopics / totalTopics) * 100) : 0;

    return (
        <div className="lp-wrap">
            {/* Hero Header */}
            <div className="lp-header">
                <div className="lp-header-inner">
                    <div className="lp-header-tag">🗺️ Learning Roadmap</div>
                    <h1 className="lp-header-title">
                        {loading ? "Loading..." : targetRole}
                    </h1>
                    {!loading && !error && timeline && (
                        <div className="lp-timeline-badge">⏱ {timeline}</div>
                    )}

                    {!loading && !error && totalTopics > 0 && (
                        <div className="lp-progress-wrap">
                            <div className="lp-progress-label">
                                <span>Overall Progress</span>
                                <span>{progressPct}% — {doneTotalTopics}/{totalTopics} topics</span>
                            </div>
                            <div className="lp-progress-bar">
                                <div
                                    className="lp-progress-fill"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="lp-content">
                {loading && (
                    <div className="lp-loading">
                        <div className="lp-spinner" />
                        <p>Loading your personalized roadmap...</p>
                    </div>
                )}

                {!loading && error && (
                    <div className="lp-empty">
                        <div className="lp-empty-icon">🗺️</div>
                        <h3>No Roadmap Yet</h3>
                        <p>{error}</p>
                        <button className="lp-cta-btn" onClick={() => navigate("/student")}>
                            Go to Dashboard →
                        </button>
                    </div>
                )}

                {!loading && !error && skills.length === 0 && (
                    <div className="lp-empty">
                        <div className="lp-empty-icon">📋</div>
                        <h3>No Skills Found</h3>
                        <p>Your learning path appears to be empty. Try evaluating your resume again.</p>
                        <button className="lp-cta-btn" onClick={() => navigate("/student")}>
                            Go to Dashboard →
                        </button>
                    </div>
                )}

                {!loading && !error && skills.length > 0 && (
                    <>
                        <div className="lp-skills-count">
                            {skills.length} skills to master · Click a card to expand
                        </div>
                        <div className="lp-timeline">
                            {skills.map((item, idx) => (
                                <SkillCard
                                    key={idx}
                                    item={item}
                                    index={idx}
                                    totalSkills={skills.length}
                                    checkedTopics={checkedTopics}
                                    setCheckedTopics={setCheckedTopics}
                                />
                            ))}
                        </div>

                        {/* Bottom CTA row */}
                        <div className="lp-bottom-cta">
                            <button className="lp-cta-btn secondary" onClick={() => navigate("/student")}>
                                ← Dashboard
                            </button>
                            <button className="lp-cta-btn" onClick={() => navigate("/progress")}>
                                📊 View Progress →
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default LearningPath;
