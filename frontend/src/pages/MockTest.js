import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getToken } from "../utils/auth";
import "./MockTest.css";

const API = "http://127.0.0.1:8000";
const FACEAPI_CDN = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
const FACEAPI_MODELS = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

export default function MockTest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const mockTestIdParam = searchParams.get("mock_test_id");
  const roleParam = searchParams.get("role") || "";
  const topic = searchParams.get("topic") || "";
  const resumeId = searchParams.get("resume_id");

  // ── Core test state ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState("loading");
  const [mockTestId, setMockTestId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [codingAnswers, setCodingAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [displayRole, setDisplayRole] = useState(roleParam);
  const [displayTopic, setDisplayTopic] = useState(topic);

  // ── Timer state ───────────────────────────────────────────────────
  const TIMER_SECONDS = 30 * 60; // 30 minutes
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const timerRef = useRef(null);
  const fsButtonRef = useRef(null);
  const [startTest, setStartTest] = useState(false);
  const [fsFailed, setFsFailed] = useState(false);

  // ── Proctoring state ─────────────────────────────────────────────────────
  const [fsWarning, setFsWarning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violationMsg, setViolationMsg] = useState("");
  const [cameraError, setCameraError] = useState(false);
  const [faceStatus, setFaceStatus] = useState("ok");
  const [violationCount, setViolationCount] = useState(0);

  const fsExits = useRef(0);
  const violations = useRef([]);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceInterval = useRef(null);
  const faceApiLoaded = useRef(false);
  const autoSubmitting = useRef(false);
  const consecutiveMisses = useRef(0);

  const LIMITS = { tab_switch: 1, no_face: 2, multiple_faces: 2 };
  const autoSubmitRef = useRef(null);

  // ── Violation logging ────────────────────────────────────────────────────
  const logViolation = useCallback((type) => {
    const entry = { type, timestamp: new Date().toISOString() };
    violations.current.push(entry);
    setViolationCount(violations.current.length);

    const typeCount = violations.current.filter((v) => v.type === type).length;
    const limit = LIMITS[type];

    const msgMap = {
      tab_switch: `⚠️ Tab switch detected! (${typeCount}/${limit || 1})`,
      no_face: `⚠️ No face detected! (${typeCount}/${limit})`,
      multiple_faces: `⚠️ Multiple faces! (${typeCount}/${limit})`,
      copy_attempt: "⚠️ Copy/paste is not allowed!",
      fullscreen_exit: "⚠️ Fullscreen exit detected!",
    };

    setViolationMsg(msgMap[type] || "⚠️ Violation detected!");
    setTimeout(() => setViolationMsg(""), 4000);

    if (limit && typeCount >= limit && !autoSubmitting.current && autoSubmitRef.current) {
      autoSubmitting.current = true;
      setViolationMsg(`🚨 Too many violations! Test will auto-submit in 3 seconds...`);
      setTimeout(() => {
        autoSubmitRef.current();
      }, 3000);
    }
  }, []);

  // ── Fullscreen helpers ───────────────────────────────────────────────────
  const enterFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch((e) =>
        console.warn("Fullscreen rejected:", e.message)
      );
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.mozRequestFullScreen) {
      el.mozRequestFullScreen();
    }
  };

  const exitFullscreenSafe = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleFsChange = useCallback(() => {
    const isFs = !!(
      document.fullscreenElement || document.webkitFullscreenElement
    );
    setIsFullscreen(isFs);
    if (!isFs && phase === "test") {
      fsExits.current += 1;
      logViolation("fullscreen_exit");
      setFsWarning(true);
      setTimeout(() => setFsWarning(false), 4000);
    }
  }, [phase, logViolation]);

  // ── Camera setup ─────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;
    } catch (e) {
      console.warn("Camera not available:", e.message);
      setCameraError(true);
    }
  };

  useEffect(() => {
    if (phase === "test" && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [phase]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (faceInterval.current) {
      clearInterval(faceInterval.current);
      faceInterval.current = null;
    }
  };

  // ── Face detection ───────────────────────────────────────────────────────
  const loadFaceApi = () => {
    return new Promise((resolve) => {
      if (window.faceapi) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = FACEAPI_CDN;
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });
  };

  const startFaceDetection = async () => {
    await loadFaceApi();
    if (!window.faceapi) return;

    try {
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(FACEAPI_MODELS);
      faceApiLoaded.current = true;
    } catch (e) {
      console.warn("Face detection models failed:", e);
      return;
    }

    faceInterval.current = setInterval(async () => {
      if (!videoRef.current || !faceApiLoaded.current) return;
      try {
        const detections = await window.faceapi.detectAllFaces(
          videoRef.current,
          new window.faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.25 })
        );

        if (detections.length === 0) {
          consecutiveMisses.current += 1;
          setFaceStatus("no_face");
          if (consecutiveMisses.current >= 3) {
            logViolation("no_face");
            consecutiveMisses.current = 0;
          }
        } else if (detections.length > 1) {
          consecutiveMisses.current = 0;
          setFaceStatus("multiple_faces");
          logViolation("multiple_faces");
        } else {
          consecutiveMisses.current = 0;
          setFaceStatus("ok");
        }
      } catch (e) {
        /* ignore */
      }
    }, 6000);
  };

  // ── Tab switch detection ─────────────────────────────────────────────────
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && phase === "test") {
      logViolation("tab_switch");
    }
  }, [phase, logViolation]);

  // ── Copy-paste blocking ──────────────────────────────────────────────────
  const blockCopy = useCallback(
    (e) => {
      if (phase === "test") {
        e.preventDefault();
        logViolation("copy_attempt");
      }
    },
    [phase, logViolation]
  );

  const blockContextMenu = useCallback(
    (e) => {
      if (phase === "test") e.preventDefault();
    },
    [phase]
  );

  // ── Event listeners lifecycle ────────────────────────────────────────────
  useEffect(() => {
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("copy", blockCopy);
    document.addEventListener("cut", blockCopy);
    document.addEventListener("contextmenu", blockContextMenu);

    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("cut", blockCopy);
      document.removeEventListener("contextmenu", blockContextMenu);
    };
  }, [handleFsChange, handleVisibilityChange, blockCopy, blockContextMenu]);

  // ── Load questions ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        let data;
        if (mockTestIdParam) {
          const res = await fetch(
            `${API}/mock-test/start-assigned/${mockTestIdParam}`,
            {
              method: "POST",
              headers: authHeaders(),
            }
          );
          data = await res.json();
          if (!res.ok) throw new Error(data.detail || "Failed to load test");
        } else {
          const res = await fetch(`${API}/mock-test/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({
              resume_id: Number(resumeId),
              role: roleParam,
              skill_topic: topic,
            }),
          });
          data = await res.json();
          if (!res.ok) throw new Error(data.detail || "Failed to generate");
        }
        setMockTestId(data.mock_test_id);
        setQuestions(data.questions || []);
        if (data.role) setDisplayRole(data.role);
        if (data.skill_topic) setDisplayTopic(data.skill_topic);
        setPhase("ready");
      } catch (e) {
        setError(e.message);
        setPhase("error");
      }
    })();
    return () => stopCamera();
    // eslint-disable-next-line
  }, []);

  // ── Camera warm-up ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "ready") {
      startCamera();
    }
  }, [phase]);

  const beginTest = () => {
    setPhase("fullscreen");
  };

  // ── Fullscreen button handler ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "fullscreen" || !fsButtonRef.current) return;
    setFsFailed(false);

    const btn = fsButtonRef.current;
    const handleNativeClick = () => {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch((e) => {
          console.warn("FS denied:", e.message);
          setFsFailed(true);
        });
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        el.mozRequestFullScreen();
      }
      setTimeout(() => {
        const inFs = !!(
          document.fullscreenElement || document.webkitFullscreenElement
        );
        if (!inFs) setFsFailed(true);
      }, 900);
      setStartTest(true);
    };

    btn.addEventListener("click", handleNativeClick);
    return () => btn.removeEventListener("click", handleNativeClick);
  }, [phase]);

  // ── Start test when fullscreen activated ─────────────────────────────────
  useEffect(() => {
    if (!startTest) return;
    setStartTest(false);
    startFaceDetection();
    setPhase("test");
    setTimeLeft(TIMER_SECONDS);
    timerRef.current = setInterval(
      () =>
        setTimeLeft((p) =>
          p <= 1 ? (clearInterval(timerRef.current), 0) : p - 1
        ),
      1000
    );
    // eslint-disable-next-line
  }, [startTest]);

  // ── Answer helpers ───────────────────────────────────────────────────────
  const selectAnswer = (letter) =>
    setAnswers((prev) => ({ ...prev, [current]: letter }));
  const selectCodingAnswer = (text) =>
    setCodingAnswers((prev) => ({ ...prev, [current]: text }));
  const goNext = () => setCurrent((c) => Math.min(c + 1, questions.length - 1));
  const goPrev = () => setCurrent((c) => Math.max(c - 1, 0));

  // ── Submit handler ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopCamera();
    exitFullscreenSafe();

    const answersPayload = questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => !q.type || q.type === "mcq")
      .map(({ q, idx }) => {
        const chosen = answers[idx] || null;
        return {
          question: q.question,
          chosen,
          correct: q.answer,
          is_correct: chosen === q.answer && chosen !== null,
        };
      });

    const codingPayload = questions
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => q.type === "coding")
      .map(({ q, idx }) => ({
        question: q.question,
        answer_text: codingAnswers[idx] || "",
      }));

    try {
      const res = await fetch(`${API}/mock-test/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          mock_test_id: mockTestId,
          answers: answersPayload,
          coding_answers: codingPayload,
          fullscreen_exits: fsExits.current,
          violations: violations.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        let errMsg;
        if (Array.isArray(data.detail)) {
          errMsg = data.detail
            .map((e) => `${(e.loc || []).join(".")}: ${e.msg}`)
            .join(" | ");
        } else {
          errMsg = data.detail || `Server error (${res.status})`;
        }
        throw new Error(errMsg);
      }
      setResult({ ...data, violations: violations.current });
      setPhase("result");
    } catch (e) {
      setError(e.message);
      setPhase("error");
    }
  };

  // ── Wire auto-submit ─────────────────────────────────────────────────────
  useEffect(() => {
    autoSubmitRef.current = handleSubmit;
  });

  // ── Timer auto-submit ────────────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft === 0 && phase === "test" && !autoSubmitting.current) {
      autoSubmitting.current = true;
      handleSubmit();
    }
    // eslint-disable-next-line
  }, [timeLeft, phase]);

  // ── Formatting ───────────────────────────────────────────────────────────
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const timerClass =
    timeLeft <= 120
      ? "mt-timer mt-timer-danger"
      : timeLeft <= 300
      ? "mt-timer mt-timer-warn"
      : "mt-timer";

  const answeredCount = Object.keys(answers).length;
  const pct =
    questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  // ── PHASES ───────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="mt-fullscreen mt-center">
        <div className="mt-spinner" />
        <p className="mt-loading-text">🤖 AI is generating your personalized questions…</p>
        <p className="mt-loading-sub">This takes a few seconds — hang tight!</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mt-fullscreen mt-center">
        <div className="mt-error-icon">⚠️</div>
        <h2>Something went wrong</h2>
        <p className="mt-error-msg">{error}</p>
        <button className="mt-btn mt-btn-secondary" onClick={() => navigate(-1)}>
          ← Go Back
        </button>
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="mt-fullscreen mt-scrollable">
        <div className="mt-result-card" style={{ maxWidth: 500 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧪</div>
          <h2 className="mt-result-title">Your test is ready!</h2>
          <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
            <strong style={{ color: "#a78bfa" }}>{displayRole}</strong>
            {" · "}
            <strong style={{ color: "#60a5fa" }}>{displayTopic}</strong>
          </p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 6 }}>
            {questions.length} questions · Fullscreen + camera enabled
          </p>
          <div className="mt-proctor-notice">
            📷 Camera &nbsp;|&nbsp; 👁️ Face monitoring &nbsp;|&nbsp; 🔒 Anti-cheat
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button
              className="mt-btn mt-btn-secondary"
              onClick={() => navigate(-1)}
            >
              ← Go Back
            </button>
            <button
              className="mt-btn mt-btn-primary"
              style={{ fontSize: 18, padding: "14px 36px" }}
              onClick={beginTest}
            >
              🚀 Begin Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "fullscreen") {
    return (
      <div className="mt-fullscreen mt-scrollable">
        <div className="mt-result-card" style={{ maxWidth: 500, textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⛶</div>
          <h2 className="mt-result-title">Enter Fullscreen to Start</h2>

          {!fsFailed ? (
            <>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, marginBottom: 20 }}>
                Your exam must run in fullscreen mode.
                <br />
                Click the button below — your browser will go fullscreen.
              </p>
              <button
                ref={fsButtonRef}
                className="mt-btn mt-btn-primary"
                style={{ fontSize: 17, padding: "14px 40px" }}
              >
                🔒 Go Fullscreen &amp; Start
              </button>
            </>
          ) : (
            <>
              <div
                style={{
                  background: "rgba(248,113,113,0.15)",
                  border: "1px solid #f87171",
                  borderRadius: 12,
                  padding: "16px 20px",
                  marginBottom: 16,
                }}
              >
                <p style={{ color: "#f87171", fontWeight: 700, marginBottom: 6 }}>
                  Browser blocked fullscreen
                </p>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: 0 }}>
                  Press{" "}
                  <kbd
                    style={{
                      background: "#334155",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontFamily: "monospace",
                      fontSize: 15,
                    }}
                  >
                    F11
                  </kbd>{" "}
                  on your keyboard to enter fullscreen manually, then continue.
                </p>
              </div>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginBottom: 12 }}>
                Or continue without fullscreen (proctoring still active):
              </p>
              <button
                className="mt-btn mt-btn-primary"
                style={{ fontSize: 15, padding: "12px 32px" }}
                onClick={() => {
                  startFaceDetection();
                  setPhase("test");
                  setTimeLeft(TIMER_SECONDS);
                  timerRef.current = setInterval(
                    () =>
                      setTimeLeft((p) =>
                        p <= 1 ? (clearInterval(timerRef.current), 0) : p - 1
                      ),
                    1000
                  );
                }}
              >
                ▶ Start Test Anyway
              </button>
            </>
          )}

          <br />
          <button
            className="mt-btn mt-btn-secondary"
            style={{ marginTop: 14 }}
            onClick={() => {
              setFsFailed(false);
              setPhase("ready");
            }}
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const scoreColor = result.score >= 70 ? "#34d399" : result.score >= 40 ? "#fbbf24" : "#f87171";
    const tabSwitches =
      result.violations?.filter((v) => v.type === "tab_switch").length || 0;
    const noFace =
      result.violations?.filter((v) => v.type === "no_face").length || 0;
    const multiFace =
      result.violations?.filter((v) => v.type === "multiple_faces").length || 0;
    const copyAttempts =
      result.violations?.filter((v) => v.type === "copy_attempt").length || 0;
    const totalViolations = result.violations?.length || 0;

    return (
      <div className="mt-fullscreen mt-scrollable">
        <div className="mt-result-card">
          <div className="mt-result-icon">
            {result.score >= 70 ? "🎉" : result.score >= 40 ? "📚" : "💪"}
          </div>
          <h2 className="mt-result-title">Test Complete!</h2>
          <div className="mt-score-ring" style={{ "--score-color": scoreColor }}>
            <span className="mt-score-num">{result.score}%</span>
            <span className="mt-score-label">Score</span>
          </div>
          <div className="mt-result-stats">
            <div className="mt-stat">
              <span className="mt-stat-val">{result.correct_answers}</span>
              <span className="mt-stat-lbl">Correct</span>
            </div>
            <div className="mt-stat">
              <span className="mt-stat-val">
                {result.total_questions - result.correct_answers}
              </span>
              <span className="mt-stat-lbl">Wrong</span>
            </div>
            <div className="mt-stat">
              <span className="mt-stat-val">{result.total_questions}</span>
              <span className="mt-stat-lbl">Total</span>
            </div>
          </div>

          {totalViolations > 0 && (
            <div className="mt-violation-summary">
              <div className="mt-violation-title">🚨 Proctoring Report</div>
              <div className="mt-violation-grid">
                {result.fullscreen_exits > 0 && (
                  <div className="mt-vio-item">
                    <span>🖥️ Fullscreen exits</span>
                    <span>{result.fullscreen_exits}</span>
                  </div>
                )}
                {tabSwitches > 0 && (
                  <div className="mt-vio-item">
                    <span>🔀 Tab switches</span>
                    <span>{tabSwitches}</span>
                  </div>
                )}
                {noFace > 0 && (
                  <div className="mt-vio-item">
                    <span>👤 No face detected</span>
                    <span>{noFace}×</span>
                  </div>
                )}
                {multiFace > 0 && (
                  <div className="mt-vio-item">
                    <span>👥 Multiple faces</span>
                    <span>{multiFace}×</span>
                  </div>
                )}
                {copyAttempts > 0 && (
                  <div className="mt-vio-item">
                    <span>📋 Copy attempts</span>
                    <span>{copyAttempts}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-result-msg">
            {result.score >= 70
              ? "Excellent work! You have a strong grasp of this topic."
              : result.score >= 40
              ? "Good effort! Review the topics you missed."
              : "Keep practicing! Revisit the learning path and try again."}
          </div>

          {result.coding_results?.length > 0 && (
            <div className="mt-coding-results">
              <div className="mt-coding-results-title">💻 Coding Evaluation</div>
              {result.coding_results.map((cr, i) => (
                <div key={i} className="mt-coding-result-item">
                  <div className="mt-coding-result-q">Q: {cr.question}</div>
                  <div className="mt-coding-result-score">
                    <span className="mt-coding-score-pill">Score: {cr.ai_score}/10</span>
                  </div>
                  <div className="mt-coding-feedback">💬 {cr.ai_feedback}</div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-result-actions">
            <button
              className="mt-btn mt-btn-primary"
              onClick={() => navigate("/progress")}
            >
              📊 View Progress
            </button>
            <button
              className="mt-btn mt-btn-secondary"
              onClick={() => navigate("/student")}
            >
              🏠 Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── TEST PHASE ───────────────────────────────────────────────────────────
  const q = questions[current];
  const chosen = answers[current];

  return (
    <div className="mt-fullscreen" style={{ userSelect: "none" }}>
      {fsWarning && (
        <div className="mt-violation-banner">
          ⚠️ Fullscreen exit detected! Please return to fullscreen.
          <button className="mt-fs-return-btn" onClick={enterFullscreen}>
            Return to Fullscreen
          </button>
        </div>
      )}

      {violationMsg && !fsWarning && (
        <div className="mt-violation-banner">{violationMsg}</div>
      )}

      <div className={`mt-camera-pip ${faceStatus !== "ok" ? "mt-camera-alert" : ""}`}>
        {cameraError ? (
          <div className="mt-camera-unavail">
            📷
            <br />
            No Camera
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="mt-camera-video"
          />
        )}
        <div className="mt-face-status">
          {faceStatus === "ok" && <span className="mt-face-ok">✅ Face OK</span>}
          {faceStatus === "no_face" && <span className="mt-face-bad">⚠️ No Face</span>}
          {faceStatus === "multiple_faces" && (
            <span className="mt-face-bad">⚠️ Multi-Face</span>
          )}
        </div>
        <div className="mt-vio-count">
          🚨 {violationCount} violation{violationCount !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="mt-header">
        <div className="mt-header-left">
          <span className="mt-badge-role">{displayRole}</span>
          <span className="mt-badge-topic">📖 {displayTopic}</span>
        </div>
        <div className="mt-header-center">
          <div className="mt-top-progress-bar">
            <div className="mt-top-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="mt-progress-text">
            {answeredCount} / {questions.length} answered
          </span>
        </div>
        <div className="mt-header-right">
          {!isFullscreen && (
            <button className="mt-btn mt-btn-fs-enter" onClick={enterFullscreen}>
              ⛶ Enter Fullscreen
            </button>
          )}
          <span className={timerClass}>⏱️ {formatTime(timeLeft)}</span>
          <span className="mt-q-counter">
            Q {current + 1} of {questions.length}
          </span>
        </div>
      </div>

      <div className="mt-body">
        <div className="mt-question-card">
          <div className="mt-question-num">
            Question {current + 1}
            {q?.type === "coding" && <span className="mt-coding-badge"> 💻 Coding</span>}
            {q?.difficulty && q?.type !== "coding" && (
              <span className={`mt-diff-badge mt-diff-${q.difficulty}`}>
                {" "}
                {q.difficulty}
              </span>
            )}
          </div>
          <div className="mt-question-text">{q?.question}</div>

          {(!q?.type || q?.type === "mcq") && (
            <div className="mt-options">
              {q &&
                Object.entries(q.options).map(([letter, text]) => (
                  <button
                    key={letter}
                    className={`mt-option ${
                      chosen === letter ? "mt-option-selected" : ""
                    }`}
                    onClick={() => selectAnswer(letter)}
                  >
                    <span className="mt-option-letter">{letter}</span>
                    <span className="mt-option-text">{text}</span>
                  </button>
                ))}
            </div>
          )}

          {q?.type === "coding" && (
            <div className="mt-coding-section">
              {q.hint && <div className="mt-coding-hint">💡 Hint: {q.hint}</div>}
              <textarea
                className="mt-coding-area"
                placeholder="Write your pseudo-code or solution here..."
                value={codingAnswers[current] || ""}
                onChange={(e) => selectCodingAnswer(e.target.value)}
                rows={10}
              />
            </div>
          )}
        </div>

        <div className="mt-dots">
          {questions.map((_, i) => (
            <button
              key={i}
              className={`mt-dot ${i === current ? "mt-dot-active" : ""} ${
                answers[i] ? "mt-dot-answered" : ""
              }`}
              onClick={() => setCurrent(i)}
            />
          ))}
        </div>
      </div>

      <div className="mt-footer">
        <button
          className="mt-btn mt-btn-secondary"
          onClick={goPrev}
          disabled={current === 0}
        >
          ← Previous
        </button>
        {current < questions.length - 1 ? (
          <button className="mt-btn mt-btn-primary" onClick={goNext}>
            Next →
          </button>
        ) : (
          <button className="mt-btn mt-btn-submit" onClick={handleSubmit}>
            ✅ Submit Test
          </button>
        )}
      </div>
    </div>
  );
}
