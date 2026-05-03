/**
 * geminiAdapter.js
 * Handles communication with the Gemini 1.5 Pro API, including
 * BYOK (Bring Your Own Key) resolution, prompt construction,
 * and error handling with retry logic.
 */

const { buildPromptForState } = require('./knowledgeState');

class UnknownTopicError extends Error {
  constructor(topic) {
    super(`Unknown election topic: "${topic}"`);
    this.name = 'UnknownTopicError';
  }
}

/** Valid election topics for the Civic-Flow timeline */
const VALID_TOPICS = Object.freeze([
  'Voter Registration',
  'Primaries',
  'Campaigning',
  'Election Day',
  'Certification',
]);

/**
 * Resolve the API key: BYOK header takes priority, then env variable.
 * @param {Object} req - Express request object
 * @returns {string|null} The resolved API key or null
 */
function resolveApiKey(req) {
  const headerKey = req.headers && req.headers['x-api-key'];
  if (headerKey && headerKey.trim().length > 0) {
    return headerKey.trim();
  }
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey.trim().length > 0) {
    return envKey.trim();
  }
  return null;
}

/**
 * Build the full prompt for a Gemini request.
 * @param {string} state - User's knowledge state
 * @param {string} topic - Election topic
 * @returns {string} Constructed prompt
 * @throws {UnknownTopicError} If topic is not in the valid set
 */
function buildPrompt(state, topic) {
  if (!VALID_TOPICS.includes(topic)) {
    throw new UnknownTopicError(topic);
  }
  return buildPromptForState(state, topic);
}

/**
 * Call the Gemini 1.5 Pro API with retry logic.
 * @param {string} apiKey
 * @param {string} prompt
 * @param {Object} [options]
 * @param {number} [options.maxRetries=1]
 * @param {Function} [options.fetchFn] - Injectable fetch function for testing
 * @returns {Promise<string>} The generated response text
 */
async function callGeminiAPI(apiKey, prompt, options = {}) {
  const maxRetries = options.maxRetries ?? 1;
  const fetchFn = options.fetchFn || globalThis.fetch;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
  });

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (response.ok) {
        const json = await response.json();
        return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      if (response.status === 429) {
        lastError = new Error(`Rate limited (429), attempt ${attempt + 1}`);
        if (attempt < maxRetries) {
          // Retry after short delay
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        break;
      }

      if (response.status === 500) {
        const errorMsg = 'We encountered a temporary issue. Please try again shortly.';
        console.error(`Gemini API 500 error on attempt ${attempt + 1}`);
        throw new Error(errorMsg);
      }

      throw new Error(`Gemini API error: ${response.status}`);
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries) break;
    }
  }

  // If all retries exhausted (e.g. from 429), return graceful fallback
  if (lastError && lastError.message.includes('Rate limited')) {
    return 'Our AI service is currently busy. Please try again in a moment.';
  }

  throw lastError;
}

/**
 * Express route handler for Gemini-powered explanations.
 * @param {Object} req - Express request (expects body.topic, body.state)
 * @param {Object} res - Express response
 */
async function handleExplainRequest(req, res) {
  const apiKey = resolveApiKey(req);
  if (!apiKey) {
    return res.status(403).json({
      error: 'No API key configured. Provide an x-api-key header or set GEMINI_API_KEY.',
    });
  }

  const { topic, state } = req.body || {};

  try {
    const prompt = buildPrompt(state, topic);
    const explanation = await callGeminiAPI(apiKey, prompt);
    return res.status(200).json({ explanation, state, topic });
  } catch (err) {
    if (err instanceof UnknownTopicError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Gemini adapter error:', err.message);
    return res.status(500).json({
      error: 'We encountered a temporary issue. Please try again shortly.',
    });
  }
}

module.exports = {
  resolveApiKey,
  buildPrompt,
  callGeminiAPI,
  handleExplainRequest,
  UnknownTopicError,
  VALID_TOPICS,
};
