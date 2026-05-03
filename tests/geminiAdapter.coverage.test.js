/**
 * geminiAdapter.coverage.test.js
 * Supplementary tests to cover the handleExplainRequest route handler,
 * successful API calls, and edge cases in the Gemini adapter.
 */

const {
  resolveApiKey,
  buildPrompt,
  callGeminiAPI,
  handleExplainRequest,
  UnknownTopicError,
} = require('../server/lib/geminiAdapter');

describe('geminiAdapter — coverage supplements', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  // Cover successful API call path
  test('callGeminiAPI returns generated text on successful response', async () => {
    const mockFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Here is your explanation about voting.' }],
            },
          },
        ],
      }),
    }));

    const result = await callGeminiAPI('test-key', 'test prompt', {
      fetchFn: mockFetch,
    });
    expect(result).toBe('Here is your explanation about voting.');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // Cover successful response with empty candidates
  test('callGeminiAPI returns empty string when candidates are empty', async () => {
    const mockFetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [] }),
    }));

    const result = await callGeminiAPI('test-key', 'test prompt', {
      fetchFn: mockFetch,
    });
    expect(result).toBe('');
  });

  // Cover handleExplainRequest — 403 when no API key
  test('handleExplainRequest returns 403 when no API key is available', async () => {
    delete process.env.GEMINI_API_KEY;
    const req = { headers: {}, body: { topic: 'Candidate Nomination', state: 'NOVICE' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await handleExplainRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('No API key') })
    );
  });

  // Cover handleExplainRequest — 400 on unknown topic
  test('handleExplainRequest returns 400 on unknown topic', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const req = { headers: {}, body: { topic: 'InvalidTopic', state: 'NOVICE' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await handleExplainRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Unknown election topic') })
    );
  });

  // Cover handleExplainRequest — 500 on Gemini error
  test('handleExplainRequest returns 500 on Gemini API failure', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Mock globalThis.fetch to simulate a 500 error
    const origFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));

    const req = { headers: {}, body: { topic: 'Candidate Nomination', state: 'NOVICE' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await handleExplainRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('temporary issue') })
    );

    globalThis.fetch = origFetch;
    consoleSpy.mockRestore();
  });

  // Cover handleExplainRequest — 200 success path
  test('handleExplainRequest returns 200 with explanation on success', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    const origFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Registration is how you sign up to vote.' }],
            },
          },
        ],
      }),
    }));

    const req = {
      headers: {},
      body: { topic: 'Voter Registration', state: 'NOVICE' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await handleExplainRequest(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        explanation: 'Registration is how you sign up to vote.',
        state: 'NOVICE',
        topic: 'Voter Registration',
      })
    );

    globalThis.fetch = origFetch;
  });

  // Cover resolveApiKey with empty/whitespace key header
  test('resolveApiKey ignores empty x-api-key header', () => {
    process.env.GEMINI_API_KEY = 'env-key';
    const req = { headers: { 'x-api-key': '   ' } };
    expect(resolveApiKey(req)).toBe('env-key');
  });

  // Cover callGeminiAPI with a non-429/non-500 error status
  test('callGeminiAPI throws on non-retryable error status (e.g. 401)', async () => {
    const mockFetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    }));

    await expect(
      callGeminiAPI('bad-key', 'test prompt', {
        maxRetries: 0,
        fetchFn: mockFetch,
      })
    ).rejects.toThrow('Gemini API error: 401');
  });
});
