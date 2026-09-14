export type TutorMode = 'explain' | 'hint' | 'practice' | 'review';

export type TutorGroundingStatus = 'not_grounded' | 'grounded' | 'insufficient_sources';

export interface TutorCitation {
  sourceId: string;
  title?: string;
  locator?: string;
  claim?: string;
}

export interface TutorRequest {
  message: string;
  courseId?: string;
  conversationId?: string;
  mode?: TutorMode;
  topic?: string;
}

export interface TutorResponse {
  answer: string;
  status: 'ok';
  mode: TutorMode;
  groundingStatus: TutorGroundingStatus;
  citations: TutorCitation[];
  conversationId?: string;
  suggestedFollowUp?: string;
}

export type TutorErrorCode = 'AUTHENTICATION_REQUIRED' | 'VALIDATION_ERROR' | 'TUTOR_ERROR';

export interface TutorErrorResponse {
  error: {
    code: TutorErrorCode;
    message: string;
  };
}
