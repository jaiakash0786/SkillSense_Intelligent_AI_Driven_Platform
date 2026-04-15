import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getToken } from "../utils/auth";
import ChatBot from "../components/ChatBot";
import "./StudentDashboard.css";

const API = "http://127.0.0.1:8000";

// ── Constants ────────────────────────────────────────────────────────────────

const NAV_TABS = [
  { id: "overview", label: "Overview", icon: "📋" },
  { id: "resumes", label: "Resumes", icon: "📄" },
  { id: "tests", label: "Tests", icon: "🧪" },
  { id: "evaluation", label: "Evaluation", icon: "🎯" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

function formatDate(dateString) {
  if (!dateString) return "Unknown";
  return new Date(dateString).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ────────────────────────────────────────────────────────────────────────────

function StudentDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── State Management ──────────────────────────────────────────────────────

  // Resume data
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");

  // Analysis & Evaluation
  const [roles, setRoles] = useState([]);
  const [evaluation, setEvaluation] = useState(null);

  // Mock Tests
  const [pendingTests, setPendingTests] = useState([]);
  const [testHistory, setTestHistory] = useState([]);

  // UI State
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const fetchResumes = useCallback(async () => {
    try {
      const response = await fetch(`${API}/student/resumes`, {
        headers: authHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Failed to load resumes");
        return;
      }

      setResumes(data);
      setError("");
    } catch (err) {
      console.error("Failed to fetch resumes:", err);
      setError("Server error loading resumes");
    }
  }, []);

  const fetchMockTests = useCallback(async () => {
    try {
      const [pendingRes, historyRes] = await Promise.all([
        fetch(`${API}/mock-test/assigned`, { headers: authHeaders() }),
        fetch(`${API}/mock-test/my-tests`, { headers: authHeaders() }),
      ]);

      if (pendingRes.ok) {
        const pending = await pendingRes.json();
        setPendingTests(Array.isArray(pending) ? pending : []);
      }

      if (historyRes.ok) {
        const history = await historyRes.json();
        setTestHistory(Array.isArray(history) ? history : []);
      }
    } catch (err) {
      console.error("Failed to fetch mock tests:", err);
    }
  }, []);

  // Initial fetch + refetch on navigation
  useEffect(() => {
    fetchResumes();
    fetchMockTests();
  }, [location.key, fetchResumes, fetchMockTests]);

  // ── Resume Upload ─────────────────────────────────────────────────────────

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setUploadMessage("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    try {
      setLoading(true);
      setUploadMessage("Uploading...");

      const response = await fetch(`${API}/student/resume/upload`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setUploadMessage(data.detail || "Upload failed");
        return;
      }

      setUploadMessage("Resume uploaded successfully ✅");
      setFile(null);
      await fetchResumes();
      setActiveTab("resumes");
    } catch (err) {
      console.error("Upload error:", err);
      setUploadMessage("Server error during upload");
    } finally {
      setLoading(false);
    }
  };

  // ── Resume Analysis ──────────────────────────────────────────────────────

  const fetchAnalysis = async (resumeId) => {
    setSelectedResumeId(resumeId);
    setLoading(true);

    try {
      const response = await fetch(`${API}/student/resume/${resumeId}`, {
        headers: authHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Failed to load analysis");
        return;
      }

      setRoles(data.analysis?.roles || []);
      setEvaluation(null);
      setError("");
      setActiveTab("evaluation");
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Server error loading analysis");
    } finally {
      setLoading(false);
    }
  };

  // ── Role Evaluation ──────────────────────────────────────────────────────

  const handleRoleSelection = async (role) => {
    setLoading(true);

    try {
      const response = await fetch(
        `${API}/student/resume/${selectedResumeId}/evaluate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({ target_role: role }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError("Failed to evaluate resume for selected role");
        return;
      }

      setEvaluation(data);
      setError("");
    } catch (err) {
      console.error("Evaluation error:", err);
      setError("Server error during evaluation");
    } finally {
      setLoading(false);
    }
  };

  // ── Render: Overview Tab ─────────────────────────────────────────────────

  const renderOverview = () => (
    <section className="dash-card overview-card">
      <div className="card-accent" />
      <h2>👋 Welcome to Your Dashboard</h2>
      <p className="card-sub">
        Track your resumes, take tests, and improve your skills
      </p>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-value">{resumes.length}</div>
          <div className="stat-label">Resumes</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{pendingTests.length}</div>
          <div className="stat-label">Pending Tests</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">
            {testHistory.filter((t) => t.status === "completed").length}
          </div>
          <div className="stat-label">Tests Completed</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{roles.length}</div>
          <div className="stat-label">Target Roles</div>
        </div>
      </div>

      <div className="quick-actions">
        <h3>Quick Start</h3>
        <div className="action-buttons">
          <button
            className="action-btn primary"
            onClick={() => setActiveTab("resumes")}
          >
            📄 Upload Resume
          </button>
          <button
            className="action-btn secondary"
            onClick={() => setActiveTab("tests")}
          >
            🧪 View Tests
          </button>
          <button
            className="action-btn secondary"
            onClick={() => navigate("/progress")}
          >
            📊 View Progress
          </button>
        </div>
      </div>
    </section>
  );

  // ── Render: Resumes Tab ──────────────────────────────────────────────────

  const renderResumes = () => (
    <>
      {/* Upload Form */}
      <section className="dash-card upload-card">
        <div className="card-accent" />
        <h2>📤 Upload Your Resume</h2>
        <p className="card-sub">Supported formats: PDF, DOC, DOCX</p>

        <form onSubmit={handleUpload} className="upload-form">
          <label className="file-input-wrapper">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={loading}
              className="file-input"
            />
            <div className="file-input-display">
              <span className="file-icon">📎</span>
              <span className="file-text">
                {file ? file.name : "Choose a file..."}
              </span>
            </div>
          </label>

          <button
            type="submit"
            className="upload-btn"
            disabled={!file || loading}
          >
            {loading ? "Uploading..." : "Upload Resume"}
          </button>
        </form>

        {uploadMessage && (
          <div
            className={`upload-message ${
              uploadMessage.includes("success") ? "success" : "error"
            }`}
          >
            {uploadMessage}
          </div>
        )}
      </section>

      {/* Resume List */}
      <section className="dash-card resume-list-card">
        <div className="card-accent" />
        <h2>📋 Your Resumes</h2>
        <p className="card-sub">
          {resumes.length} resume{resumes.length !== 1 ? "s" : ""} uploaded
        </p>

        {resumes.length === 0 ? (
          <div className="empty-state">
            <p className="empty-icon">📂</p>
            <p className="empty-text">
              No resumes yet. Upload one above to get started!
            </p>
          </div>
        ) : (
          <ul className="resume-list">
            {resumes.map((resume) => (
              <li key={resume.resume_id} className="resume-item">
                <div className="resume-details">
                  <div className="resume-name">📄 {resume.filename}</div>
                  <div className="resume-date">
                    Uploaded {formatDate(resume.uploaded_at)}
                  </div>
                </div>
                <button
                  className="resume-analyze-btn"
                  onClick={() => fetchAnalysis(resume.resume_id)}
                  disabled={loading}
                >
                  Analyze →
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );

  // ── Render: Tests Tab ────────────────────────────────────────────────────

  const renderTests = () => (
    <div className="tests-container">
      {/* Pending Tests */}
      <section className="dash-card pending-card">
        <div className="card-accent" />
        <h2>🕒 Pending Tests</h2>
        <p className="card-sub">
          {pendingTests.length} test{pendingTests.length !== 1 ? "s" : ""}{" "}
          awaiting
        </p>

        {pendingTests.length === 0 ? (
          <div className="empty-state">
            <p className="empty-icon">✨</p>
            <p className="empty-text">No pending tests at the moment.</p>
          </div>
        ) : (
          <ul className="tests-list">
            {pendingTests.map((test) => (
              <li key={test.mock_test_id} className="test-item pending-item">
                <div className="test-header">
                  <span className="test-role">{test.role}</span>
                  <span className="test-badge new">New</span>
                </div>
                <div className="test-topic">{test.skill_topic}</div>
                <button
                  className="test-start-btn"
                  onClick={() =>
                    navigate(`/mock-test?mock_test_id=${test.mock_test_id}`)
                  }
                >
                  Start Test ▶
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Test History */}
      <section className="dash-card history-card">
        <div className="card-accent" />
        <h2>📊 Test History</h2>
        <p className="card-sub">
          {testHistory.filter((t) => t.status === "completed").length} completed
        </p>

        {testHistory.filter((t) => t.status === "completed").length === 0 ? (
          <div className="empty-state">
            <p className="empty-icon">📈</p>
            <p className="empty-text">
              No completed tests yet. Start a test to see your results here!
            </p>
          </div>
        ) : (
          <ul className="tests-list">
            {testHistory
              .filter((t) => t.status === "completed")
              .map((test, idx) => (
                <li key={`${idx}-${test.mock_test_id}`} className="test-item">
                  <div className="test-header">
                    <span className="test-role">{test.role}</span>
                    <span
                      className={`test-score-badge ${
                        test.score >= 70
                          ? "excellent"
                          : test.score >= 50
                            ? "good"
                            : "needs-improvement"
                      }`}
                    >
                      {test.score}%
                    </span>
                  </div>
                  <div className="test-topic">{test.skill_topic}</div>
                  <div className="test-date">{formatDate(test.completed_at)}</div>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );

  // ── Render: Evaluation Tab ───────────────────────────────────────────────

  const renderEvaluation = () => (
    <>
      {/* Role Selection */}
      {roles.length > 0 && !evaluation && (
        <section className="dash-card role-selection-card">
          <div className="card-accent" />
          <h2>🎯 Select a Target Role</h2>
          <p className="card-sub">
            Found {roles.length} matching role{roles.length !== 1 ? "s" : ""}
          </p>

          <div className="role-grid">
            {roles.map((role, idx) => (
              <button
                key={idx}
                className="role-option"
                onClick={() => handleRoleSelection(role.role)}
                disabled={loading}
              >
                <div className="role-option-name">{role.role}</div>
                <div className="role-option-confidence">
                  Match: {Math.round(role.confidence * 100)}%
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Evaluation Results */}
      {evaluation && (
        <>
          <section className="dash-card evaluation-card">
            <div className="card-accent" />
            <h2>📊 ATS Evaluation</h2>
            <p className="card-sub">Role: {evaluation.target_role}</p>

            {/* ATS Score */}
            <div className="ats-score-section">
              <div className="score-display">
                <span className="score-label">ATS Score</span>
                <span className="score-number">
                  {evaluation.ats?.ats_score ?? "N/A"}
                </span>
                <span className="score-max">/100</span>
              </div>
            </div>

            {/* Missing Skills */}
            <div className="missing-skills-section">
              <h3>Missing Skills</h3>
              {evaluation.ats?.missing_skills?.length > 0 ? (
                <ul className="skills-list">
                  {evaluation.ats.missing_skills.map((skill, idx) => (
                    <li key={idx} className="skill-item">
                      <span className="skill-icon">❌</span>
                      <span className="skill-name">{skill}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-missing">Amazing! No missing skills.</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="evaluation-actions">
              <button
                className="action-btn primary"
                onClick={() => navigate("/progress")}
              >
                📊 View Progress
              </button>
              <button
                className="action-btn secondary"
                onClick={() => {
                  setEvaluation(null);
                  setRoles([]);
                  setSelectedResumeId(null);
                }}
              >
                ← Back
              </button>
            </div>
          </section>

          {/* Learning Path */}
          {evaluation.learning_path?.learning_path?.length > 0 && (
            <section className="dash-card learning-path-card">
              <div className="card-accent" />
              <h2>🗺️ Learning Path</h2>
              <p className="card-sub">
                {evaluation.learning_path.learning_path.length} skill
                {evaluation.learning_path.learning_path.length !== 1
                  ? "s"
                  : ""}{" "}
                to master
              </p>

              <div className="learning-grid">
                {evaluation.learning_path.learning_path.map((item, idx) => (
                  <div key={idx} className="learning-item">
                    <div className="learning-header">
                      <h4>{item.skill}</h4>
                      <span className="level-badge">{item.level}</span>
                    </div>

                    <div className="learning-content">
                      <div className="learning-section">
                        <strong>Focus Topics</strong>
                        <ul>
                          {item.focus_topics?.map((topic, i) => (
                            <li key={i}>
                              <span className="topic-icon">✓</span> {topic}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="learning-section">
                        <strong>Projects</strong>
                        <ul>
                          {item.projects?.map((proj, i) => (
                            <li key={i}>
                              <span className="project-icon">🔨</span> {proj}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="learning-cta">
                <button
                  className="action-btn primary"
                  onClick={() => navigate("/learning-path")}
                >
                  Start Learning 🚀
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {/* No Evaluation Yet */}
      {!evaluation && roles.length === 0 && (
        <section className="dash-card empty-eval-card">
          <div className="card-accent" />
          <div className="empty-state">
            <p className="empty-icon">🔍</p>
            <p className="empty-text">
              Upload a resume and select a role to see your evaluation.
            </p>
            <button
              className="action-btn primary"
              onClick={() => setActiveTab("resumes")}
            >
              Upload Resume
            </button>
          </div>
        </section>
      )}
    </>
  );

  // ── Main Render ──────────────────────────────────────────────────────────

  return (
    <div className="student-wrap">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-inner">
          <div className="header-content">
            <h1>Student Dashboard</h1>
            <p className="header-subtitle">
              Manage your resumes, take tests, and track your progress
            </p>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span className="error-text">⚠️ {error}</span>
          <button
            className="error-close"
            onClick={() => setError("")}
            aria-label="Close error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sub Navigation */}
      <nav className="dashboard-nav">
        <div className="nav-inner">
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="content-wrapper">
          {activeTab === "overview" && renderOverview()}
          {activeTab === "resumes" && renderResumes()}
          {activeTab === "tests" && renderTests()}
          {activeTab === "evaluation" && renderEvaluation()}
        </div>
      </main>

      {/* ChatBot */}
      <ChatBot resumeId={selectedResumeId} />
    </div>
  );
}

export default StudentDashboard;