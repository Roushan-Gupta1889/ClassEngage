// contentScript.src.js — bundled with Firebase SDK
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

(function () {
  if (window.__classEngageInjected) return;
  window.__classEngageInjected = true;

  // Inject animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes popIn {
      0% { transform: scale(0.5); opacity: 0; }
      70% { transform: scale(1.1); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-8px); }
      40% { transform: translateX(8px); }
      60% { transform: translateX(-6px); }
      80% { transform: translateX(6px); }
    }
  `;
  document.head.appendChild(style);

  // State
  let currentStudent = null;
  let currentSessionId = null;
  let currentPoll = null;
  let selectedAnswer = null;
  let hasAnsweredCurrentPoll = false;
  let unsubscribe = null;

  const el = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };

  // Base container
  const container = el('div', 'ce-overlay');
  container.id = 'classengage-overlay';

  Object.assign(container.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    left: 'auto',
    width: '320px',
    zIndex: '2147483647',
    pointerEvents: 'auto',
    display: 'block',
    background: 'rgba(255,255,255,0.98)',
    borderRadius: '12px',
    boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
    border: '1px solid #E3E3EE',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif'
  });

  container.innerHTML = `
    <div class="ce-panel" style="padding:12px;">
      <div class="ce-top" style="display:flex;justify-content:space-between;align-items:center;">
        <div class="ce-title" style="font-weight:600;font-size:16px;">ClassEngage</div>
        <div style="display:flex;gap:4px;">
          <button class="ce-refresh" title="Refresh" style="background:#F2F2F6;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;">↻</button>
          <button class="ce-collapse" title="Collapse" style="background:#F2F2F6;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:14px;">−</button>
        </div>
      </div>

      <div class="ce-status" style="font-size:11px;color:#6F6F78;margin:4px 0 8px;"></div>

      <div class="ce-tabs" style="display:flex;gap:8px;padding:8px 0;">
        <button class="ce-tab ce-tab-active" data-tab="polls" style="padding:6px 12px;border-radius:8px;background:#6C5CE7;color:#fff;font-weight:600;border:none;cursor:pointer;">Polls</button>
        <button class="ce-tab" data-tab="leader" style="padding:6px 12px;border-radius:8px;background:transparent;border:none;color:#6F6F78;cursor:pointer;">Leaderboard</button>
      </div>

      <div class="ce-body" style="padding:6px 0;">
        <div class="ce-join">
          <div style="margin-bottom:8px;font-weight:600;">Join Session</div>
          <input id="ce-session-id" placeholder="Session ID (from teacher)" style="width:100%;padding:8px;margin-bottom:8px;border-radius:8px;border:1px solid #e6e6ee;box-sizing:border-box;" />
          <input id="ce-name" placeholder="Your name" style="width:100%;padding:8px;margin-bottom:8px;border-radius:8px;border:1px solid #e6e6ee;box-sizing:border-box;" />
          <input id="ce-center" placeholder="Your center (e.g., Pune)" style="width:100%;padding:8px;margin-bottom:8px;border-radius:8px;border:1px solid #e6e6ee;box-sizing:border-box;" />
          <button id="ce-join-btn" style="width:100%;background:#6C5CE7;color:white;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:600;">Join Session</button>
          <div id="ce-join-error" style="color:#e74c3c;font-size:12px;margin-top:8px;display:none;"></div>
        </div>

        <div class="ce-content ce-content-polls" style="display:none;">
          <div class="ce-hello" style="margin-bottom:8px;font-weight:500;"></div>
          <div class="ce-poll-container">
            <div class="ce-question" style="font-weight:600;margin-bottom:12px;">No active poll</div>
            <div class="ce-options" style="display:none;"></div>
            <button class="ce-submit" style="display:none;width:100%;background:#6C5CE7;color:white;border:none;padding:10px;border-radius:8px;cursor:pointer;font-weight:600;margin-top:12px;">Submit Answer</button>
            <div class="ce-poll-result" style="display:none;padding:12px;border-radius:8px;margin-top:12px;text-align:center;font-weight:600;"></div>
          </div>
        </div>

        <div class="ce-content ce-content-leader" style="display:none;">
          <div class="ce-top3-title" style="font-weight:600;margin-bottom:8px;">Top Students</div>
          <ol class="ce-top3" style="padding-left:20px;margin:0 0 16px;"></ol>
          <div class="ce-centers-title" style="font-weight:600;margin-bottom:8px;">Centers</div>
          <div class="ce-centers"></div>
        </div>
      </div>

      <div class="ce-footer" style="padding-top:8px;font-size:11px;color:#6F6F78;border-top:1px solid #F1F1F6;margin-top:8px;display:flex;justify-content:space-between;align-items:center;">
        <span class="ce-session-info"></span>
        <button id="ce-leave-btn" style="display:none;background:#f2f2f6;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:11px;color:#e74c3c;">Leave</button>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // DOM references
  const statusEl = container.querySelector('.ce-status');
  const joinForm = container.querySelector('.ce-join');
  const sessionInput = container.querySelector('#ce-session-id');
  const nameInput = container.querySelector('#ce-name');
  const centerInput = container.querySelector('#ce-center');
  const joinBtn = container.querySelector('#ce-join-btn');
  const joinError = container.querySelector('#ce-join-error');
  const pollsContent = container.querySelector('.ce-content-polls');
  const leaderContent = container.querySelector('.ce-content-leader');
  const helloEl = container.querySelector('.ce-hello');
  const questionEl = container.querySelector('.ce-question');
  const optionsEl = container.querySelector('.ce-options');
  const submitBtn = container.querySelector('.ce-submit');
  const pollResultEl = container.querySelector('.ce-poll-result');
  const top3El = container.querySelector('.ce-top3');
  const leaveBtn = container.querySelector('#ce-leave-btn');
  const refreshBtn = container.querySelector('.ce-refresh');
  const centersEl = container.querySelector('.ce-centers');
  const sessionInfoEl = container.querySelector('.ce-session-info');

  function showError(msg) {
    joinError.textContent = msg;
    joinError.style.display = 'block';
  }

  function hideError() {
    joinError.style.display = 'none';
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  // chrome.storage.local helpers
  async function saveState() {
    if (currentStudent && currentSessionId) {
      await chrome.storage.local.set({
        classengage_state: { student: currentStudent, sessionId: currentSessionId }
      });
    }
  }

  async function loadState() {
    const result = await chrome.storage.local.get('classengage_state');
    return result.classengage_state || null;
  }

  async function clearState() {
    await chrome.storage.local.remove('classengage_state');
  }

  // Tab switching
  const tabs = container.querySelectorAll('.ce-tab');
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(x => {
        x.classList.remove('ce-tab-active');
        x.style.background = 'transparent';
        x.style.color = '#6F6F78';
      });
      t.classList.add('ce-tab-active');
      t.style.background = '#6C5CE7';
      t.style.color = '#fff';

      const tab = t.dataset.tab;
      pollsContent.style.display = 'none';
      leaderContent.style.display = 'none';

      if (currentStudent) {
        if (tab === 'polls') pollsContent.style.display = 'block';
        else leaderContent.style.display = 'block';
      }
    });
  });

  // Collapse
  const collapseBtn = container.querySelector('.ce-collapse');
  let collapsed = false;
  collapseBtn.addEventListener('click', () => {
    const panel = container.querySelector('.ce-panel');
    collapsed = !collapsed;
    collapseBtn.textContent = collapsed ? '+' : '−';
    panel.querySelector('.ce-body').style.display = collapsed ? 'none' : '';
    panel.querySelector('.ce-tabs').style.display = collapsed ? 'none' : '';
    panel.querySelector('.ce-footer').style.display = collapsed ? 'none' : '';
    panel.querySelector('.ce-status').style.display = collapsed ? 'none' : '';
  });

  // Drag
  (function makeDraggable(node) {
    let down = false, off = { x: 0, y: 0 };
    const header = node.querySelector('.ce-top');
    header.style.cursor = 'move';
    header.addEventListener('mousedown', e => {
      if (e.target === collapseBtn) return;
      down = true;
      off.x = node.offsetLeft - e.clientX;
      off.y = node.offsetTop - e.clientY;
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mouseup', () => { down = false; document.body.style.userSelect = ''; });
    document.addEventListener('mousemove', e => {
      if (!down) return;
      node.style.left = Math.max(8, Math.min(window.innerWidth - 340, e.clientX + off.x)) + 'px';
      node.style.top = Math.max(8, Math.min(window.innerHeight - 120, e.clientY + off.y)) + 'px';
    });
  })(container);

  // Start Firestore listener (in content script)
  function startSessionListener(sessionId) {
    if (unsubscribe) unsubscribe();

    const sessionRef = doc(db, 'sessions', sessionId);
    unsubscribe = onSnapshot(sessionRef, (snap) => {
      if (!snap.exists()) {
        setStatus('Session ended');
        return;
      }
      const data = snap.data();
      renderPoll(data.activePoll || null);
      renderLeaderboard(data.leaderboard || { topStudents: [], centers: {} });
    }, (err) => {
      console.error('Firestore listener error:', err);
      setStatus('Connection error');
    });
  }

  // Join session
  joinBtn.addEventListener('click', async () => {
    hideError();
    const sessionId = sessionInput.value.trim();
    const name = nameInput.value.trim();
    const center = centerInput.value.trim() || 'Unknown';

    if (!sessionId) { showError('Please enter Session ID'); return; }
    if (!name) { showError('Please enter your name'); return; }

    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining...';

    const student = {
      id: 'student_' + Math.random().toString(36).slice(2, 9),
      name,
      center,
      score: 0
    };

    try {
      // Ask background to write student to Firestore
      const response = await chrome.runtime.sendMessage({
        type: 'JOIN_SESSION',
        data: { sessionId, student }
      });

      if (response.success) {
        currentStudent = student;
        currentSessionId = sessionId;
        await saveState();
        showJoinedState();
        startSessionListener(sessionId);
        setStatus('Connected');
      } else {
        showError(response.error || 'Failed to join session');
      }
    } catch (err) {
      showError('Connection error: ' + err.message);
    }

    joinBtn.disabled = false;
    joinBtn.textContent = 'Join Session';
  });

  function showJoinedState() {
    joinForm.style.display = 'none';
    pollsContent.style.display = 'block';
    leaveBtn.style.display = 'inline-block';
    helloEl.textContent = `Hello, ${currentStudent.name} (${currentStudent.center})`;
    sessionInfoEl.textContent = `Session: ${currentSessionId.slice(0, 8)}...`;
  }

  async function leaveSession() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    currentStudent = null;
    currentSessionId = null;
    currentPoll = null;
    selectedAnswer = null;
    hasAnsweredCurrentPoll = false;
    await clearState();

    joinForm.style.display = 'block';
    pollsContent.style.display = 'none';
    leaderContent.style.display = 'none';
    leaveBtn.style.display = 'none';
    sessionInfoEl.textContent = '';
    setStatus('');
  }

  leaveBtn.addEventListener('click', leaveSession);

  refreshBtn.addEventListener('click', () => {
    if (currentSessionId) {
      refreshBtn.style.transform = 'rotate(360deg)';
      refreshBtn.style.transition = 'transform 0.5s';
      setTimeout(() => { refreshBtn.style.transform = ''; refreshBtn.style.transition = ''; }, 500);
      startSessionListener(currentSessionId);
      setStatus('Refreshed');
    }
  });

  // Render poll
  function renderPoll(poll) {
    if (!poll) {
      questionEl.textContent = 'No active poll';
      optionsEl.style.display = 'none';
      submitBtn.style.display = 'none';
      pollResultEl.style.display = 'none';
      return;
    }

    if (!currentPoll || currentPoll.pollId !== poll.pollId) {
      currentPoll = poll;
      selectedAnswer = null;
      hasAnsweredCurrentPoll = false;
      pollResultEl.style.display = 'none';
    }

    questionEl.textContent = poll.question;
    optionsEl.innerHTML = '';
    optionsEl.style.display = 'block';

    poll.options.forEach((opt, i) => {
      const optDiv = document.createElement('div');
      optDiv.style.cssText = 'padding:10px;margin:6px 0;border-radius:8px;border:2px solid #e6e6ee;cursor:pointer;transition:all 0.2s;';
      optDiv.textContent = opt;
      optDiv.dataset.index = i;

      if (selectedAnswer === i) {
        optDiv.style.borderColor = '#6C5CE7';
        optDiv.style.background = '#F0EEFF';
      }

      if (!hasAnsweredCurrentPoll) {
        optDiv.addEventListener('click', () => {
          selectedAnswer = i;
          renderPoll(currentPoll);
        });
        optDiv.addEventListener('mouseenter', () => {
          if (selectedAnswer !== i) optDiv.style.borderColor = '#A8A0F0';
        });
        optDiv.addEventListener('mouseleave', () => {
          if (selectedAnswer !== i) optDiv.style.borderColor = '#e6e6ee';
        });
      } else {
        optDiv.style.cursor = 'default';
      }

      optionsEl.appendChild(optDiv);
    });

    submitBtn.style.display = hasAnsweredCurrentPoll ? 'none' : 'block';
  }

  // Submit answer - server validates correctness
  submitBtn.addEventListener('click', async () => {
    if (selectedAnswer === null || !currentPoll || hasAnsweredCurrentPoll) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      // Send to background - server will compute correctness
      const response = await chrome.runtime.sendMessage({
        type: 'SUBMIT_ANSWER',
        data: {
          sessionId: currentSessionId,
          visibleStudentId: currentStudent.id,
          visibleStudentName: currentStudent.name,
          center: currentStudent.center,
          pollId: currentPoll.pollId,
          answer: selectedAnswer
          // No isCorrect - server computes this
        }
      });

      hasAnsweredCurrentPoll = true;

      if (response.success) {
        pollResultEl.style.animation = 'none';
        pollResultEl.offsetHeight; // trigger reflow
        if (response.isCorrect) {
          currentStudent.score += 10;
          pollResultEl.style.background = '#D4EDDA';
          pollResultEl.style.color = '#155724';
          pollResultEl.innerHTML = '<span style="font-size:24px;">✓</span><br>Correct! +10 points';
          pollResultEl.style.animation = 'popIn 0.4s ease, pulse 0.6s ease 0.4s';
        } else {
          pollResultEl.style.background = '#F8D7DA';
          pollResultEl.style.color = '#721C24';
          pollResultEl.innerHTML = `<span style="font-size:24px;">✗</span><br>Wrong! Correct: ${currentPoll.options[response.correctOption]}`;
          pollResultEl.style.animation = 'shake 0.5s ease';
        }
        pollResultEl.style.display = 'block';
        submitBtn.style.display = 'none';
        optionsEl.style.display = 'none';
        questionEl.textContent = 'Poll submitted';
      } else {
        showError(response.error || 'Submit failed');
      }
    } catch (err) {
      console.error('Submit error:', err);
      if (err.message?.includes('Extension context invalidated')) {
        pollResultEl.style.background = '#FFF3CD';
        pollResultEl.style.color = '#856404';
        pollResultEl.textContent = 'Extension updated. Please refresh the page.';
        pollResultEl.style.display = 'block';
      }
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Answer';
  });

  // Render leaderboard
  function renderLeaderboard(leaderboard) {
    top3El.innerHTML = '';
    centersEl.innerHTML = '';

    const students = leaderboard.topStudents || [];
    if (students.length === 0) {
      top3El.innerHTML = '<li style="color:#6F6F78;">No scores yet</li>';
    } else {
      students.forEach((s) => {
        const li = document.createElement('li');
        li.style.cssText = 'padding:4px 0;';
        li.innerHTML = `<strong>${s.name}</strong> (${s.center}) — ${s.score} pts`;
        top3El.appendChild(li);
      });
    }

    const centers = leaderboard.centers || {};
    const centerEntries = Object.entries(centers).sort((a, b) => b[1] - a[1]);
    if (centerEntries.length === 0) {
      centersEl.innerHTML = '<div style="color:#6F6F78;">No data</div>';
    } else {
      centerEntries.forEach(([c, score]) => {
        const d = document.createElement('div');
        d.style.cssText = 'padding:4px 8px;margin:4px 0;background:#F8F8FC;border-radius:6px;display:flex;justify-content:space-between;';
        d.innerHTML = `<span>${c}</span><span>${score} pts</span>`;
        centersEl.appendChild(d);
      });
    }
  }

  // Initialize - restore state
  (async function init() {
    const savedState = await loadState();
    if (savedState && savedState.student && savedState.sessionId) {
      currentStudent = savedState.student;
      currentSessionId = savedState.sessionId;
      showJoinedState();
      setStatus('Reconnecting...');

      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_SESSION',
        data: { sessionId: currentSessionId }
      });

      if (response.exists) {
        startSessionListener(currentSessionId);
        setStatus('Connected');
      } else {
        setStatus('Session ended');
        await clearState();
        joinForm.style.display = 'block';
        pollsContent.style.display = 'none';
      }
    }
  })();

  console.log('ClassEngage content script loaded (bundled)');
})();
