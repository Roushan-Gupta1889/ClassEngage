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
      expiresAt: Date.now() + 5*60*1000
    };
    await setDoc(doc(db, 'sessions', sessionId), { activePoll: poll }, { merge: true });
    toast.success('Poll launched!');
    setQuestion('');
    setOptions(['','']);
    setCorrectOption(0);
  }

  async function endPoll(){
    await setDoc(doc(db, 'sessions', sessionId), { activePoll: null }, { merge: true });
    toast.success('Poll ended');
  }

  async function endSession(){
    if(!confirm('End session and reset all data?')) return;
    try {
      await updateDoc(doc(db,'sessions', sessionId), { endedAt: serverTimestamp(), activePoll: null, leaderboard: {} });
      toast.success('Session ended');
    } catch(err) {
      console.error('End session error:', err);
      toast.error('Error: ' + err.message);
    }
  }

  return (
    <div className="container">
      {/* Header Card */}
      <div className="card" style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16}}>
        <div>
          <h3 style={{display:'flex', alignItems:'center', gap:12}}>
            Session
            {sessionId && <span className="badge active">Live</span>}
          </h3>
          {sessionId && <p className="small" style={{marginTop:4}}>ID: {sessionId}</p>}
        </div>
        <div className="flex">
          {!sessionId && <button className="btn" onClick={createSession}>Create Session</button>}
          {sessionId && (
            <>
              <button className="btn outline" onClick={() => {navigator.clipboard.writeText(sessionId); toast.success('Session ID copied!')}}>
                Copy ID
              </button>
              <button className="btn danger" onClick={endSession}>End Session</button>
            </>
          )}
        </div>
      </div>

      <div className="grid">
        {/* Create Poll Card */}
        <div className="card">
          <h4>Create Poll</h4>

          {activePoll && (
            <div style={{background:'#fef3c7', padding:12, borderRadius:8, marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <strong>Active Poll:</strong> {activePoll.question}
              </div>
              <button className="btn outline" onClick={endPoll} style={{padding:'6px 12px'}}>End Poll</button>
            </div>
          )}

          <div style={{marginBottom:16}}>
            <label className="small" style={{display:'block', marginBottom:6}}>Question</label>
            <input
              className="input"
              placeholder="Enter your question..."
              value={question}
              onChange={e=>setQuestion(e.target.value)}
            />
          </div>

          <div style={{marginBottom:16}}>
            <label className="small" style={{display:'block', marginBottom:8}}>Options (select correct answer)</label>
            {options.map((o,i)=>(
              <div key={i} className="option-row">
                <input
                  type="radio"
                  name="correctOption"
                  checked={correctOption === i}
                  onChange={() => setCorrectOption(i)}
                  title="Mark as correct"
                />
                <input
                  className="input"
                  placeholder={`Option ${i+1}`}
                  value={o}
                  onChange={e=>setOption(i,e.target.value)}
                  style={{flex:1}}
                />
                {options.length > 2 && (
                  <button className="btn outline" onClick={()=>removeOption(i)} style={{padding:'8px 12px'}}>
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button className="btn outline" onClick={addOption} style={{marginTop:8}}>
              + Add Option
            </button>
          </div>

          <button className="btn success" onClick={launchPoll} style={{width:'100%'}}>
            Launch Poll
          </button>
        </div>

        {/* Leaderboard Card */}
        <div className="card">
          <h4>Live Leaderboard</h4>

          <h5>Top Students</h5>
          {leaderboard.topStudents?.length ? (
            <div>
              {leaderboard.topStudents.map((s,idx)=>(
                <div key={s.id} className="leaderboard-item">
                  <span className="leaderboard-rank">{idx+1}</span>
                  <span className="leaderboard-name">{s.name}</span>
                  <span className="leaderboard-score">{s.score} pts</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{padding:'20px 0'}}>
              <p>No students yet</p>
              <p className="small">Share the session ID with your students</p>
            </div>
          )}

          <h5 style={{marginTop:24}}>Centers</h5>
          {Object.entries(leaderboard.centers||{}).length > 0 ? (
            <div>
              {Object.entries(leaderboard.centers).sort((a,b)=>b[1]-a[1]).map(([c,sc])=>(
                <div key={c} className="center-item">
                  <span>{c}</span>
                  <span>{sc} pts</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="small" style={{textAlign:'center', padding:'12px 0'}}>No center data</p>
          )}
        </div>
      </div>
    </div>
  );
}
