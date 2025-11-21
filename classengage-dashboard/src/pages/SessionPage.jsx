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
  const [mode, setMode] = useState('poll'); // 'poll' or 'quiz'

  // Poll state
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [correctOption, setCorrectOption] = useState(0);
  const [activePoll, setActivePoll] = useState(null);

  // Quiz state
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDuration, setQuizDuration] = useState(300);
  const [quizQuestions, setQuizQuestions] = useState([{
    question: '',
    type: 'mcq', // 'mcq', 'true-false', 'text'
    options: ['', ''],
    correctOption: 0,
    correctAnswers: [], // For multiple correct answers in MCQ
    textAnswer: '', // For text type questions
    points: 10
  }]);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizTimeRemaining, setQuizTimeRemaining] = useState(0);
  const [quizResults, setQuizResults] = useState([]);
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [showGradingInterface, setShowGradingInterface] = useState(false);
  const [currentGradingSubmission, setCurrentGradingSubmission] = useState(null);
  const [manualGrades, setManualGrades] = useState({});

  // Attendance state
  const [attendance, setAttendance] = useState([]);
  const [showAttendance, setShowAttendance] = useState(false);

  const [leaderboard, setLeaderboard] = useState({ topStudents: [], centers: {} });

  useEffect(() => {
    if (!sessionId) return;
    const sref = doc(db, 'sessions', sessionId);
    const unsub = onSnapshot(sref, snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      setSessionDoc({ id: snap.id, ...data });
      setActivePoll(data.activePoll || null);
      setActiveQuiz(data.activeQuiz || null);
      setLeaderboard(data.leaderboard || { topStudents: [], centers: {} });

      // Start quiz timer
      if (data.activeQuiz && data.activeQuiz.duration) {
        const elapsed = Math.floor((Date.now() - data.activeQuiz.createdAt) / 1000);
        const remaining = Math.max(0, data.activeQuiz.duration - elapsed);
        setQuizTimeRemaining(remaining);
      }
    });
    return unsub;
  }, [sessionId]);

  // Quiz timer countdown and auto-close
  useEffect(() => {
    if (!activeQuiz || !activeQuiz.duration || quizTimeRemaining <= 0) return;

    const interval = setInterval(() => {
      setQuizTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          endQuiz(); // Auto-close when timer ends
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeQuiz, quizTimeRemaining]);

  async function createSession() {
    if (!user) return toast.error('Please login first');
    const docRef = await addDoc(collection(db, 'sessions'), {
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      activePoll: null,
      activeQuiz: null,
      leaderboard: {}
    });
    window.location.href = `/sessions/${docRef.id}`;
  }

  // Poll functions
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

  // Quiz functions
  function updateQuizQuestion(qIdx, field, value) {
    setQuizQuestions(qs => qs.map((q, i) => i === qIdx ? { ...q, [field]: value } : q));
  }

  function updateQuizOption(qIdx, optIdx, value) {
    setQuizQuestions(qs => qs.map((q, i) =>
      i === qIdx ? { ...q, options: q.options.map((opt, j) => j === optIdx ? value : opt) } : q
    ));
  }

  function addQuizOption(qIdx) {
    setQuizQuestions(qs => qs.map((q, i) =>
      i === qIdx ? { ...q, options: [...q.options, ''] } : q
    ));
  }

  function removeQuizOption(qIdx, optIdx) {
    setQuizQuestions(qs => qs.map((q, i) => {
      if (i !== qIdx) return q;
      if (q.options.length <= 2) return q;
      const newOpts = q.options.filter((_, j) => j !== optIdx);
      return { ...q, options: newOpts, correctOption: q.correctOption >= newOpts.length ? 0 : q.correctOption };
    }));
  }

  function toggleCorrectAnswer(qIdx, optIdx) {
    setQuizQuestions(qs => qs.map((q, i) => {
      if (i !== qIdx) return q;
      const newCorrectAnswers = q.correctAnswers.includes(optIdx)
        ? q.correctAnswers.filter(idx => idx !== optIdx)
        : [...q.correctAnswers, optIdx];
      return { ...q, correctAnswers: newCorrectAnswers };
    }));
  }

  function changeQuestionType(qIdx, newType) {
    setQuizQuestions(qs => qs.map((q, i) => {
      if (i !== qIdx) return q;
      if (newType === 'true-false') {
        return { ...q, type: newType, options: ['True', 'False'], correctOption: 0, correctAnswers: [] };
      } else if (newType === 'text') {
        return { ...q, type: newType, options: [], correctOption: 0, correctAnswers: [], textAnswer: '' };
      } else {
        return { ...q, type: newType, options: q.options.length === 0 ? ['', ''] : q.options, correctAnswers: [] };
      }
    }));
  }

  function addQuizQuestion() {
    setQuizQuestions(qs => [...qs, { question: '', type: 'mcq', options: ['', ''], correctOption: 0, correctAnswers: [], textAnswer: '', points: 10 }]);
  }

  function removeQuizQuestion(qIdx) {
    if (quizQuestions.length <= 1) return;
    setQuizQuestions(qs => qs.filter((_, i) => i !== qIdx));
  }

  async function launchQuiz() {
    if (!sessionId) return toast.error('Create session first');
    if (!quizTitle.trim()) return toast.error('Please enter quiz title');

    const validQuestions = quizQuestions.filter(q => {
      if (!q.question.trim()) return false;
      if (q.type === 'mcq' || q.type === 'true-false') {
        return q.options.filter(Boolean).length >= 2;
      }
      if (q.type === 'text') {
        return q.textAnswer.trim(); // Text questions need an answer
      }
      return false;
    });
    if (validQuestions.length === 0) return toast.error('Add at least 1 valid question');

    const quiz = {
      quizId: 'quiz_' + Date.now(),
      title: quizTitle,
      questions: validQuestions.map((q, i) => {
        const questionData = {
          questionId: `q${i + 1}`,
          question: q.question,
          type: q.type,
          points: q.points || 10,
          requiresManualGrading: q.type === 'text'
        };

        // Only include fields that have values (avoid undefined)
        if (q.type !== 'text') {
          questionData.options = q.options.filter(Boolean);
        }

        if (q.type === 'mcq') {
          if (q.correctAnswers && q.correctAnswers.length > 0) {
            questionData.correctAnswers = q.correctAnswers;
          } else {
            questionData.correctOption = q.correctOption;
          }
        } else if (q.type === 'true-false') {
          questionData.options = q.options;
          questionData.correctOption = q.correctOption;
        } else if (q.type === 'text') {
          questionData.textAnswer = q.textAnswer;
        }

        return questionData;
      }),
      duration: quizDuration || null,
      createdAt: Date.now(),
      status: 'active'
    };

    await setDoc(doc(db, 'sessions', sessionId), { activeQuiz: quiz }, { merge: true });
    toast.success('Quiz launched!');

    // Reset form
    setQuizTitle('');
    setQuizDuration(300);
    setQuizQuestions([{ question: '', type: 'mcq', options: ['', ''], correctOption: 0, correctAnswers: [], textAnswer: '', points: 10 }]);
  }

  async function endQuiz() {
    if (!sessionId || !activeQuiz) return;

    // Fetch quiz results before ending
    await fetchQuizResults(activeQuiz.quizId);

    await setDoc(doc(db, 'sessions', sessionId), { activeQuiz: null }, { merge: true });
    toast.success('Quiz ended');
    setShowQuizResults(true);
  }

  async function fetchQuizResults(quizId) {
    try {
      const { getDocs, query, where } = await import('firebase/firestore');
      const submissionsRef = collection(db, 'sessions', sessionId, 'quizSubmissions');
      const q = query(submissionsRef, where('quizId', '==', quizId));
      const snap = await getDocs(q);

      const results = [];
      snap.forEach(docSnap => {
        results.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Sort client-side to avoid index requirement
      results.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

      setQuizResults(results);
    } catch (err) {
      console.error('Fetch quiz results error:', err);
      toast.error('Failed to fetch results');
    }
  }

  function exportQuizResultsCSV() {
    if (quizResults.length === 0) {
      toast.error('No results to export');
      return;
    }

    const headers = ['Rank', 'Name', 'Center', 'Score', 'Submitted At'];
    const rows = quizResults.map((r, i) => [
      i + 1,
      r.visibleStudentName,
      r.center,
      r.totalScore,
      r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleString() : 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-results-${sessionId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Results exported!');
  }

  async function fetchAttendance() {
    if (!sessionId) return;
    try {
      const { getDocs } = await import('firebase/firestore');
      const attendanceRef = collection(db, 'sessions', sessionId, 'attendance');
      const snap = await getDocs(attendanceRef);

      const records = [];
      snap.forEach(docSnap => {
        records.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Sort by join time
      records.sort((a, b) => {
        const aTime = a.joinedAt?.seconds || 0;
        const bTime = b.joinedAt?.seconds || 0;
        return bTime - aTime;
      });

      setAttendance(records);
      setShowAttendance(true);
      toast.success(`Attendance loaded! ${records.length} student${records.length !== 1 ? 's' : ''} recorded. Scroll down to view and export.`);
    } catch (err) {
      console.error('Fetch attendance error:', err);
      toast.error('Failed to fetch attendance');
    }
  }

  function exportAttendanceCSV() {
    if (attendance.length === 0) {
      toast.error('No attendance records to export');
      return;
    }

    const headers = ['Name', 'Center', 'Status', 'Joined At', 'Left At', 'Duration (min)'];
    const rows = attendance.map(record => {
      const joinedAt = record.joinedAt ? new Date(record.joinedAt.seconds * 1000) : null;
      const leftAt = record.leftAt ? new Date(record.leftAt.seconds * 1000) : null;

      let duration = 'N/A';
      if (joinedAt && leftAt) {
        duration = Math.round((leftAt - joinedAt) / 60000);
      } else if (joinedAt) {
        duration = 'Still present';
      }

      return [
        record.name,
        record.center,
        record.status,
        joinedAt ? joinedAt.toLocaleString() : 'N/A',
        leftAt ? leftAt.toLocaleString() : 'Still present',
        duration
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${sessionId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Attendance exported!');
  }

  function openGradingInterface(submission) {
    // Initialize manual grades from existing results
    const grades = {};
    Object.entries(submission.results).forEach(([qId, result]) => {
      if (result.gradingStatus === 'pending') {
        grades[qId] = {
          points: 0,
          feedback: ''
        };
      }
    });
    setManualGrades(grades);
    setCurrentGradingSubmission(submission);
    setShowGradingInterface(true);
  }

  async function saveManualGrades() {
    if (!currentGradingSubmission) return;

    try {
      const { doc: firestoreDoc, updateDoc, getDoc, increment } = await import('firebase/firestore');

      // Calculate additional points from manual grading
      let additionalPoints = 0;
      Object.values(manualGrades).forEach(grade => {
        additionalPoints += grade.points || 0;
      });

      // Update quiz submission with manual grades
      const submissionRef = firestoreDoc(db, 'sessions', sessionId, 'quizSubmissions', currentGradingSubmission.id);
      const updatedResults = { ...currentGradingSubmission.results };

      Object.entries(manualGrades).forEach(([qId, grade]) => {
        updatedResults[qId] = {
          ...updatedResults[qId],
          gradingStatus: 'completed',
          manualPoints: grade.points,
          feedback: grade.feedback,
          isCorrect: grade.points > 0
        };
      });

      await updateDoc(submissionRef, {
        results: updatedResults,
        totalScore: currentGradingSubmission.totalScore + additionalPoints,
        gradingStatus: 'completed',
        pendingManualGrading: false
      });

      // Update student score
      const studentRef = firestoreDoc(db, 'sessions', sessionId, 'students', currentGradingSubmission.visibleStudentId);
      await updateDoc(studentRef, {
        score: increment(additionalPoints)
      });

      // Update leaderboard (reuse existing function from background)
      // We'll need to refetch quiz results to show updated scores
      await fetchQuizResults(currentGradingSubmission.quizId);

      toast.success(`Graded! +${additionalPoints} points added to ${currentGradingSubmission.visibleStudentName}`);
      setShowGradingInterface(false);
      setCurrentGradingSubmission(null);
    } catch (err) {
      console.error('Save manual grades error:', err);
      toast.error('Failed to save grades');
    }
  }

  async function endSession() {
    if (!confirm('End session and reset all data?')) return;
    try {
      await updateDoc(doc(db, 'sessions', sessionId), { endedAt: serverTimestamp(), activePoll: null, activeQuiz: null, leaderboard: {} });
      toast.success('Session ended');
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  }

  const responseCount = leaderboard.topStudents?.reduce((sum, s) => sum + (s.score || 0), 0) / 10 || 0;

  return (
    <div className="p-6">
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Session + Creator */}
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
                    <button onClick={fetchAttendance} className="px-4 py-2 bg-green-50 text-green-600 border border-green-100 rounded-lg hover:bg-green-100 transition">
                      📋 Attendance
                    </button>
                    <button onClick={endSession} className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition">
                      End Session
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
            <div className="flex items-center gap-4 mb-6 border-b border-gray-200">
              <button
                onClick={() => setMode('poll')}
                className={`pb-3 px-2 font-medium transition border-b-2 ${mode === 'poll' ? 'text-indigo-600 border-indigo-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
              >
                Quick Poll
              </button>
              <button
                onClick={() => setMode('quiz')}
                className={`pb-3 px-2 font-medium transition border-b-2 ${mode === 'quiz' ? 'text-indigo-600 border-indigo-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
              >
                Quiz
              </button>
            </div>

            {/* Poll Mode */}
            {mode === 'poll' && (
              <>
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
              </>
            )}

            {/* Quiz Mode */}
            {mode === 'quiz' && (
              <>
                {activeQuiz && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-100 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium text-green-800">Active: {activeQuiz.title}</div>
                        <div className="text-sm text-green-600">{activeQuiz.questions?.length} questions</div>
                      </div>
                      <button onClick={endQuiz} className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition">
                        End Quiz
                      </button>
                    </div>
                    {activeQuiz.duration && quizTimeRemaining > 0 && (
                      <div className={`text-sm font-semibold ${quizTimeRemaining < 30 ? 'text-red-600' : 'text-green-700'}`}>
                        ⏱ Time Remaining: {Math.floor(quizTimeRemaining / 60)}:{(quizTimeRemaining % 60).toString().padStart(2, '0')}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      placeholder="Quiz Title"
                      className="border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition"
                    />
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">Duration (seconds)</label>
                      <input
                        type="number"
                        value={quizDuration}
                        onChange={(e) => setQuizDuration(Number(e.target.value))}
                        placeholder="300"
                        className="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition"
                      />
                    </div>
                  </div>

                  {quizQuestions.map((q, qIdx) => (
                    <div key={qIdx} className="p-4 border border-gray-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-700">Question {qIdx + 1}</h4>
                        {quizQuestions.length > 1 && (
                          <button onClick={() => removeQuizQuestion(qIdx)} className="text-sm text-red-500 hover:text-red-700">
                            Remove
                          </button>
                        )}
                      </div>

                      {/* Question Type Selector */}
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600 font-medium">Type:</label>
                        <select
                          value={q.type}
                          onChange={(e) => changeQuestionType(qIdx, e.target.value)}
                          className="border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
                        >
                          <option value="mcq">Multiple Choice (MCQ)</option>
                          <option value="true-false">True/False</option>
                          <option value="text">Text Answer</option>
                        </select>
                      </div>

                      <input
                        value={q.question}
                        onChange={(e) => updateQuizQuestion(qIdx, 'question', e.target.value)}
                        placeholder="Enter question"
                        className="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition"
                      />

                      {/* MCQ Options */}
                      {q.type === 'mcq' && (
                        <>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={q.correctAnswers.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  updateQuizQuestion(qIdx, 'correctAnswers', [q.correctOption]);
                                } else {
                                  updateQuizQuestion(qIdx, 'correctAnswers', []);
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <label className="font-medium">Allow multiple correct answers</label>
                          </div>

                          <div className="space-y-2">
                            {q.options.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-3">
                                {q.correctAnswers.length > 0 ? (
                                  <input
                                    type="checkbox"
                                    checked={q.correctAnswers.includes(optIdx)}
                                    onChange={() => toggleCorrectAnswer(qIdx, optIdx)}
                                    className="w-4 h-4 text-indigo-600"
                                  />
                                ) : (
                                  <input
                                    type="radio"
                                    name={`correct-q${qIdx}`}
                                    checked={q.correctOption === optIdx}
                                    onChange={() => updateQuizQuestion(qIdx, 'correctOption', optIdx)}
                                    className="w-4 h-4 text-indigo-600"
                                  />
                                )}
                                <input
                                  value={opt}
                                  onChange={(e) => updateQuizOption(qIdx, optIdx, e.target.value)}
                                  placeholder={`Option ${optIdx + 1}`}
                                  className="flex-1 border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition text-sm"
                                />
                                {q.options.length > 2 && (
                                  <button onClick={() => removeQuizOption(qIdx, optIdx)} className="text-sm text-red-500 hover:text-red-700">
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                            <button onClick={() => addQuizOption(qIdx)} className="text-sm px-3 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition">
                              + Add option
                            </button>
                          </div>
                        </>
                      )}

                      {/* True/False Options */}
                      {q.type === 'true-false' && (
                        <div className="space-y-2">
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-3">
                              <input
                                type="radio"
                                name={`correct-q${qIdx}`}
                                checked={q.correctOption === optIdx}
                                onChange={() => updateQuizQuestion(qIdx, 'correctOption', optIdx)}
                                className="w-4 h-4 text-indigo-600"
                              />
                              <span className="flex-1 border border-gray-200 rounded-lg p-2 bg-gray-50 text-sm font-medium text-gray-700">
                                {opt}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Text Answer */}
                      {q.type === 'text' && (
                        <div className="space-y-2">
                          <label className="text-sm text-gray-600 font-medium">Correct Answer (for reference):</label>
                          <textarea
                            value={q.textAnswer}
                            onChange={(e) => updateQuizQuestion(qIdx, 'textAnswer', e.target.value)}
                            placeholder="Enter the correct answer or acceptable keywords..."
                            rows="3"
                            className="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition text-sm"
                          />
                          <p className="text-xs text-amber-600">⚠️ Text answers require manual grading</p>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600">Points:</label>
                        <input
                          type="number"
                          value={q.points}
                          onChange={(e) => updateQuizQuestion(qIdx, 'points', Number(e.target.value))}
                          className="w-20 border border-gray-200 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
                        />
                      </div>
                    </div>
                  ))}

                  <button onClick={addQuizQuestion} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition">
                    + Add Question
                  </button>

                  <div className="flex items-center gap-3 justify-end pt-4">
                    <button onClick={() => {
                      setQuizTitle('');
                      setQuizDuration(300);
                      setQuizQuestions([{ question: '', type: 'mcq', options: ['', ''], correctOption: 0, correctAnswers: [], textAnswer: '', points: 10 }]);
                    }} className="px-4 py-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition">
                      Reset
                    </button>
                    <button onClick={launchQuiz} className="px-6 py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition font-medium">
                      Launch Quiz
                    </button>
                  </div>
                </div>
              </>
            )}
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

          {/* Quiz Results Modal */}
          {showQuizResults && quizResults.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-semibold text-gray-800">Quiz Results</h4>
                <div className="flex gap-2">
                  <button onClick={exportQuizResultsCSV} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition text-sm">
                    📥 Export CSV
                  </button>
                  <button onClick={() => setShowQuizResults(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition text-sm">
                    Close
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Rank</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Center</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Score</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {quizResults.map((result, i) => (
                      <tr key={result.id} className={i < 3 ? 'bg-yellow-50' : ''}>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${i === 0 ? 'text-yellow-600' : i === 1 ? 'text-gray-500' : i === 2 ? 'text-amber-700' : 'text-gray-700'}`}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">{result.visibleStudentName}</td>
                        <td className="px-4 py-3 text-gray-600">{result.center}</td>
                        <td className="px-4 py-3 text-center">
                          {result.pendingManualGrading ? (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">📝 Pending</span>
                          ) : (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">✓ Complete</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-indigo-600">{result.totalScore}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {result.pendingManualGrading && (
                            <button
                              onClick={() => openGradingInterface(result)}
                              className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-xs font-medium"
                            >
                              Grade
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Attendance Modal */}
          {showAttendance && attendance.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-md font-semibold text-gray-800">Attendance Log</h4>
                  <p className="text-sm text-gray-500">{attendance.length} student{attendance.length !== 1 ? 's' : ''} recorded</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={exportAttendanceCSV} className="px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition text-sm">
                    📥 Export CSV
                  </button>
                  <button onClick={() => setShowAttendance(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition text-sm">
                    Close
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Center</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Joined At</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Left At</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {attendance.map(record => {
                      const joinedAt = record.joinedAt ? new Date(record.joinedAt.seconds * 1000) : null;
                      const leftAt = record.leftAt ? new Date(record.leftAt.seconds * 1000) : null;
                      let duration = 'N/A';
                      if (joinedAt && leftAt) {
                        const durationMin = Math.round((leftAt - joinedAt) / 60000);
                        duration = `${durationMin} min`;
                      } else if (joinedAt) {
                        duration = 'Still present';
                      }

                      return (
                        <tr key={record.id}>
                          <td className="px-4 py-3 font-medium text-gray-800">{record.name}</td>
                          <td className="px-4 py-3 text-gray-600">{record.center}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${record.leftAt ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                              {record.leftAt ? 'Left' : 'Present'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {joinedAt ? joinedAt.toLocaleTimeString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {leftAt ? leftAt.toLocaleTimeString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-700">
                            {duration}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Manual Grading Interface */}
          {showGradingInterface && currentGradingSubmission && (
            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-md font-semibold text-gray-800">Grade Submission</h4>
                  <p className="text-sm text-gray-500">Student: {currentGradingSubmission.visibleStudentName} ({currentGradingSubmission.center})</p>
                </div>
                <button onClick={() => setShowGradingInterface(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition text-sm">
                  Cancel
                </button>
              </div>

              <div className="space-y-4">
                {Object.entries(currentGradingSubmission.results)
                  .filter(([qId, result]) => result.gradingStatus === 'pending')
                  .map(([qId, result]) => {
                    const question = activeQuiz?.questions.find(q => q.questionId === qId);
                    if (!question) return null;

                    return (
                      <div key={qId} className="p-4 border border-gray-200 rounded-xl space-y-3">
                        <div>
                          <h5 className="font-semibold text-gray-800 mb-2">{question.question}</h5>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <p className="text-sm text-gray-600 mb-1">Student Answer:</p>
                            <p className="text-sm text-gray-800 font-medium">{result.studentAnswer || '(No answer)'}</p>
                          </div>
                          {question.textAnswer && (
                            <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <p className="text-sm text-blue-600 mb-1">Reference Answer:</p>
                              <p className="text-sm text-blue-800">{question.textAnswer}</p>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-sm text-gray-600 font-medium block mb-1">Points (Max: {question.points})</label>
                            <input
                              type="number"
                              min="0"
                              max={question.points}
                              value={manualGrades[qId]?.points || 0}
                              onChange={(e) => {
                                const points = Math.min(question.points, Math.max(0, Number(e.target.value)));
                                setManualGrades(prev => ({
                                  ...prev,
                                  [qId]: { ...prev[qId], points }
                                }));
                              }}
                              className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-600 font-medium block mb-1">Feedback (optional)</label>
                            <input
                              type="text"
                              value={manualGrades[qId]?.feedback || ''}
                              onChange={(e) => {
                                setManualGrades(prev => ({
                                  ...prev,
                                  [qId]: { ...prev[qId], feedback: e.target.value }
                                }));
                              }}
                              placeholder="e.g., Good answer!"
                              className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Total Additional Points: <span className="font-bold text-indigo-600">
                      +{Object.values(manualGrades).reduce((sum, g) => sum + (g.points || 0), 0)}
                    </span>
                  </div>
                  <button
                    onClick={saveManualGrades}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition font-medium"
                  >
                    Save Grades
                  </button>
                </div>
              </div>
            </div>
          )}
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
