const inputEl = document.getElementById('utcInput');
const convertBtn = document.getElementById('convertBtn');
const clearBtn = document.getElementById('clearBtn');
const errorBox = document.getElementById('errorBox');
const errorMsg = document.getElementById('errorMsg');
const resultsEl = document.getElementById('results');
const historySection = document.getElementById('historySection');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

const MAX_HISTORY = 8;

function showError(msg) {
  errorMsg.textContent = msg;
  errorBox.hidden = false;
  resultsEl.hidden = true;
}

function hideError() {
  errorBox.hidden = true;
}

function setLoading(loading) {
  const btnText = convertBtn.querySelector('.btn-text');
  const btnSpinner = convertBtn.querySelector('.btn-spinner');
  convertBtn.disabled = loading;
  btnText.hidden = loading;
  btnSpinner.hidden = !loading;
}

function setBadge(el, isDst) {
  el.textContent = isDst ? 'DST ON' : 'STD';
  el.className = 'dst-badge ' + (isDst ? 'on' : 'off');
}

function fillZone(prefix, data) {
  document.getElementById(prefix + 'Time12').textContent = data.time12;
  document.getElementById(prefix + 'Date').textContent = data.datetime.split(' at ')[0];
  document.getElementById(prefix + 'Offset').textContent = `${data.offset} · ${data.abbreviation}`;
  document.getElementById(prefix + 'DstNote').textContent = data.dstNote;
  document.getElementById(prefix + 'Abbr').textContent = data.abbreviation;
  setBadge(document.getElementById(prefix + 'DstBadge'), data.isDst);
}

function renderResults(data) {
  document.getElementById('parsedUtc').textContent = data.inputFormatted;
  fillZone('est', data.eastern);
  fillZone('cst', data.central);

  const banner = document.getElementById('dstTodayBanner');
  const bannerText = document.getElementById('dstTodayText');
  const { eastern, central } = data.currentDstStatus;

  if (eastern && central) {
    bannerText.textContent = 'Today: Both Eastern and Central are observing Daylight Saving Time.';
    banner.className = 'dst-today-banner dst-active';
  } else if (!eastern && !central) {
    bannerText.textContent = "Today: Both Eastern and Central are on Standard Time — DST is not active.";
    banner.className = 'dst-today-banner dst-inactive';
  } else {
    bannerText.textContent = `Today: Eastern is ${eastern ? 'on DST' : 'on Standard Time'}, Central is ${central ? 'on DST' : 'on Standard Time'}.`;
    banner.className = 'dst-today-banner dst-active';
  }

  resultsEl.hidden = false;
  resultsEl.style.animation = 'none';
  void resultsEl.offsetWidth;
  resultsEl.style.animation = '';
}

async function convert() {
  const raw = inputEl.value.trim();
  if (!raw) { showError('Please enter a UTC timestamp.'); return; }

  const input = raw.toLowerCase() === 'now' ? new Date().toISOString() : raw;

  hideError();
  setLoading(true);

  try {
    const res = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utcInput: input }),
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Conversion failed.');
      return;
    }

    renderResults(data);
    saveHistory(raw, data.eastern.time12 + ' ET / ' + data.central.time12 + ' CT');
  } catch {
    showError('Network error — is the server running?');
  } finally {
    setLoading(false);
  }
}

// ── History ──────────────────────────────────────────────────────────
function loadHistory() {
  try { return JSON.parse(localStorage.getItem('utcHistory') || '[]'); }
  catch { return []; }
}

function saveHistory(input, summary) {
  const items = loadHistory().filter(i => i.input !== input);
  items.unshift({ input, summary, ts: Date.now() });
  localStorage.setItem('utcHistory', JSON.stringify(items.slice(0, MAX_HISTORY)));
  renderHistory();
}

function renderHistory() {
  const items = loadHistory();
  if (!items.length) { historySection.hidden = true; return; }

  historySection.hidden = false;
  historyList.innerHTML = '';

  items.forEach(({ input, summary }) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = `<span class="history-input">${escHtml(input)}</span><span class="history-result">${escHtml(summary)}</span>`;
    li.addEventListener('click', () => {
      inputEl.value = input;
      convert();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    historyList.appendChild(li);
  });
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Copy buttons ──────────────────────────────────────────────────────
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;
    navigator.clipboard.writeText(target.textContent.trim()).then(() => {
      btn.classList.add('copied');
      btn.innerHTML = btn.innerHTML.replace('Copy time', 'Copied!');
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = btn.innerHTML.replace('Copied!', 'Copy time');
      }, 1800);
    });
  });
});

// ── Format chips ──────────────────────────────────────────────────────
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    inputEl.value = chip.dataset.sample;
    inputEl.focus();
  });
});

// ── Keyboard shortcut ─────────────────────────────────────────────────
inputEl.addEventListener('keydown', e => {
  if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || (e.key === 'Enter' && !e.shiftKey)) {
    e.preventDefault();
    convert();
  }
});

convertBtn.addEventListener('click', convert);
clearBtn.addEventListener('click', () => { inputEl.value = ''; hideError(); inputEl.focus(); });
clearHistoryBtn.addEventListener('click', () => { localStorage.removeItem('utcHistory'); renderHistory(); });

// ── Init ──────────────────────────────────────────────────────────────
renderHistory();
inputEl.focus();
