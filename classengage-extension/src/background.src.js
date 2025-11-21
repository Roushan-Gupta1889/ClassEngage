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

    activeQuiz.questions.forEach(q => {
      const studentAnswer = answers[q.questionId];
      const isCorrect = studentAnswer === q.correctOption;
      results[q.questionId] = {
        isCorrect,
        correctOption: q.correctOption,
        studentAnswer
      };
      if (isCorrect) {
        totalScore += q.points;
      }
    });

    // Record quiz submission
    await addDoc(collection(db, 'sessions', sessionId, 'quizSubmissions'), {
      visibleStudentId,
      visibleStudentName,
      center,
      quizId,
      answers,
      results,
      totalScore,
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
