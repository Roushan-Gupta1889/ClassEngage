import { Link } from "react-router-dom";
import { useAuth } from "../firebase/AuthProvider";

export default function Home() {
  const { user, logout } = useAuth();
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-12 text-center text-white shadow-lg">
        <h1 className="text-4xl font-bold mb-3">Welcome to ClassEngage</h1>
        <p className="text-lg opacity-90 mb-8">
          Live polls & real-time leaderboards for Google Meet
        </p>
        {!user ? (
          <Link to="/login">
            <button className="px-8 py-3 bg-white text-indigo-600 font-semibold rounded-lg shadow hover:bg-gray-50 transition">
              Get Started
            </button>
          </Link>
        ) : (
          <div className="flex gap-4 justify-center">
            <Link to="/sessions">
              <button className="px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg shadow hover:bg-gray-50 transition">
                My Sessions
              </button>
            </Link>
            <button onClick={logout} className="px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition">
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
            <span className="text-xl font-bold text-indigo-600">1</span>
          </div>
          <h4 className="text-lg font-semibold text-gray-800 mb-2">Create a Session</h4>
          <p className="text-sm text-gray-500">Start a new session from the dashboard and get a unique session ID to share with students.</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
            <span className="text-xl font-bold text-blue-600">2</span>
          </div>
          <h4 className="text-lg font-semibold text-gray-800 mb-2">Students Join via Extension</h4>
          <p className="text-sm text-gray-500">Students install the Chrome extension and enter the session ID to join from Google Meet.</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
            <span className="text-xl font-bold text-green-600">3</span>
          </div>
          <h4 className="text-lg font-semibold text-gray-800 mb-2">Launch Polls & See Results</h4>
          <p className="text-sm text-gray-500">Create MCQ polls, students answer in real-time, and leaderboard updates instantly.</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 mt-8 flex flex-wrap items-center gap-6">
        <div className="flex-1 min-w-[250px]">
          <h4 className="text-lg font-semibold text-gray-800 mb-2">Built for Interactive Learning</h4>
          <p className="text-sm text-gray-500">
            ClassEngage makes online classes more engaging with live polls during Google Meet sessions.
            Track student participation, see center-wise scores, and make learning fun!
          </p>
        </div>
        <Link to="/sessions" className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg shadow hover:bg-indigo-700 transition">
          Start Teaching
        </Link>
      </div>
    </div>
  );
}
