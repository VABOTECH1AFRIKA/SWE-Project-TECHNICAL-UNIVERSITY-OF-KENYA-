# StudyHub AI Tutor Contract

## Purpose

This document freezes the Phase 0/1 server boundary for future Tutor work. It does not implement an LLM, retrieval, content ingestion, persistence, personalization, or ML.

## Confirmed From Source

- `src/pages/ai-tutor.tsx` is currently a client-side mock Tutor.
- `src/lib/api.ts` previously had no Tutor method.
- `src/server/entry.ts` mounts the active Express router at `/api`.
- `src/server/api/studyhub-sqlite.ts` is part of the active route surface.
- `src/server/auth/session.ts` provides cookie-based server-side authentication.
- `src/server/data/index.ts` selects SQLite or Supabase through `DATABASE_PROVIDER`.
- No real model provider, retrieval system, embeddings, conversation persistence, or Tutor database tables exist.

## Implemented In Phase 0

### Endpoint

`POST /api/ai/tutor`

The endpoint is mounted in the existing active API router and requires `requireAuth`.

### Request

```ts
interface TutorRequest {
  message: string;
  courseId?: string;
  conversationId?: string;
  mode?: 'explain' | 'hint' | 'practice' | 'review';
  topic?: string;
}
```

Rules:

- `message` is required after trimming.
- Maximum message length is 4000 characters.
- The authenticated user is taken from the server session, never from a request `userId` or `role` field.
- Optional fields are forwarded only as bounded contract context; they do not grant access to data.

### Success response

```ts
interface TutorResponse {
  answer: string;
  status: 'ok';
  groundingStatus: 'not_grounded' | 'grounded' | 'insufficient_sources';
  citations: TutorCitation[];
  suggestedFollowUp?: string;
}

interface TutorCitation {
  sourceId: string;
  title?: string;
  locator?: string;
}
```

Phase 0 always returned:

- `status: "ok"`
- `groundingStatus: "not_grounded"`
- `citations: []`
- deterministic fake-provider text

### Error response

```ts
interface TutorErrorResponse {
  error: {
    code: 'AUTHENTICATION_REQUIRED' | 'VALIDATION_ERROR' | 'TUTOR_ERROR';
    message: string;
  };
}
```

Current HTTP behavior:

- Missing/invalid session: existing `401 { error: "Authentication required" }` middleware response.
- Invalid or oversized request: `400` with `VALIDATION_ERROR`.
- Unexpected orchestrator/provider failure: `500` with `TUTOR_ERROR` and a generic message.
- Stack traces, credentials, environment variables, and infrastructure details are not returned.

## Implemented In Phase 1

### Execution context

The orchestrator converts the request and server-derived session identity into `TutorExecutionContext`:

```ts
interface TutorExecutionContext {
  user: { id: string; role: string };
  request: TutorRequest;
  learnerContext: string[];
  courseContext: string[];
  sources: TutorCitation[];
}
```

The empty context provider returns no learner context, course context, or sources. It is replaceable through `TutorContextProvider` without changing the HTTP route.

### Tutor modes

The supported modes are intentionally limited to `explain`, `hint`, `practice`, and `review`. Phase 1 validates the mode and normalizes it into the response; it does not implement distinct educational behavior.

### Prompt assembly boundary

`assembleTutorPrompt()` creates separate fields for:

- trusted system instructions
- trusted mode instructions
- untrusted student message
- untrusted learner context
- untrusted course context
- untrusted source references

Future retrieved documents must remain reference material and must never be promoted to system instructions by default.

### Provider abstraction

`src/server/ai/model-provider.ts` defines:

- `ModelProvider`
- `TutorProviderContext`
- `TutorProviderResponse`
- `FakeModelProvider`

`src/server/ai/tutor-orchestrator.ts` accepts a typed request and authenticated server context, validates bounded fields and modes, obtains replaceable context, assembles the prompt boundary, calls the provider, and normalizes the stable response. Raw provider objects are never returned by the API.

`src/server/ai/prompts.ts` is the server-only prompt boundary. It contains only a Phase 0 placeholder/version marker and no educational model prompt.

The frontend API method is `api.tutor()` in `src/lib/api.ts`. It uses the existing same-origin cookie request mechanism and does not handle provider credentials.

### Provider errors and observability

`TutorProviderError` distinguishes provider-unavailable, timeout, rejected-request, and invalid-output categories internally. The HTTP route returns only the existing safe public error convention with a generic `TUTOR_ERROR` message.

`TutorObservability` records provider name, selected mode, success, total duration, provider duration, and normalized error code. The Phase 1 default sink is a no-op; it does not log messages, prompts, cookies, credentials, or secrets.

## Current fake-provider behavior

The fake provider returns a deterministic mode-aware response:

> StudyHub Tutor backend contract is active. Mode: explain. Model integration is not enabled yet.

This is intentionally not presented as a real educational answer.

## Security Rules

- User ID, role, and permissions come only from the authenticated server session.
- Client-supplied identity or role fields are not part of the typed request and are ignored by normalization.
- Provider credentials remain server-only; no model SDK or credential was added.
- Student messages, future uploaded material, and future retrieved sources are untrusted content.
- System instructions and mode policy are trusted control data.
- Message length and optional context identifiers are bounded before provider execution.
- Provider/internal errors are sanitized before HTTP responses.

## Deferred To Future Phases

- Real LLM provider integration and model SDKs.
- Prompt engineering for educational behavior.
- Conversation persistence and Tutor message tables.
- Course membership and topic/resource context.
- File uploads and content ingestion.
- Retrieval, RAG, embeddings, pgvector, hybrid search, and citations backed by content.
- Learning events, quiz attempts, mastery, recommendations, and personalization.
- ML models and predictive analytics.
- Tutor UI redesign or replacement of existing mock behavior.

## Compatibility and security notes

- Existing authentication/session architecture is unchanged.
- Supabase Auth is not introduced.
- SQLite remains a supported provider and rollback path.
- No database schema or migration was added.
- Existing academic routes and the current mock Tutor UI remain available.
- The server derives identity from `requireAuth`; browser-supplied identity/role values are ignored.
- The fake provider is deterministic and network-free.

## Phase 1 extension expectations

Future phases should add model and retrieval behavior behind `ModelProvider` and the orchestrator, preserving `TutorRequest` and `TutorResponse` compatibility where possible. Any new response fields should be optional and any breaking contract change should be versioned. Future context must be authorized server-side before it reaches a provider.
