/**
 * ui.js — Civic-Flow UI Controller v2
 * Complete rewrite: guided progression, markdown rendering,
 * satisfying animations, and mock Google Sign-In.
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
  let highestUnlocked = 0; // index of highest unlocked node
  const visitedNodes = new Set();
  const EMOJIS = ['📋', '🗳️', '📢', '🏛️', '✅'];
  const TOPICS = ['Voter Registration', 'Candidate Nomination', 'Campaigning', 'Polling Day', 'Counting & Results'];

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
  const btnUnlockNext = $('#btn-unlock-next');
  const panelClose = $('#panel-close');
  const modalOverlay = $('#modal-overlay');
  const btnSettings = $('#btn-settings');
  const btnSaveKey = $('#btn-save-key');
  const btnClearKey = $('#btn-clear-key');
  const btnCloseModal = $('#btn-close-modal');
  const apiKeyInput = $('#api-key-input');
  const modelSelect = $('#model-select');
  const stateBadge = $('#state-badge');
  const hudScore = $('#hud-score');
  const hudCorrect = $('#hud-correct');
  const hudState = $('#hud-state');
  const onboardingOverlay = $('#onboarding-overlay');
  const btnLoginGoogle = $('#btn-login-google');
  const btnStartGuest = $('#btn-start-guest');
  const onboardingKeyStatus = $('#onboarding-key-status');
  const onboardingModelStatus = $('#onboarding-model-status');
  const onboardingEditSettings = $('#onboarding-edit-settings');
  const navActions = $('#nav-actions');

  // ── Questions ────────────────────────────────────────────
  const QUESTIONS = {
    'Voter Registration': [
      { q: 'What is the minimum age to be eligible for an ECI Voter ID?', opts: ['16', '18', '21', '25'], correct: 1 },
      { q: 'Which form is required to apply for a new Voter ID online in India?', opts: ['Form 6', 'Form 7', 'Form 8', 'Form 12'], correct: 0 },
    ],
    'Candidate Nomination': [
      { q: 'What is the minimum age required to contest a Lok Sabha election?', opts: ['21', '25', '30', '35'], correct: 1 },
      { q: 'To whom does a candidate submit their nomination papers?', opts: ['Chief Election Commissioner', 'District Magistrate (Returning Officer)', 'State Governor', 'Chief Minister'], correct: 1 },
    ],
    'Campaigning': [
      { q: 'What does the Model Code of Conduct (MCC) do?', opts: ['Forces candidates to wear uniforms', 'Sets rules for ethical campaigning and government behavior', 'Limits the number of voters per booth', 'Dictates who can vote'], correct: 1 },
      { q: 'When must all public campaigning end before polling day?', opts: ['12 hours before', '24 hours before', '48 hours before', '72 hours before'], correct: 2 },
    ],
    'Polling Day': [
      { q: 'What does VVPAT stand for?', opts: ['Voter Verified Paper Audit Trail', 'Visual Voting Pattern Assessment Tool', 'Valid Vote Processing And Testing', 'Voice Verified Polling Audit Trail'], correct: 0 },
      { q: 'How many votes can one EVM (Electronic Voting Machine) record maximum?', opts: ['1000', '2000', '3840', '5000'], correct: 2 },
    ],
    'Counting & Results': [
      { q: 'Who issues the final Certificate of Election to the winning candidate?', opts: ['The President', 'The Chief Justice', 'The Returning Officer', 'The Prime Minister'], correct: 2 },
      { q: 'What happens if the "NOTA" (None Of The Above) option gets the highest votes?', opts: ['Fresh elections are held immediately', 'The candidate with the second-highest votes is declared the winner', 'The constituency is left unrepresented', 'The Governor appoints a representative'], correct: 1 },
    ],
  };

  // ── SVG Scroll Progress ──────────────────────────────────
  function updateScrollProgress() {
    const timeline = $('#timeline');
    if (!timeline) return;
    const rect = timeline.getBoundingClientRect();
    const windowH = window.innerHeight;
    const timelineTop = rect.top + window.scrollY;
    const timelineH = rect.height;
    const scrolled = window.scrollY + windowH * 0.5 - timelineTop;
    const pct = Math.max(0, Math.min(1, scrolled / timelineH));
    svgProgress.style.strokeDasharray = timelineH;
    svgProgress.style.strokeDashoffset = timelineH * (1 - pct);
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
    panelExplanation.innerHTML = '';
    panelExplanation.classList.add('loading');
    panelExplanation.innerHTML = 'Generating explanation <span class="loader-dots"><span></span><span></span><span></span></span>';
    questionContainer.innerHTML = '';
    btnSubmit.disabled = true;
    btnNext.style.display = 'block';
    btnUnlockNext.style.display = 'none';
    selectedAnswer = null;

    panelOverlay.classList.add('open');
    sidePanel.classList.add('open');
    sidePanel.setAttribute('aria-hidden', 'false');
    panelOverlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => panelClose.focus(), 400);
    loadExplanation(topic);
  }

  function closePanel() {
    panelOverlay.classList.remove('open');
    sidePanel.classList.remove('open');
    sidePanel.setAttribute('aria-hidden', 'true');
    panelOverlay.setAttribute('aria-hidden', 'true');
    const activeBtn = document.querySelector(`.node-button[data-topic="${activeTopic}"]`);
    if (activeBtn) activeBtn.focus();
  }

  // ── Load AI Explanation ──────────────────────────────────
  async function loadExplanation(topic) {
    try {
      const session = await CivicAPI.startSession(topic, sessionId);
      sessionId = session.sessionId;
      currentState = session.state;
      currentScore = session.score;
      updateHUD();

      const result = await CivicAPI.explain(topic, currentState);
      panelExplanation.classList.remove('loading');

      // Parse markdown properly
      if (typeof marked !== 'undefined' && marked.parse) {
        panelExplanation.innerHTML = marked.parse(result.explanation || '');
      } else {
        panelExplanation.textContent = result.explanation || '';
      }

      renderQuestion(topic);
    } catch (err) {
      panelExplanation.classList.remove('loading');
      panelExplanation.innerHTML = `<p style="color:var(--danger)">⚠ ${err.message}</p><p style="color:var(--text-muted);font-size:0.85rem;">Check your API key in Settings, or try a different model.</p>`;
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
        <h3>🧠 Test Your Knowledge</h3>
        <p style="font-size:0.88rem;color:var(--text-secondary);margin-bottom:14px;">${qData.q}</p>
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

  function selectAnswer(btn) {
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

      const nodeIdx = TOPICS.indexOf(activeTopic);
      if (nodeIdx >= 0) {
        visitedNodes.add(nodeIdx);
        nodeButtons[nodeIdx].classList.remove('active');
        nodeButtons[nodeIdx].classList.add('visited');

        // Show "Unlock Next Phase" if there's a next locked node
        if (nodeIdx < nodeButtons.length - 1 && nodeIdx >= highestUnlocked) {
          btnNext.style.display = 'none';
          btnUnlockNext.style.display = 'flex';
        }
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
  }

  // ── Unlock Next Phase ────────────────────────────────────
  function unlockNextPhase() {
    const currentIdx = TOPICS.indexOf(activeTopic);
    const nextIdx = currentIdx + 1;
    if (nextIdx >= TOPICS.length) return;

    const nextBtn = nodeButtons[nextIdx];
    const nextNode = nextBtn.closest('.timeline-node');

    // Unlock with animation
    nextBtn.disabled = false;
    nextBtn.textContent = EMOJIS[nextIdx];
    nextNode.classList.remove('locked');
    nextNode.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    nextNode.style.opacity = '1';
    highestUnlocked = nextIdx;

    closePanel();

    // Auto-scroll and auto-open
    setTimeout(() => {
      nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        nodeButtons.forEach((b) => b.classList.remove('active'));
        nextBtn.classList.add('active');
        openPanel(TOPICS[nextIdx]);
      }, 600);
    }, 400);
  }

  // ── Settings Modal ───────────────────────────────────────
  function openSettings() {
    modalOverlay.classList.add('open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    updateKeyStatus();
    modelSelect.value = CivicAPI.getModel();
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
      dot.classList.remove('inactive'); dot.classList.add('active');
      text.textContent = 'Custom key active — using your key';
      onboardingKeyStatus.textContent = '✅ API key is configured (Custom Key)';
    } else {
      dot.classList.remove('active'); dot.classList.add('inactive');
      text.textContent = 'No custom key set — using server default';
      onboardingKeyStatus.textContent = '✅ API key is configured (Server Default)';
    }
    const models = {
      'gemini-3.1-pro-preview': 'Gemini 3.1 Pro Preview',
      'gemini-3.1-flash-lite-preview': 'Gemini 3.1 Flash Lite Preview',
      'gemini-3-flash-preview': 'Gemini 3 Flash Preview',
      'gemini-2.5-pro': 'Gemini 2.5 Pro',
      'gemini-2.5-flash': 'Gemini 2.5 Flash'
    };
    onboardingModelStatus.textContent = models[CivicAPI.getModel()] || CivicAPI.getModel();
  }

  function saveKey() {
    CivicAPI.setModel(modelSelect.value);
    const val = apiKeyInput.value;
    if (val && val.trim()) { CivicAPI.setApiKey(val); apiKeyInput.value = ''; }
    updateKeyStatus();
    closeSettings();
  }

  function clearKey() {
    CivicAPI.clearApiKey();
    apiKeyInput.value = '';
    updateKeyStatus();
  }

  // ── Mock Google Login ────────────────────────────────────
  async function loginGoogle() {
    if (window.firebaseAuth) {
      try {
        const { auth, provider, signInWithPopup } = window.firebaseAuth;
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Create avatar in nav
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        avatar.textContent = user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U';
        avatar.title = `Logged in as ${user.displayName || 'User'}`;
        
        // Replace if exists
        const existing = document.querySelector('.user-avatar');
        if (existing) existing.remove();
        
        navActions.insertBefore(avatar, navActions.firstChild);
        dismissOnboarding();
      } catch (error) {
        console.error("Firebase Login Error Code:", error.code);
        console.error("Firebase Login Error Message:", error.message);
        console.error("Full Error:", error);
        alert("Failed to sign in with Google: " + error.message + " (" + (error.code || 'unknown') + ")");
      }
    } else {
      // Fallback if firebase failed to load
      const avatar = document.createElement('div');
      avatar.className = 'user-avatar';
      avatar.textContent = 'U';
      avatar.title = 'Logged in as User';
      navActions.insertBefore(avatar, navActions.firstChild);
      dismissOnboarding();
    }
  }

  function dismissOnboarding() {
    onboardingOverlay.classList.remove('open');
    onboardingOverlay.setAttribute('aria-hidden', 'true');
    // Auto-open the first node after a brief delay for wow-effect
    setTimeout(() => {
      nodeButtons[0].classList.add('active');
      nodeButtons[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => openPanel(TOPICS[0]), 400);
    }, 500);
  }

  // ── Keyboard ─────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalOverlay.classList.contains('open')) closeSettings();
      else if (sidePanel.classList.contains('open')) closePanel();
    }
  });

  // ── Event Bindings ───────────────────────────────────────
  nodeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      nodeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      openPanel(btn.dataset.topic);
    });
  });

  panelClose.addEventListener('click', closePanel);
  panelOverlay.addEventListener('click', closePanel);
  btnSubmit.addEventListener('click', submitAnswer);
  btnNext.addEventListener('click', closePanel);
  btnUnlockNext.addEventListener('click', unlockNextPhase);
  btnSettings.addEventListener('click', openSettings);
  btnSaveKey.addEventListener('click', saveKey);
  btnClearKey.addEventListener('click', clearKey);
  btnCloseModal.addEventListener('click', closeSettings);
  btnLoginGoogle.addEventListener('click', loginGoogle);
  btnStartGuest.addEventListener('click', dismissOnboarding);
  onboardingEditSettings.addEventListener('click', openSettings);

  // ── Init ─────────────────────────────────────────────────
  updateHUD();
  updateKeyStatus();
  onboardingOverlay.classList.add('open');
  setTimeout(updateScrollProgress, 100);
})();
