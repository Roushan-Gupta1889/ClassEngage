import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import SessionPage from "./pages/SessionPage";
import Login from "./pages/Login";
import MySessions from "./pages/MySessions";
import { AuthProvider, useAuth } from "./firebase/AuthProvider";
import { ToastProvider } from "./components/Toast";

function AppShell() {
  const { user } = useAuth();
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">ClassEngage</div>
        <nav>
          <Link to="/">Home</Link>
          {user && <Link to="/sessions">My Sessions</Link>}
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sessions/:sessionId" element={<SessionPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/sessions" element={<MySessions/>} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AuthProvider>
  );
}
