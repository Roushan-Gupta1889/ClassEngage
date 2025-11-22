// popup.js
// Change this to your deployed dashboard URL in production
const DASHBOARD_URL = 'http://localhost:5175'; // TODO: Replace with production URL

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

document.getElementById('startSession').addEventListener('click', async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const active = tabs[0];

  if (!active || !active.url) {
    showToast('Open a Google Meet tab and try again');
    return;
  }

  if (!active.url.includes('meet.google.com')) {
    showToast('Please open a Google Meet tab first');
    return;
  }

  try {
    const url = new URL(active.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const meetId = parts[0] || 'unknown';
    document.getElementById('meetInfo').innerHTML = `Meeting: <strong>${meetId}</strong>`;

    chrome.tabs.create({ url: `${DASHBOARD_URL}/sessions` });
  } catch (err) {
    showToast('Failed to parse Meet URL');
  }
});

document.getElementById('openDashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});
