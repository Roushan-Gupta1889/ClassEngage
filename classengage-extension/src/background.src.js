// background.src.js - Trusted writer only (no listeners)
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

chrome.runtime.onInstalled.addListener(() => {
  console.log('ClassEngage extension installed');
});

// Handle messages - writer only
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('BG received:', message.type);

  if (message.type === 'JOIN_SESSION') {
    handleJoinSession(message.data).then(sendResponse);
    return true;
  }

  if (message.type === 'SUBMIT_ANSWER') {
    handleSubmitAnswer(message.data).then(sendResponse);
    return true;
  }

  if (message.type === 'CHECK_SESSION') {
    handleCheckSession(message.data).then(sendResponse);
    return true;
  }

  if (message.type === 'SUBMIT_QUIZ') {
    handleSubmitQuiz(message.data).then(sendResponse);
    return true;
  }

  if (message.type === 'LEAVE_SESSION') {
    handleLeaveSession(message.data).then(sendResponse);
    return true;
  }

  if (message.type === 'PING') {
    sendResponse({ type: 'PONG' });
  }
});

async function handleCheckSession({ sessionId }) {
  try {
    const sessionRef = doc(db, 'sessions', sessionId);
    const snap = await getDoc(sessionRef);
    return { exists: snap.exists() };
  } catch (err) {
    return { exists: false, error: err.message };
  }
}

async function handleJoinSession({ sessionId, student }) {
  try {
    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      return { success: false, error: 'Session not found' };
    }

    // Write student to students subcollection
    const studentRef = doc(db, 'sessions', sessionId, 'students', student.id);
    await setDoc(studentRef, {
      name: student.name,
      center: student.center,
      score: 0,
      joinedAt: serverTimestamp()
    });

    // Record attendance
    const attendanceRef = doc(db, 'sessions', sessionId, 'attendance', student.id);
    await setDoc(attendanceRef, {
      studentId: student.id,
      name: student.name,
      center: student.center,
      joinedAt: serverTimestamp(),
      status: 'present',
      leftAt: null
    });

    return { success: true };
  } catch (err) {
    console.error('Join session error:', err);
    return { success: false, error: err.message };
  }
}

async function handleSubmitAnswer({ sessionId, visibleStudentId, visibleStudentName, center, pollId, answer }) {
  try {
    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      return { success: false, error: 'Session not found' };
    }

    const sessionData = sessionSnap.data();
    const activePoll = sessionData.activePoll;

    if (!activePoll || activePoll.pollId !== pollId) {
      return { success: false, error: 'Poll not active or expired' };
    }

    // Server-side correctness check
    const correctOption = activePoll.correctOption;
    const isCorrect = answer === correctOption;

    // Record response
    await addDoc(collection(db, 'sessions', sessionId, 'responses'), {
      visibleStudentId,
      visibleStudentName,
      center,
      pollId,
      answer,
      isCorrect,
      answeredAt: serverTimestamp()
    });

    // Update score if correct
    if (isCorrect) {
      const studentRef = doc(db, 'sessions', sessionId, 'students', visibleStudentId);
      await updateDoc(studentRef, {
        score: increment(10)
      });

      // Update leaderboard
      await updateLeaderboard(sessionId);
    }

    return { success: true, isCorrect, correctOption };
  } catch (err) {
    console.error('Submit answer error:', err);
    return { success: false, error: err.message };
  }
}

