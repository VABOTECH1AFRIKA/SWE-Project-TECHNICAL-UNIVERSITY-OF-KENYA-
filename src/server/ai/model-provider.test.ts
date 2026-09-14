import { describe, expect, it, vi } from 'vitest';
import type { TutorProviderRequest } from './model-provider';
import { GoogleAIProvider, GroqProvider, TutorProviderError, createConfiguredModelProvider } from './model-provider';

const request = { prompt: {
  systemInstructions: { text: 'trusted system policy', trust: 'trusted' as const },
  modeInstructions: { text: 'explain', trust: 'trusted' as const },
  userMessage: { text: 'Explain binary search.', trust: 'untrusted' as const },
  learnerContext: [], courseContext: [{ text: 'Binary search halves the search space.', trust: 'untrusted' as const }],
  sources: [{ text: '{"sourceId":"chunk-1"}', trust: 'untrusted' as const }],
}, executionContext: { user: { id: 'u1', role: 'student' }, request: { message: 'Explain binary search.', mode: 'explain' as const }, learnerContext: [], courseContext: [], sources: [{ sourceId: 'chunk-1' }] } } as unknown as TutorProviderRequest;

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('real Tutor provider adapters', () => {
  it('normalizes Google AI Studio structured output and usage', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({
      candidates: [{ content: { parts: [{ text: '{"answer":"Use halves.","citations":[{"sourceId":"chunk-1"}]}' }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 6, totalTokenCount: 16 },
    }));
    const provider = new GoogleAIProvider({ apiKey: 'test-google-key', model: 'gemini-test', transport: { fetch: fetcher } });

    await expect(provider.generateResponse(request)).resolves.toMatchObject({ answer: 'Use halves.', model: 'gemini-test', usage: { totalTokens: 16 } });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('gemini-test'), expect.objectContaining({ method: 'POST' }));
  });

  it('normalizes Groq structured output and usage', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({
      choices: [{ message: { content: '{"answer":"Compare the middle value.","citations":[]}' } }],
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    }));
    const provider = new GroqProvider({ apiKey: 'test-groq-key', model: 'llama-test', transport: { fetch: fetcher } });

    await expect(provider.generateResponse(request)).resolves.toMatchObject({ answer: 'Compare the middle value.', model: 'llama-test' });
    expect(fetcher).toHaveBeenCalledWith('https://api.groq.com/openai/v1/chat/completions', expect.objectContaining({ method: 'POST' }));
  });

  it('maps rate limits and selects only explicitly configured providers', async () => {
    const rateLimited = new GroqProvider({ apiKey: 'test', model: 'test', transport: { fetch: vi.fn().mockResolvedValue(response({}, 429)) } });
    await expect(rateLimited.generateResponse(request)).rejects.toMatchObject({ code: 'PROVIDER_RATE_LIMITED' });
    expect(createConfiguredModelProvider({ AI_PROVIDER: 'fake' }).name).toBe('fake');
    expect(() => createConfiguredModelProvider({ AI_PROVIDER: 'google' })).toThrow(TutorProviderError);
  });
});