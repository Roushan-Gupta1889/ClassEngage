// Test script to simulate student response
// Run: node test-response.js <sessionId> <pollId>

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp, connectFirestoreEmulator } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAj3k-qbsM0T_LJwMQe1vxwFcs6QwtaA6U",
  authDomain: "chrome-extension-941e2.firebaseapp.com",
  projectId: "chrome-extension-941e2",
  storageBucket: "chrome-extension-941e2.firebasestorage.app",
  messagingSenderId: "276498498422",
  appId: "1:276498498422:web:ff1b8c1f7b597dcbe8a8a6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Uncomment to use emulator
// connectFirestoreEmulator(db, 'localhost', 8081);

async function submitTestResponse(sessionId, pollId) {
  const studentId = 'test_student_' + Date.now();

  const response = {
    name: 'Test Student',
    center: 'Delhi',
    answer: 0,  // Change this to test different answers
    submittedAt: serverTimestamp()
  };

  const path = `sessions/${sessionId}/responses/${pollId}/answers/${studentId}`;
  console.log('Writing to:', path);
  console.log('Data:', response);

  await setDoc(doc(db, 'sessions', sessionId, 'responses', pollId, 'answers', studentId), response);
  console.log('✅ Response submitted! Check dashboard for leaderboard update.');
  process.exit(0);
}

// Get args
const sessionId = process.argv[2];
const pollId = process.argv[3];

if (!sessionId || !pollId) {
  console.log('Usage: node test-response.js <sessionId> <pollId>');
  console.log('Example: node test-response.js abc123 poll_1234567890');
  process.exit(1);
}

submitTestResponse(sessionId, pollId);
