import type { TutorRequest, TutorResponse, TutorMode } from '../../lib/tutor-contract';
import { assembleTutorPrompt } from './prompts';
import { EmptyTutorContextProvider, RetrievalTutorContextProvider, type TutorContextProvider, type TutorExecutionContext, type AuthenticatedTutorUser } from './tutor-context';
import { createConfiguredModelProvider, FakeModelProvider, TutorProviderError, UnavailableModelProvider, type ModelProvider } from './model-provider';
import { NoopTutorObservability, type TutorObservability } from './tutor-observability';

export const MAX_TUTOR_MESSAGE_LENGTH = 4000;
export const MAX_TUTOR_OPTIONAL_FIELD_LENGTH = 200;

const TUTOR_MODES: readonly TutorMode[] = ['explain', 'hint', 'practice', 'review'];

export class TutorValidationError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'TutorValidationError';
  }
}

export class TutorOrchestrationError extends Error {
  readonly code = 'TUTOR_ERROR' as const;

  constructor(message = 'Tutor service is unavailable.') {
    super(message);
    this.name = 'TutorOrchestrationError';
  }
}

export class TutorOrchestrator {
  constructor(
    private readonly provider: ModelProvider = new FakeModelProvider(),
    private readonly contextProvider: TutorContextProvider = new EmptyTutorContextProvider(),
    private readonly observability: TutorObservability = new NoopTutorObservability(),
  ) {}

  async respond(request: TutorRequest, user: AuthenticatedTutorUser): Promise<TutorResponse> {
    const normalizedRequest = validateTutorRequest(request);
    const startedAt = Date.now();
    const mode = normalizedRequest.mode ?? 'explain';
    let providerStartedAt = startedAt;

    try {
      const context = await this.contextProvider.getContext({ user, request: normalizedRequest });
      const executionContext: TutorExecutionContext = {
        user,
        request: normalizedRequest,
        ...context,
      };
      const prompt = assembleTutorPrompt(executionContext);
      providerStartedAt = Date.now();
      const providerResponse = await this.provider.generateResponse({ executionContext, prompt });
      const response = normalizeTutorResponse(providerResponse, mode, executionContext.sources);
      this.observability.record({
        provider: this.provider.name,
        mode,
        success: true,
        durationMs: Date.now() - startedAt,
        providerDurationMs: Date.now() - providerStartedAt,
      });
      return response;
    } catch (error) {
      const errorCode = error instanceof TutorProviderError ? error.code : 'ORCHESTRATION_FAILURE';
      this.observability.record({
        provider: this.provider.name,
        mode,
        success: false,
        durationMs: Date.now() - startedAt,
        providerDurationMs: Math.max(0, Date.now() - providerStartedAt),
        errorCode,
      });
      if (error instanceof TutorValidationError) throw error;
      throw new TutorOrchestrationError();
    }
  }
}

export function validateTutorRequest(request: TutorRequest): TutorRequest {
  if (!request || typeof request !== 'object') {
    throw new TutorValidationError('Tutor request must be an object.');
  }

  if (typeof request.message !== 'string' || request.message.trim().length === 0) {
    throw new TutorValidationError('Tutor message is required.');
  }

  if (request.message.length > MAX_TUTOR_MESSAGE_LENGTH) {
    throw new TutorValidationError(`Tutor message must be ${MAX_TUTOR_MESSAGE_LENGTH} characters or fewer.`);
  }

  const optionalFields: Array<[keyof TutorRequest, unknown]> = [
    ['courseId', request.courseId],
    ['conversationId', request.conversationId],
    ['topic', request.topic],
  ];
  for (const [field, value] of optionalFields) {
    if (value !== undefined && (typeof value !== 'string' || value.length > MAX_TUTOR_OPTIONAL_FIELD_LENGTH)) {
      throw new TutorValidationError(`${String(field)} must be ${MAX_TUTOR_OPTIONAL_FIELD_LENGTH} characters or fewer.`);
    }
  }

  if (request.mode !== undefined && !TUTOR_MODES.includes(request.mode)) {
    throw new TutorValidationError('Tutor mode is invalid.');
  }

  return {
    message: request.message.trim(),
    ...(request.courseId?.trim() ? { courseId: request.courseId.trim() } : {}),
    ...(request.conversationId?.trim() ? { conversationId: request.conversationId.trim() } : {}),
    ...(request.mode ? { mode: request.mode } : {}),
    ...(request.topic?.trim() ? { topic: request.topic.trim() } : {}),
  };
}

function normalizeTutorResponse(
  providerResponse: { answer: string; suggestedFollowUp?: string; mode?: TutorMode; citations?: Array<{ sourceId: string; claim?: string }> },
  mode: TutorMode,
  citations: TutorExecutionContext['sources'],
): TutorResponse {
  if (!providerResponse || typeof providerResponse.answer !== 'string' || providerResponse.answer.trim().length === 0) {
    throw new TutorProviderError('PROVIDER_INVALID_OUTPUT');
  }

  const validSourceIds = new Set(citations.map((citation) => citation.sourceId));
  const validatedCitations = (providerResponse.citations ?? [])
    .filter((citation) => citation && typeof citation.sourceId === 'string' && validSourceIds.has(citation.sourceId))
    .map((citation) => ({
      ...citations.find((source) => source.sourceId === citation.sourceId),
      sourceId: citation.sourceId,
      ...(typeof citation.claim === 'string' && citation.claim.trim() ? { claim: citation.claim.slice(0, 500) } : {}),
    }));

  return {
    answer: providerResponse.answer,
    status: 'ok',
    mode: providerResponse.mode ?? mode,
    groundingStatus: citations.length > 0 && validatedCitations.length > 0 ? 'grounded' : citations.length > 0 ? 'insufficient_sources' : 'not_grounded',
    citations: validatedCitations,
    ...(providerResponse.suggestedFollowUp ? { suggestedFollowUp: providerResponse.suggestedFollowUp } : {}),
  };
}

let configuredProvider: ModelProvider;
try {
  configuredProvider = process.env.AI_PROVIDER
    ? createConfiguredModelProvider()
    : createConfiguredModelProvider({ AI_PROVIDER: 'fake' });
} catch {
  configuredProvider = new UnavailableModelProvider();
}

export const tutorOrchestrator = new TutorOrchestrator(configuredProvider, new RetrievalTutorContextProvider());
