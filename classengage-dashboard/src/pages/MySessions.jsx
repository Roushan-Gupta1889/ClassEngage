// src/pages/MySessions.jsx
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

  // subscribe to sessions created by current user (or show all for demo)
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
        meetId: null,
        activePoll: null,
        leaderboard: {}
      });
      // navigate to session page
      navigate(`/sessions/${docRef.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to create session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>My Sessions</h1>
        <p className="muted">Create and manage live polls for Google Meet</p>
      </div>

      <div className="actions-row">
        <button className="btn primary" onClick={createSession} disabled={loading}>
          {loading ? "Creating…" : "Create Session"}
        </button>
        <Link to="/" className="link">Back to home</Link>
      </div>

      <div style={{marginTop:20}}>
        <h3>Your recent sessions</h3>
        {sessions.length === 0 ? (
          <div className="card small">No sessions found — create one to get started.</div>
        ) : (
          sessions.map(s => (
            <div key={s.id} className="session-row card">
              <div>
                <div className="session-title">Session: <strong>{s.id}</strong></div>
                <div className="small">Meet: {s.meetId || <em>Not connected</em>}</div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <Link className="btn" to={`/sessions/${s.id}`}>Open</Link>
                <a className="btn outline" href={`https://console.firebase.google.com/project/${process.env.REACT_APP_FIREBASE_PROJECT}/firestore/data/~2Fsessions~2F${s.id}`} target="_blank" rel="noreferrer">Inspect</a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
