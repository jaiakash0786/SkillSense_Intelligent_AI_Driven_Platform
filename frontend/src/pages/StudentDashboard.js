import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../utils/auth";
import ChatBot from "../components/ChatBot";
import "./StudentDashboard.css";

function StudentDashboard() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");

  const [roles, setRoles] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [selectedResumeId, setSelectedResumeId] = useState(null);

  const fetchResumes = async () => {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/student/resumes",
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Failed to load resumes");
        return;
      }

      setResumes(data);
    } catch {
      setError("Server error");
    }
  };

  useEffect(() => {
    fetchResumes();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setUploadMessage("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    try {
      setUploadMessage("Uploading... ");

      const response = await fetch(
        "http://127.0.0.1:8000/student/resume/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`
          },
          body: formData
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setUploadMessage(data.detail || "Upload failed");
        return;
      }

      setUploadMessage("Resume uploaded successfully ✅");
      setFile(null);
      fetchResumes();

    } catch {
      setUploadMessage("Server error during upload");
    }
  };

  const fetchAnalysis = async (resumeId) => {
    setSelectedResumeId(resumeId);

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/student/resume/${resumeId}`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "Failed to load analysis");
        return;
      }


      setRoles(data.analysis?.roles || []);
      setEvaluation(null);


    } catch {
      alert("Server error");
    }
  };

  const handleRoleSelection = async (role) => {


    try {
      const response = await fetch(
        `http://127.0.0.1:8000/student/resume/${selectedResumeId}/evaluate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`
          },
          body: JSON.stringify({ target_role: role })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert("Failed to evaluate resume for selected role");
        return;
      }

      setEvaluation(data);

    } catch {
      alert("Server error");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";

    return new Date(dateString).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "medium",
    });
  };

  return (
    <div className="student-wrap">

      {/* Upload Section */}
      <div className="upload-section">
        <h2>Student Dashboard</h2>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <form onSubmit={handleUpload}>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setFile(e.target.files[0])}
          />

          <button type="submit">Upload Resume</button>
        </form>

        {uploadMessage && <p>{uploadMessage}</p>}
      </div>

      {/* Resume List */}
      <h3>Your Resumes</h3>

      {resumes.length === 0 ? (
        <p style={{ textAlign: "center", color: "#cbd5e1" }}>
          No resumes uploaded yet.
        </p>
      ) : (
        <ul className="resume-list">
          {resumes.map((resume) => (
            <li key={resume.resume_id} className="resume-card">
              <button onClick={() => fetchAnalysis(resume.resume_id)}>
                {resume.filename}
              </button>

              <p>Uploaded at: {formatDate(resume.uploaded_at)}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Role Selection */}
      {roles.length > 0 && (
        <div className="role-selection-section">
          <h3>Select a Target Role</h3>

          {roles.map((r, idx) => (
            <button
              key={idx}
              className="role-button"
              onClick={() => handleRoleSelection(r.role)}
            >
              {r.role} ({Math.round(r.confidence * 100)}%)
            </button>
          ))}
        </div>
      )}

      {/* Evaluation */}
      {evaluation && (
        <div className="evaluation-section">
          <h3>ATS Evaluation — {evaluation.target_role}</h3>

          <p>
            <strong>ATS Score:</strong>{" "}
            {evaluation.ats?.ats_score ?? "N/A"}
          </p>

          <h4>Missing Skills</h4>
          <ul>
            {(evaluation.ats?.missing_skills?.core ||
              evaluation.ats?.missing_skills ||
              []).map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
          </ul>

          {/* View Progress CTA — pinned before the long learning path */}
          <div style={{ textAlign: "center", margin: "20px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "16px" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            <button
              onClick={() => navigate("/progress")}
              style={{
                padding: "12px 28px",
                background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
                boxShadow: "0 4px 18px rgba(139,92,246,0.35)",
                transition: "all 0.3s ease",
                letterSpacing: "0.3px",
                whiteSpace: "nowrap",
              }}
              onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(139,92,246,0.5)"; }}
              onMouseOut={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 18px rgba(139,92,246,0.35)"; }}
            >
              📊 View My Progress →
            </button>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
          </div>

          <h4>Learning Path</h4>
          <div className="learning-grid">
            {evaluation.learning_path?.learning_path?.map((item, index) => (
              <div key={index} className="learning-card">

                <div className="skill-title">{item.skill}</div>
                <div className="skill-level">{item.level}</div>

                <strong>Focus Topics:</strong>
                <ul>
                  {item.focus_topics?.map((topic, i) => (
                    <li key={i}>{topic}</li>
                  ))}
                </ul>

                <strong>Projects:</strong>
                <ul>
                  {item.projects?.map((proj, i) => (
                    <li key={i}>{proj}</li>
                  ))}
                </ul>

              </div>
            ))}
          </div>

        </div>
      )}

      {/* View Progress CTA */}
      {evaluation && (
        <div style={{ textAlign: "center", marginTop: "-10px", marginBottom: "30px", position: "relative", zIndex: 1 }}>
          <button
            onClick={() => navigate("/progress")}
            style={{
              padding: "13px 32px",
              background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 4px 18px rgba(139,92,246,0.35)",
              transition: "all 0.3s ease",
              letterSpacing: "0.3px",
            }}
            onMouseOver={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(139,92,246,0.5)"; }}
            onMouseOut={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 18px rgba(139,92,246,0.35)"; }}
          >
            📊 View My Progress →
          </button>
        </div>
      )}

      {/* Personalised ChatBot */}
      <ChatBot resumeId={selectedResumeId} />

    </div>
  );
}

export default StudentDashboard;
