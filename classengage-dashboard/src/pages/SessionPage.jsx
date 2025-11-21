import { useEffect, useState } from "react";
import { useAuth } from "../firebase/AuthProvider";
import { db } from "../firebase/init";
import { collection, addDoc, doc, setDoc, serverTimestamp, onSnapshot, updateDoc } from "firebase/firestore";
import { useParams } from "react-router-dom";
import { useToast } from "../components/Toast";

export default function SessionPage() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [sessionDoc, setSessionDoc] = useState(null);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [correctOption, setCorrectOption] = useState(0);
  const [activePoll, setActivePoll] = useState(null);
  const [leaderboard, setLeaderboard] = useState({ topStudents: [], centers: {} });

  useEffect(() => {
    if (!sessionId) return;
    const sref = doc(db, 'sessions', sessionId);
    const unsub = onSnapshot(sref, snap => {
      if (!snap.exists()) return;
      setSessionDoc({ id: snap.id, ...snap.data() });
      setActivePoll(snap.data().activePoll || null);
      setLeaderboard(snap.data().leaderboard || { topStudents: [], centers: {} });
    });
    return unsub;
  }, [sessionId]);

  async function createSession() {
    if (!user) return toast.error('Please login first');
    const docRef = await addDoc(collection(db, 'sessions'), {
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      activePoll: null,
      leaderboard: {}
    });
    window.location.href = `/sessions/${docRef.id}`;
  }

  function updateOption(i, val) {
    setOptions(o => o.map((x, idx) => idx === i ? val : x));
  }
  function addOption() { setOptions(o => [...o, '']); }
  function removeOption(i) {
    if (options.length <= 2) return;
    setOptions(o => o.filter((_, idx) => idx !== i));
    if (correctOption >= options.length - 1) setCorrectOption(0);
  }

  async function launchPoll() {
    if (!sessionId) return toast.error('Create session first');
    if (!question.trim()) return toast.error('Please enter a question');
    const validOptions = options.filter(Boolean);
    if (validOptions.length < 2) return toast.error('Add at least 2 options');
    const poll = {
      pollId: 'poll_' + Date.now(),
      question,
      options: validOptions,
      correctOption,
      type: 'mcq',
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000
    };
    await setDoc(doc(db, 'sessions', sessionId), { activePoll: poll }, { merge: true });
    toast.success('Poll launched!');
    setQuestion('');
    setOptions(['', '']);
    setCorrectOption(0);
  }

  async function endPoll() {
    await setDoc(doc(db, 'sessions', sessionId), { activePoll: null }, { merge: true });
    toast.success('Poll ended');
  }

  async function endSession() {
    if (!confirm('End session and reset all data?')) return;
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { endedAt: serverTimestamp(), activePoll: null, leaderboard: {} });
      toast.success('Session ended');
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  }

  const responseCount = leaderboard.topStudents?.reduce((sum, s) => sum + (s.score || 0), 0) / 10 || 0;

  return (
    <div className="p-6">
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Session + Poll Creator */}
        <section className="lg:col-span-8 space-y-6">
          {/* Session card */}
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-sm text-indigo-600 font-medium">Session</div>
                <h2 className="text-xl font-semibold text-gray-800">{sessionId || '(New Session)'}</h2>
                {sessionDoc && (
                  <div className="mt-1 text-sm text-gray-500">
                    Instructor: <span className="font-medium text-gray-700">{sessionDoc.createdBy?.slice(0, 20)}...</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {!sessionId && (
                  <button onClick={createSession} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition">
                    Create Session
                  </button>
                )}
                {sessionId && (
                  <>
                    <button onClick={() => { navigator.clipboard.writeText(sessionId); toast.success('Copied!'); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition">
                      Copy Session ID
                    </button>
                    <button onClick={endSession} className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition">
                      End Session
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Poll creator */}
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Create Poll</h3>
              {activePoll && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  Poll Active
                </span>
              )}
            </div>

            {activePoll && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-medium text-amber-800">Active: {activePoll.question}</div>
                  <div className="text-sm text-amber-600">{activePoll.options?.length} options</div>
                </div>
                <button onClick={endPoll} className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition">
                  End Poll
                </button>
              </div>
            )}

            <div className="space-y-4">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Enter poll question"
                className="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition"
              />

              <div className="space-y-3">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="correct"
                      checked={correctOption === i}
                      onChange={() => setCorrectOption(i)}
                      className="w-5 h-5 text-indigo-600"
                    />
                    <input
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition"
                    />
                    {options.length > 2 && (
                      <button onClick={() => removeOption(i)} className="text-sm text-red-500 hover:text-red-700 px-3 py-2 transition">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addOption} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition">
                  + Add option
                </button>
              </div>

              <div className="flex items-center gap-3 justify-end pt-4">
                <button onClick={() => { setQuestion(''); setOptions(['', '']); setCorrectOption(0); }} className="px-4 py-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition">
                  Reset
                </button>
                <button onClick={launchPoll} className="px-6 py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition font-medium">
                  Launch Poll
                </button>
              </div>
            </div>
          </div>

          {/* Stats cards */}
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-semibold text-gray-800">Session Stats</h4>
              <div className="text-sm text-gray-500">Live · {new Date().toLocaleTimeString()}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-indigo-50 rounded-xl">
                <div className="text-sm text-gray-600">Total Responses</div>
                <div className="text-2xl font-bold text-indigo-700">{Math.round(responseCount)}</div>
              </div>
              <div className="p-4 bg-green-50 rounded-xl">
                <div className="text-sm text-gray-600">Students</div>
                <div className="text-2xl font-bold text-green-700">{leaderboard.topStudents?.length || 0}</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl">
                <div className="text-sm text-gray-600">Centers</div>
                <div className="text-2xl font-bold text-purple-700">{Object.keys(leaderboard.centers || {}).length}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Leaderboard */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="sticky top-24 space-y-6">
            {/* Leaderboard card */}
            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Live Leaderboard</h3>
              {leaderboard.topStudents?.length > 0 ? (
                <ol className="space-y-3">
                  {leaderboard.topStudents.map((s, i) => (
                    <li key={s.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                          i === 0 ? 'bg-gradient-to-tr from-yellow-400 to-amber-500' :
                          i === 1 ? 'bg-gradient-to-tr from-gray-300 to-gray-400' :
                          i === 2 ? 'bg-gradient-to-tr from-amber-600 to-amber-700' :
                          'bg-gradient-to-tr from-indigo-500 to-purple-500'
                        }`}>
                          {s.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{s.name}</div>
                          <div className="text-sm text-gray-500">{s.center}</div>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-indigo-600">{s.score}</div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">🏆</div>
                  <p>No students yet</p>
                  <p className="text-sm">Share the session ID</p>
                </div>
              )}
            </div>

            {/* Centers summary */}
            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
              <h4 className="text-md font-semibold text-gray-800 mb-3">Centers</h4>
              {Object.entries(leaderboard.centers || {}).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(leaderboard.centers).sort((a, b) => b[1] - a[1]).map(([c, sc]) => (
                    <div key={c} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-700">{c}</div>
                      <div className="text-sm font-semibold text-indigo-600">{sc} pts</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No center data</p>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
