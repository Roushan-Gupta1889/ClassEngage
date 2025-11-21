const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * Trigger: onCreate response
 * Path: /sessions/{sessionId}/responses/{pollId}/answers/{studentId}
 *
 * Logic:
 * 1. Read session doc and activePoll
 * 2. Validate response timing and fields
 * 3. Compute points (compare answer with activePoll.correctOption)
 * 4. Transaction:
 *    - update or create sessions/{sessionId}/students/{studentId} with new score
 *    - recompute leaderboard (read students collection, sort, write leaderboad in session doc)
 *
 * Note: For large classes optimize by maintaining incremental counters or using Cloud Tasks.
 */
exports.onResponseCreate = onDocumentCreated(
  'sessions/{sessionId}/responses/{pollId}/answers/{studentId}',
  async (event) => {
    const snap = event.data;
    const { sessionId, pollId, studentId } = event.params;
    const resp = snap.data();
    if (!resp) return null;

    // basic server-side validation
    if (!resp.name || !resp.center || resp.submittedAt == null || resp.answer == null) {
      console.warn(`Invalid response doc ${snap.id} for session ${sessionId}`);
      return null;
    }

    try {
      const sessionRef = db.collection('sessions').doc(sessionId);
      const sessionSnap = await sessionRef.get();
      if (!sessionSnap.exists) {
        console.warn('Session not found', sessionId);
        return null;
      }

      const session = sessionSnap.data();
      const activePoll = session.activePoll || null;
      if (!activePoll || activePoll.pollId !== pollId) {
        console.warn('No active poll or poll mismatch', { sessionId, pollId });
        return null;
      }

      // If poll has expiresAt and response submitted after expiry, ignore
      if (activePoll.expiresAt && resp.submittedAt.toMillis) {
        // submittedAt might be a Firestore Timestamp object (server-translated by client),
        // but when using Firestore triggers admin sdk returns a Timestamp object with toMillis()
        const submittedMillis = resp.submittedAt.toMillis ? resp.submittedAt.toMillis() : new Date(resp.submittedAt).getTime();
        if (activePoll.expiresAt._seconds) {
          // admin admin timestamp format
          const expiresMillis = activePoll.expiresAt._seconds * 1000 + (activePoll.expiresAt._nanoseconds || 0)/1000000;
          if (submittedMillis > expiresMillis) {
            console.warn('Late response ignored', { submittedMillis, expiresMillis });
            return null;
          }
        } else if (typeof activePoll.expiresAt === 'number') {
          if (submittedMillis > activePoll.expiresAt) {
            console.warn('Late response ignored (numeric expiresAt)');
            return null;
          }
        }
      }

      // Determine points: default points = activePoll.points or 5 if correct, 0 else
      let points = 0;
      // activePoll.correctOption may be stored as index or value — handle both
      const correctOption = activePoll.correctOption;
      const answer = resp.answer;

      if (correctOption !== undefined && correctOption !== null) {
        // If correctOption is index (number), compare to answerIndex or answer value accordingly
        if (typeof correctOption === 'number' && typeof answer === 'number') {
          if (answer === correctOption) points = activePoll.points || 5;
        } else {
          // string comparison (case-insensitive)
          if (String(answer).trim().toLowerCase() === String(correctOption).trim().toLowerCase()) {
            points = activePoll.points || 5;
          }
        }
      } else {
        // No correctOption defined (e.g., open answer). Instructor may award points manually later.
        points = 0;
      }

      // Transactionally update student's score and recompute leaderboard
      await db.runTransaction(async (tx) => {
        const studentRef = sessionRef.collection('students').doc(studentId);

        // ALL READS FIRST
        const studentSnap = await tx.get(studentRef);
        const studentsSnap = await tx.get(sessionRef.collection('students'));

        // Calculate new score
        let newScore = points;
        if (studentSnap.exists) {
          const cur = studentSnap.data();
          newScore = (cur.score || 0) + points;
        }

        // Build students list for leaderboard
        const students = [];
        studentsSnap.forEach(s => students.push({ id: s.id, ...s.data() }));
        const idx = students.findIndex(s => s.id === studentId);
        if (idx !== -1) {
          students[idx].score = newScore;
        } else {
          students.push({ id: studentId, name: resp.name, center: resp.center, score: newScore });
        }

        // Sort and take top N
        students.sort((a,b) => (b.score || 0) - (a.score || 0));
        const topStudents = students.slice(0, 20);

        // Centers aggregation
        const centers = {};
        students.forEach(s => {
          const c = s.center || 'Unknown';
          centers[c] = (centers[c] || 0) + (s.score || 0);
        });

        // ALL WRITES AFTER READS
        tx.set(studentRef, { name: resp.name, center: resp.center, score: newScore }, { merge: true });
        tx.set(sessionRef, { leaderboard: { topStudents, centers } }, { merge: true });
      });

      console.log(`Processed response for session ${sessionId}, student ${studentId}, +${points} points`);
    } catch (err) {
      console.error('Error in onResponseCreate', err);
      throw err;
    }

    return null;
  }
);
