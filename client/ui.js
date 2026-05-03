/**
 * ui.js — Civic-Flow UI Controller
 * Manages timeline interaction, scroll-based SVG progress, side panel,
 * question rendering, settings modal, and accessibility features.
 */

(() => {
  'use strict';

  // ── State ────────────────────────────────────────────────
  let sessionId = null;
  let currentState = 'NOVICE';
  let currentScore = 0;
  let totalCorrect = 0;
  let totalQuestions = 0;
  let activeTopic = null;
  let selectedAnswer = null;
  let currentCorrectIndex = null;
  const visitedNodes = new Set();

  // ── DOM Refs ─────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const nodeButtons = document.querySelectorAll('.node-button');
  const svgProgress = $('#svg-progress');
  const panelOverlay = $('#panel-overlay');
  const sidePanel = $('#side-panel');
  const panelTopic = $('#panel-topic');
  const panelExplanation = $('#panel-explanation');
  const questionContainer = $('#question-container');
  const btnSubmit = $('#btn-submit');
  const btnNext = $('#btn-next');
  const panelClose = $('#panel-close');
  const modalOverlay = $('#modal-overlay');
  const btnSettings = $('#btn-settings');
  const btnSaveKey = $('#btn-save-key');
  const btnClearKey = $('#btn-clear-key');
  const btnCloseModal = $('#btn-close-modal');
  const apiKeyInput = $('#api-key-input');
  const stateBadge = $('#state-badge');
  const hudScore = $('#hud-score');
  const hudCorrect = $('#hud-correct');
  const hudState = $('#hud-state');

  // ── Sample Questions per Topic ───────────────────────────
  const QUESTIONS = {
    'Voter Registration': [
      { q: 'What is the minimum age to register to vote in most U.S. states?', opts: ['16', '17', '18', '21'], correct: 2 },
      { q: 'Which federal law established the National Voter Registration Act?', opts: ['Voting Rights Act 1965', 'Motor Voter Act 1993', 'Help America Vote Act 2002', 'Civil Rights Act 1964'], correct: 1 },
    ],
    'Primaries': [
      { q: 'What type of primary allows any registered voter to participate regardless of party?', opts: ['Closed primary', 'Open primary', 'Blanket primary', 'Runoff primary'], correct: 1 },
      { q: 'What is a caucus?', opts: ['A type of ballot', 'A local party meeting to select candidates', 'A debate format', 'An electoral college session'], correct: 1 },
    ],
    'Campaigning': [
      { q: 'Which body regulates federal campaign finance?', opts: ['FCC', 'FEC', 'SEC', 'FTC'], correct: 1 },
      { q: 'What is a "Super PAC"?', opts: ['A candidate fund', 'An independent expenditure-only committee', 'A government grant', 'A party committee'], correct: 1 },
    ],
    'Election Day': [
      { q: 'On which day is the U.S. general election traditionally held?', opts: ['First Monday in November', 'First Tuesday after the first Monday in November', 'Last Tuesday in October', 'Second Wednesday in November'], correct: 1 },
      { q: 'What is an absentee ballot?', opts: ['A provisional ballot', 'A ballot cast before Election Day by mail', 'A digital ballot', 'A ballot for overseas military only'], correct: 1 },
    ],
    'Certification': [
      { q: 'Which body certifies the presidential election results?', opts: ['The Supreme Court', 'The Senate alone', 'Congress in a joint session', 'The FEC'], correct: 2 },
      { q: 'When does the Electoral College typically cast their votes?', opts: ['Election Night', 'First Monday after the second Wednesday in December', 'January 6', 'Inauguration Day'], correct: 1 },
    ],
  };

  // ── SVG Scroll Progress ──────────────────────────────────
  function updateScrollProgress() {
    const timeline = $('#timeline');
    const rect = timeline.getBoundingClientRect();
    const windowH = window.innerHeight;
    const timelineTop = rect.top + window.scrollY;
    const timelineH = rect.height;
    const scrolled = window.scrollY + windowH * 0.5 - timelineTop;
    const pct = Math.max(0, Math.min(1, scrolled / timelineH));
    const totalLen = timelineH;
    svgProgress.style.strokeDasharray = totalLen;
    svgProgress.style.strokeDashoffset = totalLen * (1 - pct);
  }
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', updateScrollProgress, { passive: true });

  // ── HUD Update ───────────────────────────────────────────
  function updateHUD() {
    hudScore.textContent = currentScore.toFixed(2);
    hudCorrect.textContent = `${totalCorrect}/${totalQuestions}`;
    const stateLabels = { NOVICE: 'Novice', INFORMED: 'Informed', POLICY_WONK: 'Policy Wonk' };
    const label = stateLabels[currentState] || currentState;
    hudState.textContent = label;
    stateBadge.textContent = label;
  }

  // ── Panel Open / Close ───────────────────────────────────
  function openPanel(topic) {
    activeTopic = topic;
    panelTopic.textContent = topic;
    panelExplanation.textContent = '';
    panelExplanation.classList.add('loading');
    panelExplanation.innerHTML = 'Generating explanation <span class="loader-dots"><span></span><span></span><span></span></span>';
    questionContainer.innerHTML = '';
    btnSubmit.disabled = true;
    selectedAnswer = null;

    panelOverlay.classList.add('open');
    sidePanel.classList.add('open');
    sidePanel.setAttribute('aria-hidden', 'false');
    panelOverlay.setAttribute('aria-hidden', 'false');

    // Trap focus into panel
    setTimeout(() => panelClose.focus(), 400);

    loadExplanation(topic);
  }

  function closePanel() {
    panelOverlay.classList.remove('open');
    sidePanel.classList.remove('open');
    sidePanel.setAttribute('aria-hidden', 'true');
    panelOverlay.setAttribute('aria-hidden', 'true');
    // Return focus to the active node
    const activeBtn = document.querySelector(`.node-button[data-topic="${activeTopic}"]`);
    if (activeBtn) activeBtn.focus();
  }

  // ── Load AI Explanation ──────────────────────────────────
  async function loadExplanation(topic) {
    try {
      // Start session
      const session = await CivicAPI.startSession(topic, sessionId);
      sessionId = session.sessionId;
      currentState = session.state;
      currentScore = session.score;
      updateHUD();

      // Get AI explanation
      const result = await CivicAPI.explain(topic, currentState);
      panelExplanation.classList.remove('loading');
      panelExplanation.textContent = result.explanation;

      // Render question
      renderQuestion(topic);
    } catch (err) {
      panelExplanation.classList.remove('loading');
      panelExplanation.textContent = `Error: ${err.message}. Please check your API key in Settings.`;
    }
  }

  // ── Render Question ──────────────────────────────────────
  function renderQuestion(topic) {
    const pool = QUESTIONS[topic];
    if (!pool || pool.length === 0) return;
    const qData = pool[Math.floor(Math.random() * pool.length)];
    currentCorrectIndex = qData.correct;
    selectedAnswer = null;
    btnSubmit.disabled = true;

    questionContainer.innerHTML = `
      <div class="question-card">
        <h3>${qData.q}</h3>
        <div class="answer-options" role="radiogroup" aria-label="Answer choices">
          ${qData.opts.map((opt, i) => `
            <button class="answer-option" data-index="${i}" role="radio" aria-checked="false">
              <span class="answer-marker">${String.fromCharCode(65 + i)}</span>
              <span>${opt}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    questionContainer.querySelectorAll('.answer-option').forEach((btn) => {
      btn.addEventListener('click', () => selectAnswer(btn));
    });
  }

  // ── Answer Selection ─────────────────────────────────────
  function selectAnswer(btn) {
    // Deselect all
    questionContainer.querySelectorAll('.answer-option').forEach((b) => {
      b.classList.remove('selected');
      b.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('selected');
    btn.setAttribute('aria-checked', 'true');
    selectedAnswer = parseInt(btn.dataset.index, 10);
    btnSubmit.disabled = false;
  }

  // ── Submit Answer ────────────────────────────────────────
  async function submitAnswer() {
    if (selectedAnswer === null) return;
    const isCorrect = selectedAnswer === currentCorrectIndex;

    // Visual feedback
    questionContainer.querySelectorAll('.answer-option').forEach((btn) => {
      const idx = parseInt(btn.dataset.index, 10);
      btn.disabled = true;
      if (idx === currentCorrectIndex) btn.classList.add('correct');
      else if (idx === selectedAnswer && !isCorrect) btn.classList.add('incorrect');
    });
    btnSubmit.disabled = true;

    try {
      const result = await CivicAPI.submitAnswer(sessionId, isCorrect, activeTopic);
      currentScore = result.score;
      currentState = result.state;
      totalCorrect = result.totalCorrect;
      totalQuestions = result.totalQuestions;
      updateHUD();

      // Mark node as visited
      const nodeIdx = Array.from(nodeButtons).findIndex(
        (b) => b.dataset.topic === activeTopic
      );
      if (nodeIdx >= 0) {
        visitedNodes.add(nodeIdx);
        nodeButtons[nodeIdx].classList.add('visited');
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
  }

  // ── Next Concept ─────────────────────────────────────────
  function nextConcept() {
    if (!activeTopic) return;
    const topics = ['Voter Registration', 'Primaries', 'Campaigning', 'Election Day', 'Certification'];
    const currentIdx = topics.indexOf(activeTopic);
    const nextIdx = (currentIdx + 1) % topics.length;
    const nextTopic = topics[nextIdx];

    // Highlight next node
    nodeButtons.forEach((b) => b.classList.remove('active'));
    nodeButtons[nextIdx].classList.add('active');

    openPanel(nextTopic);
  }

  // ── Settings Modal ───────────────────────────────────────
  function openSettings() {
    modalOverlay.classList.add('open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    updateKeyStatus();
    setTimeout(() => apiKeyInput.focus(), 350);
  }

  function closeSettings() {
    modalOverlay.classList.remove('open');
    modalOverlay.setAttribute('aria-hidden', 'true');
    btnSettings.focus();
  }

  function updateKeyStatus() {
    const dot = $('#key-dot');
    const text = $('#key-status-text');
    if (CivicAPI.hasCustomKey()) {
      dot.classList.remove('inactive');
      dot.classList.add('active');
      text.textContent = 'Custom key active — using your key';
    } else {
      dot.classList.remove('active');
      dot.classList.add('inactive');
      text.textContent = 'No custom key set — using server default';
    }
  }

  function saveKey() {
    const val = apiKeyInput.value;
    if (CivicAPI.setApiKey(val)) {
      apiKeyInput.value = '';
      updateKeyStatus();
      closeSettings();
    }
  }

  function clearKey() {
    CivicAPI.clearApiKey();
    apiKeyInput.value = '';
    updateKeyStatus();
  }

  // ── Keyboard Handling (Escape to close) ──────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalOverlay.classList.contains('open')) closeSettings();
      else if (sidePanel.classList.contains('open')) closePanel();
    }
  });

  // ── Event Bindings ───────────────────────────────────────
  nodeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      nodeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      openPanel(btn.dataset.topic);
    });
  });

  panelClose.addEventListener('click', closePanel);
  panelOverlay.addEventListener('click', closePanel);
  btnSubmit.addEventListener('click', submitAnswer);
  btnNext.addEventListener('click', nextConcept);
  btnSettings.addEventListener('click', openSettings);
  btnSaveKey.addEventListener('click', saveKey);
  btnClearKey.addEventListener('click', clearKey);
  btnCloseModal.addEventListener('click', closeSettings);

  // ── Init ─────────────────────────────────────────────────
  updateHUD();
  setTimeout(updateScrollProgress, 100);
})();
