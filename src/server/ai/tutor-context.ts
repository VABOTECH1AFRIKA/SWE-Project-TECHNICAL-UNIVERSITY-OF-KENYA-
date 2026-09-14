import type { TutorRequest, TutorCitation } from '../../lib/tutor-contract';
import { dataAccess } from '../data';
import { searchKnowledge } from '../knowledge/retrieval';

export interface AuthenticatedTutorUser {
  id: string;
  role: string;
}

export interface TutorExecutionContext {
  user: AuthenticatedTutorUser;
  request: TutorRequest;
  learnerContext: string[];
  courseContext: string[];
  sources: TutorCitation[];
}

export interface TutorContextProvider {
  getContext(context: Pick<TutorExecutionContext, 'user' | 'request'>): Promise<Pick<TutorExecutionContext, 'learnerContext' | 'courseContext' | 'sources'>>;
}

export class EmptyTutorContextProvider implements TutorContextProvider {
  async getContext(): Promise<Pick<TutorExecutionContext, 'learnerContext' | 'courseContext' | 'sources'>> {
    return { learnerContext: [], courseContext: [], sources: [] };
  }
}

export class RetrievalTutorContextProvider implements TutorContextProvider {
  async getContext(context: Pick<TutorExecutionContext, 'user' | 'request'>): Promise<Pick<TutorExecutionContext, 'learnerContext' | 'courseContext' | 'sources'>> {
    const retrieval = await searchKnowledge({
      userId: context.user.id,
      role: context.user.role as 'student' | 'lecturer' | 'admin',
      query: context.request.message,
      courseId: context.request.courseId,
      topic: context.request.topic,
      maxResults: 8,
    });

    const sources: TutorCitation[] = retrieval.results.map((result) => ({
      sourceId: result.chunkId,
      title: result.title,
      locator: [
        result.pageNumber ? `page ${result.pageNumber}` : '',
        result.slideNumber ? `slide ${result.slideNumber}` : '',
        result.headingPath ?? '',
      ].filter(Boolean).join(' / ') || undefined,
    }));

    const history = context.request.conversationId
      ? await dataAccess.tutor.listMessages(context.request.conversationId, context.user.id, 12)
      : [];

    return {
      learnerContext: history.map((message: any) => `${message.role}: ${message.content}`),
      courseContext: retrieval.results.map((result) => `[${result.chunkId}] ${result.title}: ${result.text}`),
      sources,
    };
  }
}
