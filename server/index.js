const express = require('express');
const path = require('path');
const { handleExplainRequest, resolveApiKey, VALID_TOPICS } = require('./lib/geminiAdapter');
const { calculateScore } = require('./lib/confidenceScore');
const { getState, KnowledgeStateMachine, buildPromptForState } = require('./lib/knowledgeState');

const app = express();
app.use(express.json());

// Serve static frontend files from client/
app.use(express.static(path.join(__dirname, '..', 'client')));

// Hybrid Quota Architecture: Check for 'x-api-key' header (BYOK pattern)
app.use((req, res, next) => {
  const customApiKey = req.headers['x-api-key'];
  req.geminiApiKey = customApiKey || process.env.GEMINI_API_KEY;
  next();
});

// In-memory session store (per-user state machine)
const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      machine: new KnowledgeStateMachine({ hysteresisBuffer: 0.02 }),
      interactions: [],
      totalCorrect: 0,
      totalQuestions: 0,
    });
  }
  return sessions.get(sessionId);
}

// POST /api/explain — Get AI explanation for a topic
app.post('/api/explain', handleExplainRequest);

// POST /api/session/start — Start or resume a session for a topic
app.post('/api/session/start', (req, res) => {
  const { topic, sessionId } = req.body || {};
  if (!topic || !VALID_TOPICS.includes(topic)) {
    return res.status(400).json({ error: 'Invalid or missing topic.' });
  }
  const id = sessionId || `s_${Date.now()}`;
  const session = getSession(id);
  const state = session.machine.getCurrentState();
  const score = session.machine.currentScore;
  return res.json({ sessionId: id, state, score, topic });
});

// POST /api/answer — Submit an answer, update confidence & state
app.post('/api/answer', (req, res) => {
  const { sessionId, correct, topic } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId.' });
  const session = getSession(sessionId);
  session.totalQuestions += 1;
  if (correct) session.totalCorrect += 1;
  session.interactions.push({
    correct: !!correct,
    timestamp: Date.now(),
    difficulty: 1.0,
  });
  const score = calculateScore({
    correctAnswers: session.totalCorrect,
    totalQuestions: session.totalQuestions,
    details: session.interactions,
  });
  const result = session.machine.evaluate(score);
  return res.json({
    sessionId,
    score: Math.round(score * 100) / 100,
    state: result.state,
    changed: result.changed,
    previousState: result.previousState,
    totalCorrect: session.totalCorrect,
    totalQuestions: session.totalQuestions,
    topic,
  });
});

// GET /api/topics — List valid topics
app.get('/api/topics', (_req, res) => {
  res.json({ topics: VALID_TOPICS });
});

// GET /api/firebase-config
app.get('/api/firebase-config', (_req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDummyKeyForPromptWars",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "promptwars-virtual-2026.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "promptwars-virtual-2026",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "promptwars-virtual-2026.appspot.com",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "1234567890",
    appId: process.env.FIREBASE_APP_ID || "1:1234567890:web:abcdef123456"
  });
});

// Health check endpoint for Cloud Run
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// Fallback: serve index.html for SPA-style navigation
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// Port and Host binding strictly adhering to Cloud Run constraints
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Civic-Flow server listening on http://${HOST}:${PORT}`);
});
