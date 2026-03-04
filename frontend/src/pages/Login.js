import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Login failed");
        return;
      }

      localStorage.setItem("access_token", data.access_token);

      const decoded = jwtDecode(data.access_token);

      if (decoded.role === "recruiter") {
        navigate("/recruiter");
      } else {
        navigate("/student");
      }

    } catch (error) {
      setMessage("Server error");
    }
  };

  return (
    <div className="login-container">

      <div className="login-card">
        <h2>Welcome Back 👋</h2>

        <form onSubmit={handleLogin}>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit">
            Login
          </button>
          <p style={{ marginTop: "10px" }}>
            Don’t have an account ?{" "}
            <a href="/register"> Register here </a>
          </p>


        </form>

        <p>{message}</p>

      </div>

    </div>
  );
}

export default Login;