async function handleSubmitQuiz({ sessionId, visibleStudentId, visibleStudentName, center, quizId, answers }) {
  try {
    const sessionRef = doc(db, 'sessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      return { success: false, error: 'Session not found' };
    }

    const sessionData = sessionSnap.data();
    const activeQuiz = sessionData.activeQuiz;

    if (!activeQuiz || activeQuiz.quizId !== quizId) {
      return { success: false, error: 'Quiz not active or expired' };
    }

    // Server-side correctness check for all answers
    let totalScore = 0;
    const results = {};
    let pendingManualGrading = false;

    activeQuiz.questions.forEach(q => {
      const studentAnswer = answers[q.questionId];
      let isCorrect = false;
      let gradingStatus = 'auto';

      // Auto-grade based on question type
      if (q.type === 'text') {
        // Text answers require manual grading
        gradingStatus = 'pending';
        pendingManualGrading = true;
        isCorrect = null; // Will be graded manually
      } else if (q.type === 'true-false' || (q.type === 'mcq' && !q.correctAnswers)) {
        // Single correct answer (True/False or MCQ with single answer)
        isCorrect = studentAnswer === q.correctOption;
      } else if (q.type === 'mcq' && q.correctAnswers && q.correctAnswers.length > 0) {
        // Multiple correct answers
        if (Array.isArray(studentAnswer)) {
          const sortedStudent = [...studentAnswer].sort();
          const sortedCorrect = [...q.correctAnswers].sort();
          isCorrect = sortedStudent.length === sortedCorrect.length &&
                     sortedStudent.every((val, idx) => val === sortedCorrect[idx]);
        } else {
          isCorrect = false;
        }
      }

      // Build result object, only include fields that exist (avoid undefined)
      const resultData = {
        isCorrect,
        studentAnswer,
        gradingStatus,
        type: q.type
      };

      // Only include fields if they have actual defined values (including 0 which is valid)
      if (q.correctOption !== undefined && q.correctOption !== null) {
        resultData.correctOption = q.correctOption;
      }
      if (q.correctAnswers !== undefined && q.correctAnswers !== null && Array.isArray(q.correctAnswers)) {
        resultData.correctAnswers = q.correctAnswers;
      }
      if (q.textAnswer !== undefined && q.textAnswer !== null && q.textAnswer !== '') {
        resultData.textAnswer = q.textAnswer;
      }

      results[q.questionId] = resultData;

      // Only add to score if auto-graded and correct
      if (gradingStatus === 'auto' && isCorrect) {
        totalScore += q.points;
      }
    });

    // Remove any undefined values from results object (extra safety)
    const cleanResults = {};
    Object.keys(results).forEach(qId => {
      const cleanResult = {};
      Object.keys(results[qId]).forEach(key => {
        if (results[qId][key] !== undefined) {
          cleanResult[key] = results[qId][key];
        }
      });
      cleanResults[qId] = cleanResult;
    });

    // Record quiz submission
    await addDoc(collection(db, 'sessions', sessionId, 'quizSubmissions'), {
      visibleStudentId,
      visibleStudentName,
      center,
      quizId,
      answers,
      results: cleanResults,
      totalScore,
      pendingManualGrading,
      gradingStatus: pendingManualGrading ? 'pending' : 'completed',
      submittedAt: serverTimestamp()
    });

    // Update student score
    const studentRef = doc(db, 'sessions', sessionId, 'students', visibleStudentId);
    await updateDoc(studentRef, {
      score: increment(totalScore)
    });

    // Update leaderboard
    await updateLeaderboard(sessionId);

    return { success: true, totalScore, results };
  } catch (err) {
    console.error('Submit quiz error:', err);
    return { success: false, error: err.message };
  }
}

async function handleLeaveSession({ sessionId, studentId }) {
  try {
    if (!sessionId || !studentId) {
      return { success: false, error: 'Missing sessionId or studentId' };
    }

    // Update attendance leftAt time - use setDoc with merge to create if doesn't exist
    const attendanceRef = doc(db, 'sessions', sessionId, 'attendance', studentId);
    await setDoc(attendanceRef, {
      leftAt: serverTimestamp()
    }, { merge: true });

    return { success: true };
  } catch (err) {
    console.error('Leave session error:', err);
    return { success: false, error: err.message };
  }
}

async function updateLeaderboard(sessionId) {
  try {
    const { getDocs, query, orderBy, limit } = await import('firebase/firestore');

    const studentsRef = collection(db, 'sessions', sessionId, 'students');
    const q = query(studentsRef, orderBy('score', 'desc'), limit(10));
    const studentsSnap = await getDocs(q);

    const topStudents = [];
    const centers = {};

    studentsSnap.forEach(docSnap => {
      const s = docSnap.data();
      topStudents.push({ id: docSnap.id, name: s.name, center: s.center, score: s.score || 0 });
      centers[s.center] = (centers[s.center] || 0) + (s.score || 0);
    });

    const sessionRef = doc(db, 'sessions', sessionId);
    await updateDoc(sessionRef, {
      leaderboard: { topStudents: topStudents.slice(0, 3), centers }
    });
  } catch (err) {
    console.error('Update leaderboard error:', err);
  }
}
