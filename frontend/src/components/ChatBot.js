import { useState, useRef, useEffect } from "react";
import { getToken } from "../utils/auth";
import "./ChatBot.css";

const SUGGESTIONS = [
    "What are my missing skills?",
    "Suggest free courses for my gaps",
    "How can I improve my resume?",
    "What roles suit me best?",
    "Best YouTube channels for my field?",
];

function ChatBot({ resumeId }) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content:
                "👋 Hi! I'm **SkillBot**, your personal career assistant.\n\nI know your resume, skills, and ATS score. Ask me anything — free courses, resume tips, skill gaps, or career advice!",
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);
    const textareaRef = useRef(null);

    // Auto-scroll to latest message
    useEffect(() => {
        if (open && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, loading, open]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height =
                Math.min(textareaRef.current.scrollHeight, 80) + "px";
        }
    }, [input]);

    const sendMessage = async (text) => {
        const userText = (text || input).trim();
        if (!userText || loading) return;

        const updatedMessages = [...messages, { role: "user", content: userText }];
        setMessages(updatedMessages);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch("http://127.0.0.1:8000/student/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${getToken()}`,
                },
                body: JSON.stringify({
                    messages: updatedMessages.map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                    resume_id: resumeId || null,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: `⚠️ Error: ${data.detail || "Something went wrong."}`,
                    },
                ]);
                return;
            }

            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.reply },
            ]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: "⚠️ Could not reach the server. Please try again.",
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Simple markdown-like bold rendering
    const renderContent = (text) => {
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <>
            {/* Floating Bubble */}
            <button
                className="chatbot-bubble"
                onClick={() => setOpen((o) => !o)}
                title="Chat with SkillBot"
            >
                {open ? "✕" : "💬"}
                {!open && <span className="bubble-badge" />}
            </button>

            {/* Chat Panel */}
            {open && (
                <div className="chatbot-panel">
                    {/* Header */}
                    <div className="chatbot-header">
                        <div className="chatbot-header-info">
                            <div className="chatbot-avatar">🤖</div>
                            <div>
                                <h4>SkillBot</h4>
                                <p>Your personal career assistant</p>
                            </div>
                        </div>
                        <button
                            className="chatbot-close-btn"
                            onClick={() => setOpen(false)}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="chatbot-messages">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`chat-msg ${msg.role}`}>
                                <div className="bubble">{renderContent(msg.content)}</div>
                            </div>
                        ))}

                        {/* Typing Indicator */}
                        {loading && (
                            <div className="chat-msg assistant">
                                <div className="typing-indicator">
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>

                    {/* Suggestion Chips — show only on first message */}
                    {messages.length === 1 && !loading && (
                        <div className="chatbot-suggestions">
                            {SUGGESTIONS.map((s, i) => (
                                <button
                                    key={i}
                                    className="suggestion-chip"
                                    onClick={() => sendMessage(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input Row */}
                    <div className="chatbot-input-row">
                        <textarea
                            ref={textareaRef}
                            className="chatbot-input"
                            placeholder="Ask me anything..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            disabled={loading}
                        />
                        <button
                            className="chatbot-send-btn"
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || loading}
                            title="Send"
                        >
                            ➤
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

export default ChatBot;
