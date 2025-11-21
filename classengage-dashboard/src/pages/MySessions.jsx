import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/init";
import { useAuth } from "../firebase/AuthProvider";
import { useToast } from "../components/Toast";

export default function MySessions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }
    const q = query(
      collection(db, "sessions"),
      where("createdBy", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      const items = [];
      snap.forEach(d => items.push({ id: d.id, ...d.data() }));
      setSessions(items);
    }, err => {
      console.error('sessions listen error', err);
    });
    return () => unsub();
  }, [user]);

  async function createSession() {
    if (!user) return toast.error("Please sign in first");
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, "sessions"), {
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        activePoll: null,
        leaderboard: {}
      });
      navigate(`/sessions/${docRef.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to create session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Sessions</h1>
          <p className="text-sm text-gray-500">Create and manage your live poll sessions</p>
        </div>
        <button
          onClick={createSession}
          disabled={loading}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition font-medium disabled:opacity-50"
        >
          {loading ? "Creating..." : "+ New Session"}
        </button>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-md border border-gray-100 text-center">
          <div className="text-5xl mb-4 opacity-30">📋</div>
          <h4 className="text-lg font-semibold text-gray-800 mb-2">No sessions yet</h4>
          <p className="text-sm text-gray-500 mb-6">Create your first session to start engaging with students</p>
          <button onClick={createSession} className="px-6 py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition font-medium">
            Create Session
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800">Session</span>
                  {s.activePoll ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">Live Poll</span>
                  ) : s.endedAt ? (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">Ended</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">No active poll</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">ID: {s.id}</p>
              </div>
              <Link
                to={`/sessions/${s.id}`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm"
              >
                Open
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
