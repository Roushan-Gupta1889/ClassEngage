import { useEffect, useState } from "react";
import { useAuth } from "../firebase/AuthProvider";
import { db } from "../firebase/init";
import { collection, addDoc, doc, setDoc, serverTimestamp, onSnapshot, updateDoc } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { useToast } from "../components/Toast";

export default function SessionPage(){
  const { sessionId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [sessionDoc, setSessionDoc] = useState(null);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['','']);
  const [correctOption, setCorrectOption] = useState(0);
  const [activePoll, setActivePoll] = useState(null);
  const [leaderboard, setLeaderboard] = useState({ topStudents: [], centers: {} });

  useEffect(()=> {
    if(!sessionId) return;
    const sref = doc(db, 'sessions', sessionId);
    const unsub = onSnapshot(sref, snap => {
      if(!snap.exists()) return;
      setSessionDoc({ id: snap.id, ...snap.data()});
      setActivePoll(snap.data().activePoll || null);
      setLeaderboard(snap.data().leaderboard || { topStudents: [], centers: {}});
    });
    return unsub;
  }, [sessionId]);

  async function createSession() {
    if(!user) return toast.error('Please login first');
    const docRef = await addDoc(collection(db, 'sessions'), {
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      activePoll: null,
      leaderboard: {}
    });
    window.location.href = `/sessions/${docRef.id}`;
  }

  function setOption(i, val){
    const copy = [...options]; copy[i]=val; setOptions(copy);
  }
  function addOption(){ setOptions([...options, '']); }
  function removeOption(i){ setOptions(options.filter((_,idx)=>idx!==i)); }

  async function launchPoll(){
    if(!sessionId) return toast.error('Create session first');
    if(!question.trim()) return toast.error('Please enter a question');
    const validOptions = options.filter(Boolean);
    if(validOptions.length < 2) return toast.error('Add at least 2 options');
    const poll = {
      pollId: 'poll_' + Date.now(),
      question,
      options: options.filter(Boolean),
      correctOption: correctOption,
      type: 'mcq',
      createdAt: Date.now(),
      expiresAt: Date.now() + 5*60*1000 // default 5 minutes
    };
    await setDoc(doc(db, 'sessions', sessionId), { activePoll: poll }, { merge: true });
    toast.success('Poll launched');
  }

  async function endSession(){
    if(!confirm('End session and reset data?')) return;
    try {
      await updateDoc(doc(db,'sessions', sessionId), { endedAt: serverTimestamp(), activePoll: null, leaderboard: {} });
      toast.success('Session ended');
    } catch(err) {
      console.error('End session error:', err);
      toast.error('Error: ' + err.message);
    }
  }

  return (
    <div>
      <div className="card">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <h3>Session: {sessionId || '(new)'}</h3>
          {!sessionId && <button className="btn" onClick={createSession}>Create Session</button>}
          {sessionId && <button className="btn" onClick={() => {navigator.clipboard.writeText(sessionId); toast.success('Session ID copied!')}}>Copy Session ID</button>}
          {sessionId && <button className="btn" onClick={endSession}>End Session</button>}
        </div>
        {sessionDoc && <div className="small">Instructor: {sessionDoc.createdBy}</div>}
      </div>

      <div className="grid">
        <div className="card">
          <h4>Create Poll</h4>
          <div style={{marginBottom:8}}>
            <input className="input" placeholder="Question" value={question} onChange={e=>setQuestion(e.target.value)} />
          </div>
          <div>
            <div className="small" style={{marginBottom:8}}>Select correct answer:</div>
            {options.map((o,i)=>(
              <div key={i} style={{display:'flex',gap:8,marginBottom:8,alignItems:'center'}}>
                <input
                  type="radio"
                  name="correctOption"
                  checked={correctOption === i}
                  onChange={() => setCorrectOption(i)}
                  title="Mark as correct"
                />
                <input className="input" placeholder={`Option ${i+1}`} value={o} onChange={e=>setOption(i,e.target.value)} />
                <button className="btn" onClick={()=>removeOption(i)}>Remove</button>
              </div>
            ))}
            <button className="btn" onClick={addOption}>Add option</button>
          </div>
          <div style={{marginTop:12}}>
            <button className="btn" onClick={launchPoll}>Launch Poll</button>
          </div>
        </div>

        <div className="card">
          <h4>Live Leaderboard</h4>
          <div>
            <h5>Top Students</h5>
            {leaderboard.topStudents?.length ? leaderboard.topStudents.map((s,idx)=>(
              <div key={s.id} className="session-card" style={{marginBottom:8}}>
                <div>{idx+1}. {s.name}</div>
                <div>{s.score}</div>
              </div>
            )) : <div className="small">No data yet</div>}
          </div>
          <div style={{marginTop:12}}>
            <h5>Centers</h5>
            {Object.entries(leaderboard.centers||{}).map(([c,sc])=>(
              <div key={c} className="small">{c} — {sc}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
