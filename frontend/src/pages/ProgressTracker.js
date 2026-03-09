import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { getToken } from "../utils/auth";
import "./ProgressTracker.css";

const API = "http://127.0.0.1:8000";

// ── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders() {
    return { Authorization: `Bearer ${getToken()}` };
}

function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

// ── Badge definitions ─────────────────────────────────────────────────────────
const BADGE_LEVELS = [
    { id: "first", pct: 1, icon: "🥉", label: "First Step", desc: "Checked your first topic!" },
    { id: "quarter", pct: 25, icon: "🥈", label: "Quarter Way", desc: "25% of topics done" },
    { id: "half", pct: 50, icon: "🥇", label: "Halfway Hero", desc: "50% of topics done" },
    { id: "three4", pct: 75, icon: "🏆", label: "Almost There", desc: "75% of topics done" },
    { id: "master", pct: 100, icon: "💎", label: "Skill Master", desc: "All topics completed!" },
];

// ── Colourful line palette for chart ─────────────────────────────────────────
const LINE_COLORS = ["#ec4899", "#8b5cf6", "#38bdf8", "#34d399", "#fb923c"];

// ────────────────────────────────────────────────────────────────────────────

export default function ProgressTracker() {
    const navigate = useNavigate();

    // Resumes list (for resume selector)
    const [resumes, setResumes] = useState([]);
    const [selectedResumeId, setSelectedResumeId] = useState(null);
    const [selectedFilename, setSelectedFilename] = useState("");

    // Score history (for chart)
    const [scoreHistory, setScoreHistory] = useState([]);

    // Skill data (learning path from last analysis + checkbox state)
    const [learningPath, setLearningPath] = useState([]);
    const [skillProgress, setSkillProgress] = useState({}); // "skill::topic" → bool

    // Loading states
    const [loading, setLoading] = useState(false);

    // ── Fetch resumes on mount ────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API}/student/resumes`, { headers: authHeaders() });
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    setResumes(data);
                    setSelectedResumeId(data[0].resume_id);
                    setSelectedFilename(data[0].filename);
                }
            } catch {
                // silent
            }
        })();
    }, []);

    // ── Fetch score history + skill data when resume changes ─────────────────
    const loadResumeData = useCallback(async (resumeId) => {
        if (!resumeId) return;
        setLoading(true);
        try {
            const [histRes, statusRes, analysisRes] = await Promise.all([
                fetch(`${API}/progress/score-history?resume_id=${resumeId}`, { headers: authHeaders() }),
                fetch(`${API}/progress/skill-status?resume_id=${resumeId}`, { headers: authHeaders() }),
                fetch(`${API}/student/resume/${resumeId}`, { headers: authHeaders() }),
            ]);

            const histData = await histRes.json();
            const statusData = await statusRes.json();
            const analysisData = await analysisRes.json();

            // Score history
            setScoreHistory(Array.isArray(histData) ? histData : []);

            // Build skill progress map
            const progressMap = {};
            if (Array.isArray(statusData)) {
                statusData.forEach(({ skill_name, topic, is_done }) => {
                    progressMap[`${skill_name}::${topic}`] = is_done;
                });
            }
            setSkillProgress(progressMap);

            // Pull learning path from analysis
            const lp = analysisData?.analysis?.learning_path?.learning_path || [];
            setLearningPath(lp);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadResumeData(selectedResumeId);
    }, [selectedResumeId, loadResumeData]);

    // ── Toggle a topic checkbox ───────────────────────────────────────────────
    const handleToggle = async (skillName, topic) => {
        const key = `${skillName}::${topic}`;
        // Optimistic UI update
        setSkillProgress(prev => ({ ...prev, [key]: !prev[key] }));

        try {
            await fetch(`${API}/progress/skill/toggle`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify({ resume_id: selectedResumeId, skill_name: skillName, topic }),
            });
        } catch {
            // Revert on failure
            setSkillProgress(prev => ({ ...prev, [key]: !prev[key] }));
        }
    };

    // ── Derived values ────────────────────────────────────────────────────────
    const totalTopics = learningPath.reduce(
        (sum, item) => sum + (item.focus_topics?.length ?? 0), 0
    );
    const doneTopics = Object.values(skillProgress).filter(Boolean).length;
    const overallPct = totalTopics > 0 ? Math.round((doneTopics / totalTopics) * 100) : 0;

    // Chart data — group by date, each role as a key
    const chartData = (() => {
        const byDate = {};
        scoreHistory.forEach(({ role, ats_score, evaluated_at }) => {
            const dateKey = evaluated_at ? evaluated_at.split("T")[0] : "Unknown";
            if (!byDate[dateKey]) byDate[dateKey] = { date: dateKey };
            byDate[dateKey][role] = ats_score;
        });
        return Object.values(byDate);
    })();

    const chartRoles = [...new Set(scoreHistory.map(h => h.role))];



    // Activity timeline — score history as events, newest first
    const timeline = [...scoreHistory]
        .sort((a, b) => new Date(b.evaluated_at) - new Date(a.evaluated_at))
        .map(h => ({
            icon: "📊",
            label: `Evaluated for ${h.role}`,
            detail: `ATS Score: ${h.ats_score ?? "N/A"}`,
            date: h.evaluated_at,
        }));

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="progress-wrap">

            {/* Header */}
            <div className="progress-header">
                <button className="back-btn" onClick={() => navigate("/student")}>
                    ← Dashboard
                </button>
                <h1>My Progress</h1>
                <p className="progress-subtitle">Track your skills, scores, and milestones</p>
            </div>

            {/* Resume selector */}
            {resumes.length > 0 && (
                <div className="resume-selector">
                    <label>Resume:</label>
                    <select
                        value={selectedResumeId ?? ""}
                        onChange={e => {
                            const id = Number(e.target.value);
                            setSelectedResumeId(id);
                            setSelectedFilename(resumes.find(r => r.resume_id === id)?.filename ?? "");
                        }}
                    >
                        {resumes.map(r => (
                            <option key={r.resume_id} value={r.resume_id}>
                                {r.filename}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {resumes.length === 0 && (
                <div className="empty-state">
                    <p>📂 No resumes found. Upload one from the <button className="link-btn" onClick={() => navigate("/student")}>Dashboard</button>.</p>
                </div>
            )}

            {loading && <div className="loading-bar"><div /></div>}

            {selectedResumeId && !loading && (
                <div className="progress-grid">

                    {/* ── 1. Score Trend Chart ─────────────────────────────────── */}
                    <section className="prog-card chart-card">
                        <div className="card-accent" />
                        <h2>📈 ATS Score Trend</h2>
                        <p className="card-sub">{selectedFilename}</p>
                        {chartData.length === 0 ? (
                            <p className="empty-hint">Evaluate your resume for a role to see your score trend here.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                    <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ background: "#1e2132", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#f8fafc" }}
                                        labelStyle={{ color: "#a78bfa" }}
                                    />
                                    <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 13 }} />
                                    {chartRoles.map((role, i) => (
                                        <Line
                                            key={role}
                                            type="monotone"
                                            dataKey={role}
                                            stroke={LINE_COLORS[i % LINE_COLORS.length]}
                                            strokeWidth={2.5}
                                            dot={{ r: 5, fill: LINE_COLORS[i % LINE_COLORS.length] }}
                                            activeDot={{ r: 7 }}
                                            connectNulls
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </section>

                    {/* ── 2. Skill Checklist ───────────────────────────────────── */}
                    <section className="prog-card checklist-card">
                        <div className="card-accent" />
                        <h2>✅ Skill Checklist</h2>

                        {/* Overall progress bar */}
                        <div className="overall-progress">
                            <div className="prog-label">
                                <span>Overall Progress</span>
                                <strong>{overallPct}%</strong>
                            </div>
                            <div className="prog-bar-track">
                                <div className="prog-bar-fill" style={{ width: `${overallPct}%` }} />
                            </div>
                            <p className="prog-count">{doneTopics} / {totalTopics} topics completed</p>
                        </div>

                        {learningPath.length === 0 ? (
                            <p className="empty-hint">Select a role in the Dashboard to generate your learning path.</p>
                        ) : (
                            <div className="skill-list">
                                {learningPath.map((item, si) => {
                                    const done = (item.focus_topics ?? []).filter(t => skillProgress[`${item.skill}::${t}`]).length;
                                    const total = (item.focus_topics ?? []).length;
                                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                                    return (
                                        <div key={si} className="skill-block">
                                            <div className="skill-block-header">
                                                <div>
                                                    <div className="skill-block-name">{item.skill}</div>
                                                    <div className="skill-block-level">{item.level}</div>
                                                </div>
                                                {/* Circular progress ring */}
                                                <svg className="ring" viewBox="0 0 36 36" width={52} height={52}>
                                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                                                    <circle
                                                        cx="18" cy="18" r="15.9" fill="none"
                                                        stroke={pct === 100 ? "#34d399" : "#8b5cf6"}
                                                        strokeWidth="3"
                                                        strokeDasharray={`${pct} ${100 - pct}`}
                                                        strokeLinecap="round"
                                                        transform="rotate(-90 18 18)"
                                                    />
                                                    <text x="18" y="20.5" textAnchor="middle" fontSize="8" fill="#f8fafc" fontWeight="600">{pct}%</text>
                                                </svg>
                                            </div>
                                            <ul className="topic-list">
                                                {(item.focus_topics ?? []).map((topic, ti) => {
                                                    const key = `${item.skill}::${topic}`;
                                                    const checked = !!skillProgress[key];
                                                    return (
                                                        <li key={ti} className={`topic-item${checked ? " done" : ""}`}>
                                                            <input
                                                                type="checkbox"
                                                                id={`chk-${si}-${ti}`}
                                                                checked={checked}
                                                                onChange={() => handleToggle(item.skill, topic)}
                                                            />
                                                            <label htmlFor={`chk-${si}-${ti}`}>{topic}</label>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* ── 3. Activity Timeline ─────────────────────────────────── */}
                    <section className="prog-card timeline-card">
                        <div className="card-accent" />
                        <h2>📅 Activity Timeline</h2>
                        {timeline.length === 0 ? (
                            <p className="empty-hint">Your evaluation history will appear here.</p>
                        ) : (
                            <ul className="timeline-list">
                                {timeline.map((ev, i) => (
                                    <li key={i} className="timeline-item">
                                        <div className="tl-dot">{ev.icon}</div>
                                        <div className="tl-body">
                                            <div className="tl-label">{ev.label}</div>
                                            <div className="tl-detail">{ev.detail}</div>
                                            <div className="tl-date">{formatDate(ev.date)}</div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* ── 4. Milestone Badges ──────────────────────────────────── */}
                    <section className="prog-card badges-card">
                        <div className="card-accent" />
                        <h2>🏅 Milestones</h2>
                        <div className="badges-grid">
                            {BADGE_LEVELS.map(b => {
                                const earned = overallPct >= b.pct;
                                return (
                                    <div key={b.id} className={`badge-item${earned ? " earned" : " locked"}`}>
                                        <div className="badge-icon">{earned ? b.icon : "🔒"}</div>
                                        <div className="badge-label">{b.label}</div>
                                        <div className="badge-desc">{b.desc}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                </div>
            )}
        </div>
    );
}
