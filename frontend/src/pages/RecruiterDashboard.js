import { useEffect, useState } from "react";
import { getToken } from "../utils/auth";
import "./RecruiterDashboard.css";

function RecruiterDashboard() {
  const [allCandidates, setAllCandidates] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState("");
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const [minAts, setMinAts] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");

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

  const fetchAnalysis = async (resumeId, role) => {
    setLoading(true);
    setSelectedAnalysis(null);

    try {
      const roleParam = role ? `?role=${encodeURIComponent(role)}` : "";
      const response = await fetch(
        `http://127.0.0.1:8000/recruiter/resume/${resumeId}${roleParam}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "Failed to load analysis");
        return;
      }

      setSelectedAnalysis(data);
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
                  <button onClick={() => fetchAnalysis(c.resume_id, c.role)}>
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

            <h3>Candidate Analysis</h3>

            <p><strong>Email:</strong> {selectedAnalysis.candidate_email}</p>
            <p><strong>Resume:</strong> {selectedAnalysis.filename}</p>

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
