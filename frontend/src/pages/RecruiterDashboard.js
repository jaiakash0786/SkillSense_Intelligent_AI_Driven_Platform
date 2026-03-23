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
    } catch {
      alert("Server error");
    } finally {
      setLoading(false);
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

            {/* ── Candidate's Mock Test History (completed only) ── */}
            {candidateTestHistory.filter(th => th.status === "completed").length > 0 && (
              <div style={{ marginTop: "24px" }}>
                 <h4 style={{ margin: "0 0 12px 0", color: "#f8fafc" }}>📊 Mock Test Results</h4>
                 <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {candidateTestHistory.filter(th => th.status === "completed").map(th => {
                        const viols = th.violations || [];
                        const tabSw  = viols.filter(v => v.type === "tab_switch").length;
                        const noFace = viols.filter(v => v.type === "no_face").length;
                        const multFace = viols.filter(v => v.type === "multiple_faces").length;
                        const fsEx = viols.filter(v => v.type === "fullscreen_exit").length;
                        const copyAt = viols.filter(v => v.type === "copy_attempt").length;
                        const totalVio = viols.length;
                        return (
                        <div key={th.mock_test_id} style={{ background: "rgba(255,255,255,0.03)", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                 <span style={{ color: "#e2e8f0", fontWeight: "600", fontSize: "14px" }}>{th.role}</span>
                                 <span style={{ color: "#a78bfa", fontSize: "12px" }}>{th.skill_topic}</span>
                                 <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{th.is_assigned ? "Assigned" : "Voluntary"}</span>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                                 {th.score !== null ? (
                                    <span style={{ background: scoreBg(th.score), color: scoreColor(th.score), padding: "2px 8px", borderRadius: "12px", fontSize: "13px", fontWeight: "bold", border: `1px solid ${scoreColor(th.score)}` }}>
                                       {th.score}% ({th.correct_answers}/{th.total_questions})
                                    </span>
                                 ) : (
                                    <span style={{ color: "#94a3b8", fontSize: "12px", background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: "12px" }}>Pending</span>
                                 )}
                              </div>
                           </div>
                           {/* Proctoring violation summary */}
                           {totalVio > 0 && (
                             <div style={{ marginTop: "8px", padding: "8px 10px", background: "rgba(239,68,68,0.08)", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)" }}>
                               <div style={{ fontSize: "11px", color: "#f87171", fontWeight: "700", marginBottom: "5px" }}>🚨 {totalVio} Violation{totalVio !== 1 ? "s" : ""}</div>
                               <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                                 {tabSw > 0    && <span style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600" }}>🔀 Tab: {tabSw}</span>}
                                 {noFace > 0   && <span style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600" }}>👤 No Face: {noFace}×</span>}
                                 {multFace > 0 && <span style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600" }}>👥 Multi: {multFace}×</span>}
                                 {fsEx > 0     && <span style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600" }}>🖥️ FS exit: {fsEx}</span>}
                                 {copyAt > 0   && <span style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600" }}>📋 Copy: {copyAt}</span>}
                               </div>
                             </div>
                           )}
                           {th.score !== null && totalVio === 0 && (
                             <div style={{ marginTop: "6px", fontSize: "11px", color: "#34d399", fontWeight: "600" }}>✅ No violations detected</div>
                           )}
                           {/* Coding answers review */}
                           {th.coding_results && th.coding_results.length > 0 && (
                             <div style={{ marginTop: "10px", padding: "10px 12px", background: "rgba(139,92,246,0.08)", borderRadius: "8px", border: "1px solid rgba(139,92,246,0.2)" }}>
                               <div style={{ fontSize: "11px", color: "#a78bfa", fontWeight: "700", marginBottom: "8px" }}>💻 Coding Answers</div>
                               {th.coding_results.map((cr, ci) => (
                                 <div key={ci} style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: ci < th.coding_results.length-1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                                   <div style={{ fontSize: "12px", color: "#e2e8f0", fontWeight: "600", marginBottom: "4px" }}>{cr.question}</div>
                                   <pre style={{ background: "rgba(0,0,0,0.4)", borderRadius: "6px", padding: "8px", fontSize: "11px", color: "#cbd5e1", whiteSpace: "pre-wrap", margin: "4px 0", fontFamily: "monospace" }}>{cr.answer_text || "(No answer)"}</pre>
                                   <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                     <span style={{ background: cr.ai_score >= 7 ? "rgba(52,211,153,0.15)" : cr.ai_score >= 4 ? "rgba(251,191,36,0.15)" : "rgba(248,113,113,0.15)", color: cr.ai_score >= 7 ? "#34d399" : cr.ai_score >= 4 ? "#fbbf24" : "#f87171", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "700" }}>AI Score: {cr.ai_score}/10</span>
                                     <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>{cr.ai_feedback}</span>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           )}
                        </div>
                        );
                     })}
                 </div>
              </div>
            )}

            {/* Per-role Evaluation History */}
            {(selectedAnalysis.role_history?.length > 0) && (
              <>
                <h4>📊 Role Evaluation History</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                  {selectedAnalysis.role_history.map((entry, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: "8px",
                        padding: "10px 14px",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <span style={{ color: "#93c5fd", fontWeight: 600 }}>{entry.role}</span>
                      <span style={{
                        color: scoreColor(entry.ats_score),
                        fontWeight: 700,
                        background: scoreBg(entry.ats_score),
                        padding: "3px 10px",
                        borderRadius: "14px",
                        fontSize: "13px",
                        border: `1px solid ${scoreColor(entry.ats_score)}44`,
                      }}>
                        {entry.ats_score != null ? entry.ats_score : "N/A"}
                      </span>
                      <span style={{ color: "#475569", fontSize: "12px" }}>
                        {entry.evaluated_at ? new Date(entry.evaluated_at).toLocaleDateString("en-IN") : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Suggested Roles from Analysis */}
            <h4>🎯 Suggested Roles</h4>
            <ul>
              {selectedAnalysis.analysis?.roles?.map((r, idx) => (
                <li key={idx}>{r.role} ({Math.round((r.confidence || 0) * 100)}%)</li>
              ))}
            </ul>

            <h4>✅ Matched Skills</h4>
            <ul>
              {(selectedAnalysis.analysis?.ats?.matched_skills || []).map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>

            <h4>❌ Missing Skills</h4>
            <ul>
              {(selectedAnalysis.analysis?.ats?.missing_skills || []).map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>

          </div>
        </div>
      )}

    </div>
  );
}

export default RecruiterDashboard;
