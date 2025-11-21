import React, { useEffect, useState } from "react";
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
    <div className="container">
      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, flexWrap:'wrap', gap:16}}>
        <div>
          <h1 style={{fontSize:28, fontWeight:700, marginBottom:4}}>My Sessions</h1>
          <p className="small">Create and manage your live poll sessions</p>
        </div>
        <button className="btn" onClick={createSession} disabled={loading}>
          {loading ? "Creating..." : "+ New Session"}
        </button>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="card" style={{textAlign:'center', padding:'48px 24px'}}>
          <div style={{fontSize:48, marginBottom:16, opacity:0.3}}>📋</div>
          <h4 style={{marginBottom:8}}>No sessions yet</h4>
          <p className="small" style={{marginBottom:24}}>Create your first session to start engaging with students</p>
          <button className="btn" onClick={createSession}>Create Session</button>
        </div>
      ) : (
        <div>
          {sessions.map(s => (
            <div key={s.id} className="session-row">
              <div>
                <div className="session-title" style={{display:'flex', alignItems:'center', gap:8}}>
                  Session
                  {s.activePoll ? (
                    <span className="badge active">Live Poll</span>
                  ) : s.endedAt ? (
                    <span className="badge inactive">Ended</span>
                  ) : (
                    <span className="badge inactive">No active poll</span>
                  )}
                </div>
                <p className="small">ID: {s.id}</p>
              </div>
              <div style={{display:'flex', gap:8}}>
                <Link to={`/sessions/${s.id}`} className="btn">
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
