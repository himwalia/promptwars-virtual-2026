/**
 * api.js — Civic-Flow API client
 * Handles all backend communication with BYOK (Bring Your Own Key) support.
 * Custom API keys are stored in sessionStorage and injected via x-api-key header.
 */

const CivicAPI = (() => {
  const BASE = '';

  /** Build headers, injecting BYOK key if present */
  function _headers() {
    const h = { 'Content-Type': 'application/json' };
    const key = sessionStorage.getItem('civic_api_key');
    if (key) h['x-api-key'] = key;
    const model = sessionStorage.getItem('civic_gemini_model');
    if (model) h['x-gemini-model'] = model;
    return h;
  }

  /** POST helper with error handling */
  async function _post(path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: _headers(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  return {
    /** Start or resume a session for a topic */
    startSession(topic, sessionId) {
      return _post('/api/session/start', { topic, sessionId });
    },

    /** Get AI explanation for a topic at a given knowledge state */
    explain(topic, state) {
      return _post('/api/explain', { topic, state });
    },

    /** Submit an answer and get updated score/state */
    submitAnswer(sessionId, correct, topic) {
      return _post('/api/answer', { sessionId, correct, topic });
    },

    /** BYOK key management */
    setApiKey(key) {
      if (key && key.trim()) {
        sessionStorage.setItem('civic_api_key', key.trim());
        return true;
      }
      return false;
    },

    clearApiKey() {
      sessionStorage.removeItem('civic_api_key');
    },

    hasCustomKey() {
      return !!sessionStorage.getItem('civic_api_key');
    },

    setModel(modelId) {
      if (modelId) sessionStorage.setItem('civic_gemini_model', modelId);
    },

    getModel() {
      return sessionStorage.getItem('civic_gemini_model') || 'gemini-3.1-pro-preview';
    },
  };
})();
