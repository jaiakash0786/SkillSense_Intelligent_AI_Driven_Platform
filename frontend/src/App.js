import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import StudentDashboard from "./pages/StudentDashboard";
import RecruiterDashboard from "./pages/RecruiterDashboard";
import ProgressTracker from "./pages/ProgressTracker";
import LearningPath from "./pages/LearningPath";

import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import SplashScreen from "./components/SplashScreen";

function App() {

  const [loading, setLoading] = useState(true);

  // Show Splash FIRST
  if (loading) {
    return (
      <SplashScreen onFinish={() => setLoading(false)} />
    );
  }

  return (
    <BrowserRouter>

      {/* Global Navbar */}
      <Navbar />

      <Routes>

        {/* Default Route */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Student */}
        <Route
          path="/student"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected Recruiter */}
        <Route
          path="/recruiter"
          element={
            <ProtectedRoute requiredRole="recruiter">
              <RecruiterDashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected Progress Tracker */}
        <Route
          path="/progress"
          element={
            <ProtectedRoute requiredRole="student">
              <ProgressTracker />
            </ProtectedRoute>
          }
        />

        {/* Protected Learning Path */}
        <Route
          path="/learning-path"
          element={
            <ProtectedRoute requiredRole="student">
              <LearningPath />
            </ProtectedRoute>
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;
