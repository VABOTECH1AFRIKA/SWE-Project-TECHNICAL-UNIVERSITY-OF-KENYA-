import { describe, expect, it, vi } from 'vitest';
import type { TutorMode } from '../../lib/tutor-contract';
import { TutorProviderError, type ModelProvider, type TutorProviderRequest, type TutorProviderResponse } from './model-provider';
import { assembleTutorPrompt } from './prompts';
import { EmptyTutorContextProvider, type TutorContextProvider } from './tutor-context';
import {
  MAX_TUTOR_MESSAGE_LENGTH,
  MAX_TUTOR_OPTIONAL_FIELD_LENGTH,
  TutorOrchestrator,
  TutorValidationError,
} from './tutor-orchestrator';
import type { TutorObservability, TutorObservation } from './tutor-observability';

function providerReturning(answer: string): ModelProvider {
  return {
    name: 'test-provider',
    generateResponse: vi.fn<(request: TutorProviderRequest) => Promise<TutorProviderResponse>>().mockResolvedValue({ answer }),
  };
}

function recordingObservability(): TutorObservability & { observations: TutorObservation[] } {
  const observations: TutorObservation[] = [];
  return { observations, record: (observation) => observations.push(observation) };
}

describe('TutorOrchestrator', () => {
  it.each<TutorMode>(['explain', 'hint', 'practice', 'review'])('normalizes %s mode', async (mode) => {
    const provider = providerReturning('deterministic answer');
    const orchestrator = new TutorOrchestrator(provider);

    const response = await orchestrator.respond({ message: 'Explain trees.', mode }, { id: 'u1', role: 'student' });

    expect(response).toMatchObject({ answer: 'deterministic answer', status: 'ok', mode, groundingStatus: 'not_grounded', citations: [] });
    expect(provider.generateResponse).toHaveBeenCalledWith(expect.objectContaining({
      executionContext: expect.objectContaining({
        user: { id: 'u1', role: 'student' },
        request: { message: 'Explain trees.', mode },
        learnerContext: [],
        courseContext: [],
        sources: [],
      }),
    }));
  });

  it('uses a replaceable context provider and keeps prompt trust boundaries explicit', async () => {
    const contextProvider: TutorContextProvider = {
      getContext: vi.fn().mockResolvedValue({ learnerContext: ['future learner signal'], courseContext: ['future course signal'], sources: [] }),
    };
    const provider = providerReturning('answer');
    const orchestrator = new TutorOrchestrator(provider, contextProvider);

    await orchestrator.respond({ message: 'Question', topic: 'trees' }, { id: 'u1', role: 'student' });

    const call = vi.mocked(provider.generateResponse).mock.calls[0][0];
    expect(call.prompt.systemInstructions.trust).toBe('trusted');
    expect(call.prompt.modeInstructions.trust).toBe('trusted');
    expect(call.prompt.userMessage.trust).toBe('untrusted');
    expect(call.prompt.learnerContext[0].trust).toBe('untrusted');
    expect(call.prompt.courseContext[0].trust).toBe('untrusted');
  });

  it('rejects invalid modes and bounded-field violations', async () => {
    const orchestrator = new TutorOrchestrator(providerReturning('unused'));

    await expect(orchestrator.respond({ message: 'Question', mode: 'unknown' as TutorMode }, { id: 'u1', role: 'student' })).rejects.toBeInstanceOf(TutorValidationError);
    await expect(orchestrator.respond({ message: 'x'.repeat(MAX_TUTOR_MESSAGE_LENGTH + 1) }, { id: 'u1', role: 'student' })).rejects.toThrow('4000 characters or fewer');
    await expect(orchestrator.respond({ message: 'Question', topic: 'x'.repeat(MAX_TUTOR_OPTIONAL_FIELD_LENGTH + 1) }, { id: 'u1', role: 'student' })).rejects.toThrow('topic');
  });

  it('normalizes provider failures and records safe observability metadata', async () => {
    const observability = recordingObservability();
    const provider: ModelProvider = {
      name: 'failing-provider',
      generateResponse: vi.fn().mockRejectedValue(new TutorProviderError('PROVIDER_TIMEOUT', 'private provider detail')),
    };
    const orchestrator = new TutorOrchestrator(provider, new EmptyTutorContextProvider(), observability);

    await expect(orchestrator.respond({ message: 'Question', mode: 'review' }, { id: 'u1', role: 'student' })).rejects.toThrow('Tutor service is unavailable');
    expect(observability.observations[0]).toMatchObject({ provider: 'failing-provider', mode: 'review', success: false, errorCode: 'PROVIDER_TIMEOUT' });
    expect(JSON.stringify(observability.observations)).not.toContain('private provider detail');
  });

  it('assembles empty Phase 1 context without inventing sources', () => {
    const prompt = assembleTutorPrompt({
      user: { id: 'u1', role: 'student' },
      request: { message: 'Question', mode: 'explain' },
      learnerContext: [],
      courseContext: [],
      sources: [],
    });

    expect(prompt.sources).toEqual([]);
    expect(prompt.userMessage).toEqual({ text: 'Question', trust: 'untrusted' });
  });

  it('drops model citations that are not in the authorized source set', async () => {
    const provider: ModelProvider = {
      name: 'citation-test-provider',
      generateResponse: vi.fn().mockResolvedValue({
        answer: 'Grounded answer',
        citations: [{ sourceId: 'allowed', claim: 'Valid claim' }, { sourceId: 'forged', claim: 'Forged claim' }],
      }),
    };
    const contextProvider: TutorContextProvider = {
      getContext: vi.fn().mockResolvedValue({
        learnerContext: [],
        courseContext: [],
        sources: [{ sourceId: 'allowed', title: 'Authorized source' }],
      }),
    };

    const response = await new TutorOrchestrator(provider, contextProvider).respond({ message: 'Question' }, { id: 'u1', role: 'student' });

    expect(response.citations).toEqual([{ sourceId: 'allowed', title: 'Authorized source', claim: 'Valid claim' }]);
    expect(response.groundingStatus).toBe('grounded');
  });
});
