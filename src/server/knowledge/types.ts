export type RetrievalRole = 'student' | 'lecturer' | 'admin';

export interface RetrievalRequest {
  userId: string;
  role: RetrievalRole;
  query: string;
  courseId?: string;
  topic?: string;
  resourceId?: string;
  maxResults?: number;
}

export interface RetrievalSourceReference {
  chunkId: string;
  resourceId: string;
  versionId: string;
  title: string;
  courseId: string;
  course: string;
  pageNumber?: number;
  slideNumber?: number;
  headingPath?: string;
  publishedAt?: string;
}

export interface RetrievalResult extends RetrievalSourceReference {
  text: string;
  versionNumber: number;
  relevanceScore: number;
  citation: RetrievalSourceReference;
}

export interface RetrievalResponse {
  query: string;
  results: RetrievalResult[];
  hasSufficientEvidence: boolean;
}

export const MAX_RETRIEVAL_QUERY_LENGTH = 500;
export const DEFAULT_RETRIEVAL_MAX_RESULTS = 8;
export const MAX_RETRIEVAL_RESULTS = 20;
export const MIN_SUFFICIENT_RELEVANCE = 0.05;

export class RetrievalValidationError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'RetrievalValidationError';
  }
}