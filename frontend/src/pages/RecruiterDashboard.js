import { useEffect, useState } from "react";
import { getToken } from "../utils/auth";
import "./RecruiterDashboard.css";

const API = "http://127.0.0.1:8000";

function RecruiterDashboard() {
  const [allCandidates, setAllCandidates] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState("");
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [minAts, setMinAts] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");

  // Mock Test Assignment state
  const [assignRole, setAssignRole] = useState("");
  const [assignTopic, setAssignTopic] = useState("");
  const [assignMsg, setAssignMsg] = useState("");
  const [candidateTestHistory, setCandidateTestHistory] = useState([]);

  // AI Review state
  const [aiReview, setAiReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Mock test tab
  const [testTab, setTestTab] = useState("assigned");

  const loadCandidates = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        "http://127.0.0.1:8000/recruiter/candidates",
        {
          headers: { Authorization: `Bearer ${getToken()}` }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Failed to load candidates");
        return;
      }

      setAllCandidates(data);
      setCandidates(data);
      setError("");
    } catch {
      setError("Server error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  const applyFilters = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (minAts) params.append("min_ats", minAts);
      if (roleFilter) params.append("role", roleFilter.trim());
      if (skillFilter) params.append("skills", skillFilter.trim());

      const response = await fetch(
        `http://127.0.0.1:8000/recruiter/candidates?${params.toString()}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );

      const data = await response.json();
      if (!response.ok) { setError(data.detail || "Filter failed"); return; }

      setCandidates(data);
      setError("");
    } catch {
      setError("Server error during filter");
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setMinAts("");
    setRoleFilter("");
    setSkillFilter("");
    setCandidates(allCandidates);
  };

  const fetchAnalysis = async (resumeId, role, candidateEmail) => {
    setLoading(true);
    setSelectedAnalysis(null);

    try {
      const roleParam = role ? `?role=${encodeURIComponent(role)}` : "";
      
      // Fetch both analysis and mock test results concurrently
      const [resAnalysis, resMockTests] = await Promise.all([
        fetch(`${API}/recruiter/resume/${resumeId}${roleParam}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
        fetch(`${API}/mock-test/results/by-email/${encodeURIComponent(candidateEmail)}`, {
           headers: { Authorization: `Bearer ${getToken()}` },
        })
      ]);

      const dataAnalysis = await resAnalysis.json();
      if (!resAnalysis.ok) {
        alert(dataAnalysis.detail || "Failed to load analysis");
        return;
      }

      let dataTests = [];
      if (resMockTests.ok) {
         const t = await resMockTests.json();
         dataTests = t.results || [];
      }

      setSelectedAnalysis(dataAnalysis);
      setCandidateTestHistory(dataTests);
      setAssignRole("");
      setAssignTopic("");
      setAssignMsg("");
      setAiReview(null);          // reset review on new candidate open
      setReviewLoading(false);
      setTestTab("assigned");      // default to assigned tab
    } catch {
      alert("Server error");
    } finally {
      setLoading(false);
    }
  };

  const generateReview = async () => {
    if (!selectedAnalysis) return;
    setReviewLoading(true);
    setAiReview(null);
    try {
      const res = await fetch(`${API}/recruiter/candidate-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          resume_id: selectedAnalysis.resume_id,
          candidate_email: selectedAnalysis.candidate_email,
          role: selectedAnalysis.role_history?.[0]?.role || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Failed to generate review");
        return;
      }
      setAiReview(data);
    } catch {
      alert("Server error while generating review");
    } finally {
      setReviewLoading(false);
    }
  };

  /* Scroll lock when modal opens */
  useEffect(() => {
    document.body.style.overflow = selectedAnalysis ? "hidden" : "auto";
    return () => { document.body.style.overflow = "auto"; };
  }, [selectedAnalysis]);

  const scoreColor = (score) => {
    if (score == null) return "#64748b";
    if (score >= 75) return "#22c55e";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
  };

  const scoreBg = (score) => {
    if (score == null) return "rgba(100,116,139,0.12)";
    if (score >= 75) return "rgba(34,197,94,0.12)";
    if (score >= 50) return "rgba(245,158,11,0.12)";
    return "rgba(239,68,68,0.12)";
  };

  return (
    <div className="recruiter-shell">

      <div className="recruiter-header">
        <h2>🏢 Recruiter Dashboard</h2>
      </div>

      {/* Filter Box */}
      <div className="filter-box">
        <h4>🔍 Filter Candidates</h4>

        <input
          type="number"
          placeholder="Min ATS Score (e.g. 60)"
          value={minAts}
          onChange={(e) => setMinAts(e.target.value)}
        />
        <input
          type="text"
          placeholder="Role (e.g. Full Stack Engineer)"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        />
        <input
          type="text"
          placeholder="Skills (react, python)"
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value)}
        />
        <button onClick={applyFilters}>Apply Filters</button>
        <button onClick={clearFilters}>Clear</button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p style={{ textAlign: "center", color: "#94a3b8" }}>Loading...</p>}

      {/* Candidate Table */}
      {candidates.length === 0 && !loading ? (
        <p style={{ textAlign: "center", color: "#64748b", marginTop: "40px" }}>
          No candidates found matching your filters.
        </p>
      ) : (
        <table className="candidate-table">
          <thead>
            <tr>
              <th>Candidate Email</th>
              <th>Resume</th>
              <th>Evaluated Role</th>
              <th>ATS Score</th>
              <th>All Roles</th>
            </tr>
          </thead>

          <tbody>
            {candidates.map((c) => (
              <tr key={`${c.candidate_email}-${c.resume_id}`}>
                <td>{c.candidate_email}</td>

                <td>
                  <button onClick={() => fetchAnalysis(c.resume_id, c.role, c.candidate_email)}>
                    {c.filename}
                  </button>
                </td>

                {/* Role for which the ATS score is shown */}
                <td style={{ color: "#93c5fd", fontWeight: 500 }}>
                  {c.role || "—"}
                </td>

                {/* ATS Score — color-coded, role-specific */}
                <td>
                  <span style={{
                    color: scoreColor(c.ats_score),
                    background: scoreBg(c.ats_score),
                    fontWeight: 700,
                    fontSize: "14px",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    border: `1px solid ${scoreColor(c.ats_score)}44`,
                  }}>
                    {c.ats_score != null ? c.ats_score : "N/A"}
                  </span>
                </td>

                {/* All roles this candidate has been evaluated for */}
                <td>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {(c.all_roles || []).map((r, idx) => (
                      <span
                        key={idx}
                        title={`${r.role}: ${r.ats_score ?? "N/A"}`}
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: "rgba(139,92,246,0.12)",
                          border: "1px solid rgba(139,92,246,0.25)",
                          color: "#a78bfa",
                          whiteSpace: "nowrap",
                          cursor: "default",
                        }}
                      >
                        {r.role} ({r.ats_score ?? "N/A"})
                      </span>
                    ))}
                  </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Detail Modal */}
      {selectedAnalysis && (
        <div className="popup-overlay" onClick={() => setSelectedAnalysis(null)}>
          <div className="analysis-popup" onClick={(e) => e.stopPropagation()}>

            <button className="close-btn" onClick={() => setSelectedAnalysis(null)}>✕</button>

            <h3>Candidate Details</h3>

            <p><strong>Email:</strong> {selectedAnalysis.candidate_email}</p>
            <p><strong>Resume:</strong> {selectedAnalysis.filename}</p>

            {/* ── AI Review Section (TOP) ── */}
            <div style={{ marginBottom: "20px" }}>
              <button
                className="ai-review-btn"
                onClick={generateReview}
                disabled={reviewLoading}
                id="generate-ai-review-btn"
              >
                {reviewLoading ? (
                  <>
                    <span style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Generating Review...
                  </>
                ) : (
                  <>✨ Generate AI Performance Review</>
                )}
              </button>

              {reviewLoading && <div className="review-shimmer" />}

              {aiReview && !reviewLoading && (
                <div className="ai-review-card" id="ai-review-card">
                  <div className="review-card-inner">
                    <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", color: "#a78bfa", textTransform: "uppercase", marginBottom: "10px" }}>
                      🤖 AI Performance Review
                    </div>
                    <h3 className="review-headline">🌟 {aiReview.headline}</h3>
                    <p className="review-summary">{aiReview.summary}</p>
                    {aiReview.highlights?.length > 0 && (
                      <>
                        <div className="review-highlights-label">✦ Key Highlights</div>
                        <div className="review-highlights">
                          {aiReview.highlights.map((h, idx) => (
                            <span key={idx} className="review-highlight-chip">⚡ {h}</span>
                          ))}
                        </div>
                      </>
                    )}
                    {aiReview.recommendation && (
                      <div className="review-recommendation">
                        <span className="review-recommendation-icon">🏆</span>
                        <span className="review-recommendation-text">{aiReview.recommendation}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Assign Mock Test ── */}
            <div style={{ marginTop: "24px", padding: "16px", background: "rgba(139,92,246,0.1)", borderRadius: "12px", border: "1px solid rgba(139,92,246,0.2)" }}>
              <h4 style={{ margin: "0 0 12px 0", color: "#c4b5fd" }}>🧪 Assign Mock Test</h4>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <input 
                  type="text" 
                  placeholder="Role (e.g. Frontend)" 
                  value={assignRole} onChange={e => setAssignRole(e.target.value)} 
                  style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "white" }}
                />
                <input 
                  type="text" 
                  placeholder="Topic (e.g. React Hooks)" 
                  value={assignTopic} onChange={e => setAssignTopic(e.target.value)} 
                  style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", color: "white" }}
                />
                <button 
                  onClick={async () => {
                     setAssignMsg("Assigning...");
                     try {
                        const res = await fetch(`${API}/mock-test/assign`, {
                           method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
                           body: JSON.stringify({ student_email: selectedAnalysis.candidate_email, resume_id: selectedAnalysis.resume_id, role: assignRole, skill_topic: assignTopic })
                        });
                        if (res.ok) {
                           setAssignMsg("Assigned! ✅");
                           setAssignRole(""); setAssignTopic("");
                        } else setAssignMsg("Failed to assign");
                     } catch { setAssignMsg("Error assigning"); }
                  }}
                  style={{ background: "#8b5cf6", color: "white", padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "bold" }}
                >
                  Assign
                </button>
              </div>
              {assignMsg && <p style={{ fontSize: "13px", color: "#a78bfa", marginTop: "8px", marginBottom: 0 }}>{assignMsg}</p>}
            </div>

            {/* ④ Skills Breakdown */}
            <div style={{ marginTop: "20px" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#f8fafc", fontSize: "15px", fontWeight: "700" }}>🎯 Suggested Roles</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                {(selectedAnalysis.analysis?.roles || []).map((r, idx) => (
                  <span key={idx} style={{ padding: "4px 12px", borderRadius: "20px", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#c4b5fd", fontSize: "13px" }}>
                    {r.role} <span style={{ opacity: 0.7 }}>({Math.round((r.confidence || 0) * 100)}%)</span>
                  </span>
                ))}
              </div>

              <h4 style={{ margin: "0 0 10px 0", color: "#f8fafc", fontSize: "15px", fontWeight: "700" }}>✅ Matched Skills</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {(selectedAnalysis.analysis?.ats?.matched_skills || []).map((s, idx) => (
                  <span key={idx} style={{ padding: "3px 10px", borderRadius: "16px", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80", fontSize: "12px" }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* ⑤ Role Evaluation History */}
            {(selectedAnalysis.role_history?.length > 0) && (
              <div style={{ marginTop: "20px" }}>
                <h4 style={{ margin: "0 0 10px 0", color: "#f8fafc", fontSize: "15px", fontWeight: "700" }}>📊 Role Evaluation History</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedAnalysis.role_history.map((entry, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ color: "#93c5fd", fontWeight: 600 }}>{entry.role}</span>
                      <span style={{ color: scoreColor(entry.ats_score), fontWeight: 700, background: scoreBg(entry.ats_score), padding: "3px 10px", borderRadius: "14px", fontSize: "13px", border: `1px solid ${scoreColor(entry.ats_score)}44` }}>
                        {entry.ats_score != null ? entry.ats_score : "N/A"}
                      </span>
                      <span style={{ color: "#475569", fontSize: "12px" }}>
                        {entry.evaluated_at ? new Date(entry.evaluated_at).toLocaleDateString("en-IN") : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ⑥ Mock Test Results — Tab UI (LAST) */}
            {candidateTestHistory.length > 0 && (() => {
              const completed = candidateTestHistory.filter(th => th.status === "completed");
              const assigned  = completed.filter(th => th.is_assigned);
              const voluntary = completed.filter(th => !th.is_assigned);
              const pending   = candidateTestHistory.filter(th => th.status !== "completed" && th.is_assigned);

              const activeTests =
                testTab === "assigned"  ? assigned  :
                testTab === "voluntary" ? voluntary :
                pending;

              const renderTestCard = (th, idx) => {
                const viols    = th.violations || [];
                const tabSw    = viols.filter(v => v.type === "tab_switch").length;
                const noFace   = viols.filter(v => v.type === "no_face").length;
                const multFace = viols.filter(v => v.type === "multiple_faces").length;
                const fsEx     = viols.filter(v => v.type === "fullscreen_exit").length;
                const copyAt   = viols.filter(v => v.type === "copy_attempt").length;
                const totalVio = viols.length;
                return (
                  <div key={`${th.mock_test_id}-${idx}`} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)", padding: "20px 22px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "5px" }}>
                          <span style={{ color: "#f1f5f9", fontWeight: "700", fontSize: "16px" }}>{th.role}</span>
                          <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 9px", borderRadius: "10px", background: th.is_assigned ? "rgba(99,102,241,0.2)" : "rgba(34,197,94,0.15)", color: th.is_assigned ? "#a5b4fc" : "#4ade80", border: `1px solid ${th.is_assigned ? "rgba(99,102,241,0.35)" : "rgba(34,197,94,0.3)"}` }}>
                            {th.is_assigned ? "📋 Assigned" : "🙋 Voluntary"}
                          </span>
                        </div>
                        <div style={{ color: "#a78bfa", fontSize: "13px", marginBottom: "3px" }}>📚 {th.skill_topic}</div>
                        {th.completed_at && (
                          <div style={{ color: "#475569", fontSize: "11px" }}>
                            🗓 {new Date(th.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "center" }}>
                        {th.score !== null ? (
                          <div style={{ background: scoreBg(th.score), color: scoreColor(th.score), border: `1px solid ${scoreColor(th.score)}`, borderRadius: "10px", padding: "6px 14px", minWidth: "80px", textAlign: "center" }}>
                            <div style={{ fontSize: "18px", fontWeight: "700", lineHeight: 1 }}>{th.score}%</div>
                            <div style={{ fontSize: "11px", marginTop: "2px", opacity: 0.8 }}>{th.correct_answers}/{th.total_questions} correct</div>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "13px", background: "rgba(255,255,255,0.08)", padding: "8px 16px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)" }}>⏳ Pending</span>
                        )}
                      </div>
                    </div>
                    {totalVio > 0 ? (
                      <div style={{ marginTop: "14px", padding: "12px 14px", background: "rgba(239,68,68,0.07)", borderRadius: "10px", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <div style={{ fontSize: "13px", color: "#f87171", fontWeight: "700", marginBottom: "8px" }}>🚨 {totalVio} Proctoring Violation{totalVio !== 1 ? "s" : ""}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                          {tabSw > 0    && <span style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", padding: "4px 12px", borderRadius: "10px", fontSize: "12px", fontWeight: "600" }}>🔀 Tab Switch: {tabSw}</span>}
                          {noFace > 0   && <span style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", padding: "4px 12px", borderRadius: "10px", fontSize: "12px", fontWeight: "600" }}>👤 No Face: {noFace}×</span>}
                          {multFace > 0 && <span style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", padding: "4px 12px", borderRadius: "10px", fontSize: "12px", fontWeight: "600" }}>👥 Multiple Faces: {multFace}×</span>}
                          {fsEx > 0     && <span style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", padding: "4px 12px", borderRadius: "10px", fontSize: "12px", fontWeight: "600" }}>🖥️ Fullscreen Exit: {fsEx}</span>}
                          {copyAt > 0   && <span style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", padding: "4px 12px", borderRadius: "10px", fontSize: "12px", fontWeight: "600" }}>📋 Copy Attempt: {copyAt}</span>}
                        </div>
                      </div>
                    ) : th.score !== null ? (
                      <div style={{ marginTop: "10px", fontSize: "13px", color: "#34d399", fontWeight: "600" }}>✅ Clean session — no violations</div>
                    ) : null}
                    {th.coding_results && th.coding_results.length > 0 && (
                      <div style={{ marginTop: "14px", padding: "14px 16px", background: "rgba(139,92,246,0.07)", borderRadius: "10px", border: "1px solid rgba(139,92,246,0.18)" }}>
                        <div style={{ fontSize: "13px", color: "#a78bfa", fontWeight: "700", marginBottom: "12px" }}>💻 Coding Answers ({th.coding_results.length})</div>
                        {th.coding_results.map((cr, ci) => (
                          <div key={ci} style={{ marginBottom: ci < th.coding_results.length - 1 ? "16px" : 0, paddingBottom: ci < th.coding_results.length - 1 ? "16px" : 0, borderBottom: ci < th.coding_results.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                            <div style={{ fontSize: "13px", color: "#e2e8f0", fontWeight: "600", marginBottom: "8px" }}>{cr.question}</div>
                            <pre style={{ background: "rgba(0,0,0,0.35)", borderRadius: "8px", padding: "12px 14px", fontSize: "12px", color: "#cbd5e1", whiteSpace: "pre-wrap", margin: "0 0 10px 0", fontFamily: "monospace", lineHeight: 1.65 }}>{cr.answer_text || "(No answer)"}</pre>
                            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ background: cr.ai_score >= 7 ? "rgba(52,211,153,0.15)" : cr.ai_score >= 4 ? "rgba(251,191,36,0.15)" : "rgba(248,113,113,0.15)", color: cr.ai_score >= 7 ? "#34d399" : cr.ai_score >= 4 ? "#fbbf24" : "#f87171", padding: "4px 12px", borderRadius: "10px", fontSize: "12px", fontWeight: "700" }}>
                                AI Score: {cr.ai_score}/10
                              </span>
                              <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>{cr.ai_feedback}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              };

              const tabDef = [
                { key: "assigned",  label: "📋 Assigned",  count: assigned.length,  color: "#a5b4fc", active: "rgba(99,102,241,0.25)",  border: "rgba(99,102,241,0.5)" },
                { key: "voluntary", label: "🙋 Voluntary", count: voluntary.length, color: "#4ade80", active: "rgba(34,197,94,0.2)",   border: "rgba(34,197,94,0.5)" },
                ...(pending.length > 0 ? [{ key: "pending", label: "⏳ Pending", count: pending.length, color: "#94a3b8", active: "rgba(100,116,139,0.2)", border: "rgba(100,116,139,0.5)" }] : []),
              ];

              return (
                <div style={{ marginTop: "28px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                    <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "18px", fontWeight: "700" }}>📊 Mock Test Results</h4>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>{completed.length} completed · {pending.length} awaiting</span>
                  </div>
                  <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                    {tabDef.map(tab => (
                      <button key={tab.key} onClick={() => setTestTab(tab.key)} style={{ flex: 1, padding: "12px 16px", borderRadius: "12px", border: testTab === tab.key ? `2px solid ${tab.border}` : "2px solid rgba(255,255,255,0.08)", background: testTab === tab.key ? tab.active : "rgba(255,255,255,0.04)", color: testTab === tab.key ? tab.color : "#64748b", fontWeight: testTab === tab.key ? "700" : "500", fontSize: "14px", cursor: "pointer", transition: "all 0.2s ease", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                        {tab.label}
                        <span style={{ fontSize: "12px", fontWeight: "700", padding: "1px 8px", borderRadius: "20px", background: testTab === tab.key ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)" }}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div style={{ maxHeight: "420px", overflowY: "auto", paddingRight: "4px", scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.4) transparent" }}>
                    {activeTests.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        {activeTests.map((th, idx) => renderTestCard(th, idx))}
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "30px 0", color: "#475569", fontSize: "14px" }}>
                        No {testTab} tests found.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

    </div>
  );
}

export default RecruiterDashboard;
