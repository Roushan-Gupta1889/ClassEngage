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
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white font-bold shadow-md">
              CE
            </div>
            <span className="text-xl font-semibold text-gray-800">ClassEngage</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/" className="text-sm text-gray-600 hover:text-gray-900 transition">Home</Link>
            {user && <Link to="/sessions" className="text-sm text-gray-600 hover:text-gray-900 transition">My Sessions</Link>}
            {!user ? (
              <Link to="/login" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition shadow-sm">
                Sign In
              </Link>
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium text-sm">
                {user.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
          </nav>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sessions/:sessionId" element={<SessionPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/sessions" element={<MySessions />} />
        </Routes>
      </main>

      <footer className="max-w-7xl mx-auto py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} ClassEngage — Built for interactive learning
      </footer>
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
