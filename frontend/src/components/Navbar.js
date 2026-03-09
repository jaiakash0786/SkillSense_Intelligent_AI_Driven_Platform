import { useLocation, useNavigate, Link } from "react-router-dom";
import { getUserFromToken } from "../utils/auth";
import "./Navbar.css";

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide navbar entirely on login and register pages
  const hideNavbar = ["/login", "/register"].includes(location.pathname);
  if (hideNavbar) return null;

  const user = getUserFromToken();

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    navigate("/login");
  };

  return (
    <div className="navbar">
      {/* Logo */}
      <div className="logo">MIMINI</div>

      {/* Right side: show role label + logout when logged in */}
      <div className="nav-links">
        {user && (
          <>
            <span className="nav-role-badge">
              {user.role === "recruiter" ? "🏢 Recruiter" : "🎓 Student"}
            </span>
            {user.role === "student" && (
              <Link to="/progress" className="nav-progress-link">📊 My Progress</Link>
            )}
            <button className="nav-logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default Navbar;
