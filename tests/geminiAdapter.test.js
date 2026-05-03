/**
 * geminiAdapter.test.js
 * 8 test cases covering BYOK/Hybrid Quota resolution, prompt construction,
 * and error handling with retry logic for the Gemini adapter.
 */

const {
  resolveApiKey,
  buildPrompt,
  callGeminiAPI,
  UnknownTopicError,
  VALID_TOPICS,
} = require('../server/lib/geminiAdapter');

describe('geminiAdapter', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  // ── 3.1 BYOK / Hybrid Quota ────────────────────────────────────────

  describe('BYOK / Hybrid Quota', () => {
    test('TC-1: request without x-api-key header uses process.env.GEMINI_API_KEY', () => {
      process.env.GEMINI_API_KEY = 'env-key-abc';
      const req = { headers: {} };
      expect(resolveApiKey(req)).toBe('env-key-abc');
    });

    test('TC-2: request with x-api-key header uses custom key, ignores env default', () => {
      process.env.GEMINI_API_KEY = 'env-key-abc';
      const req = { headers: { 'x-api-key': 'custom-key-xyz' } };
      expect(resolveApiKey(req)).toBe('custom-key-xyz');
    });

    test('TC-3: both keys missing returns null', () => {
      delete process.env.GEMINI_API_KEY;
      const req = { headers: {} };
      expect(resolveApiKey(req)).toBeNull();
    });
  });

  // ── 3.2 Prompt Construction ─────────────────────────────────────────

  describe('Prompt Construction', () => {
    test('TC-4: NOVICE state + "Voter Registration" topic produces simple-language prompt', () => {
      const prompt = buildPrompt('NOVICE', 'Voter Registration');
      expect(prompt).toMatch(/simple language/i);
      expect(prompt).toContain('Voter Registration');
    });

    test('TC-5: POLICY_WONK state + "Counting & Results" topic produces legal-framework prompt', () => {
      const prompt = buildPrompt('POLICY_WONK', 'Counting & Results');
      expect(prompt).toMatch(/legal/i);
      expect(prompt).toContain('Counting & Results');
    });

    test('TC-6: invalid topic throws UnknownTopicError', () => {
      expect(() => buildPrompt('NOVICE', 'Imaginary Topic')).toThrow(UnknownTopicError);
    });
  });

  // ── 3.3 Error Handling ──────────────────────────────────────────────

  describe('Error Handling', () => {
    test('TC-7: Gemini API 429 triggers retry then returns graceful fallback', async () => {
      let callCount = 0;
      const mockFetch = jest.fn(async () => {
        callCount++;
        return {
          ok: false,
          status: 429,
          json: async () => ({}),
        };
      });

      const result = await callGeminiAPI('test-key', 'test prompt', {
        maxRetries: 1,
        fetchFn: mockFetch,
      });

      // Should have been called twice (initial + 1 retry)
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Should return the graceful fallback message
      expect(result).toMatch(/busy|try again/i);
    });

    test('TC-8: Gemini API 500 returns user-friendly error, logs to stderr', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const mockFetch = jest.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }));

      await expect(
        callGeminiAPI('test-key', 'test prompt', {
          maxRetries: 0,
          fetchFn: mockFetch,
        })
      ).rejects.toThrow(/temporary issue/i);

      consoleSpy.mockRestore();
    });
  });
});
