import { dataAccess } from '../data';
import {
  DEFAULT_RETRIEVAL_MAX_RESULTS,
  MAX_RETRIEVAL_QUERY_LENGTH,
  MAX_RETRIEVAL_RESULTS,
  MIN_SUFFICIENT_RELEVANCE,
  RetrievalValidationError,
  type RetrievalRequest,
  type RetrievalResponse,
  type RetrievalResult,
  type RetrievalRole,
} from './types';

export function normalizeRetrievalQuery(query: unknown): string {
  if (typeof query !== 'string') {
    throw new RetrievalValidationError('Retrieval query is required.');
  }

  const normalized = query.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (!normalized) throw new RetrievalValidationError('Retrieval query is required.');
  if (normalized.length > MAX_RETRIEVAL_QUERY_LENGTH) {
    throw new RetrievalValidationError(`Retrieval query must be ${MAX_RETRIEVAL_QUERY_LENGTH} characters or fewer.`);
  }
  return normalized;
}

function normalizeOptional(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 200) {
    throw new RetrievalValidationError(`${field} must be 200 characters or fewer.`);
  }
  const normalized = value.normalize('NFKC').trim();
  return normalized || undefined;
}

function normalizeLimit(value: unknown): number {
  if (value === undefined) return DEFAULT_RETRIEVAL_MAX_RESULTS;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > MAX_RETRIEVAL_RESULTS) {
    throw new RetrievalValidationError(`maxResults must be an integer from 1 to ${MAX_RETRIEVAL_RESULTS}.`);
  }
  return Number(value);
}

function isAuthorizedCourse(membership: any, userId: string, role: RetrievalRole, courseId: string): boolean {
  if (membership.user_id !== userId && membership.userId !== userId) return false;
  const membershipCourseId = membership.course_id ?? membership.courseId;
  if (membershipCourseId !== courseId || (membership.status ?? '') !== 'active') return false;
  const membershipRole = membership.role;
  return role === 'lecturer'
    ? membershipRole === 'lecturer' || membershipRole === 'admin'
    : membershipRole === 'student' || membershipRole === 'lecturer' || membershipRole === 'admin';
}

function scoreSqliteRow(row: any, query: string): number {
  const terms = query.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/gu).filter(Boolean);
  const searchable = `${row.text} ${row.heading_path ?? ''}`.toLocaleLowerCase();
  const heading = String(row.heading_path ?? '').toLocaleLowerCase();
  const covered = terms.filter((term) => searchable.includes(term)).length;
  const phraseBoost = searchable.includes(query.toLocaleLowerCase()) ? 0.35 : 0;
  const headingBoost = terms.some((term) => heading.includes(term)) ? 0.1 : 0;
  return Math.min(1, (terms.length ? covered / terms.length : 0) * 0.55 + phraseBoost + headingBoost);
}

export async function searchKnowledge(input: Omit<RetrievalRequest, 'userId' | 'role'> & { userId: string; role: RetrievalRole }): Promise<RetrievalResponse> {
  const query = normalizeRetrievalQuery(input.query);
  const topic = normalizeOptional(input.topic, 'topic');
  const courseId = normalizeOptional(input.courseId, 'courseId');
  const resourceId = normalizeOptional(input.resourceId, 'resourceId');
  const maxResults = normalizeLimit(input.maxResults);
  const searchQuery = topic ? `${query} ${topic}` : query;

  const memberships = input.role === 'admin' ? [] : await dataAccess.courseMemberships.listForUser(input.userId);
  const courses = await dataAccess.courses.list();
  const authorizedCourseIds = input.role === 'admin'
    ? courses.map((course: any) => course.id)
    : memberships
      .filter((membership: any) => isAuthorizedCourse(membership, input.userId, input.role, membership.course_id ?? membership.courseId))
      .map((membership: any) => membership.course_id ?? membership.courseId);

  const allowedCourseIds = courseId ? authorizedCourseIds.filter((id: string) => id === courseId) : authorizedCourseIds;
  if (courseId && allowedCourseIds.length === 0) {
    return { query, results: [], hasSufficientEvidence: false };
  }

  const resources = await dataAccess.learningResources.list();
  const eligibleResources = resources.filter((resource: any) =>
    resource.status === 'published'
    && resource.visibility === 'course'
    && resource.currentVersionId
    && allowedCourseIds.includes(resource.courseId)
    && (!resourceId || resource.id === resourceId),
  );

  const resourceByVersion = new Map<string, any>();
  const versionMatches = await Promise.all(eligibleResources.map(async (resource: any) => {
    const versions = await dataAccess.learningResources.listVersions(resource.id);
    const current = versions.find((version: any) =>
      version.id === resource.currentVersionId
      && version.extractionStatus === 'completed'
      && !version.supersededAt,
    );
    return current ? { resource, version: current } : null;
  }));

  const versionIds = versionMatches.filter(Boolean).map((match: any) => {
    resourceByVersion.set(match.version.id, match.resource);
    return match.version.id;
  });

  if (versionIds.length === 0) return { query, results: [], hasSufficientEvidence: false };

  const rows = await dataAccess.knowledge.searchChunks({ versionIds, query: searchQuery, limit: maxResults });
  const results: RetrievalResult[] = rows
    .map((row: any): RetrievalResult | null => {
      const resource = resourceByVersion.get(row.version_id ?? row.versionId);
      if (!resource) return null;
      const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata ?? {});
      const score = Number(row.relevance_score ?? row.relevanceScore ?? scoreSqliteRow(row, searchQuery));
      const citation = {
        chunkId: row.chunk_id ?? row.id,
        resourceId: row.resource_id ?? resource.id,
        versionId: row.version_id ?? row.versionId,
        title: row.title ?? resource.title,
        courseId: row.course_id ?? resource.courseId,
        course: row.course_code ?? row.course ?? resource.courseCode ?? resource.courseId,
        pageNumber: row.page_number ?? row.pageNumber,
        slideNumber: metadata.slideNumber,
        headingPath: row.heading_path ?? row.headingPath,
        publishedAt: row.published_at ?? resource.publishedAt,
      };
      return {
        ...citation,
        text: row.chunk_text ?? row.text,
        versionNumber: row.version_number ?? row.versionNumber,
        relevanceScore: score,
        citation,
      };
    })
    .filter((result: RetrievalResult | null): result is RetrievalResult => result !== null)
    .sort((left: RetrievalResult, right: RetrievalResult) => right.relevanceScore - left.relevanceScore || left.citation.chunkId.localeCompare(right.citation.chunkId))
    .slice(0, maxResults);

  return {
    query,
    results,
    hasSufficientEvidence: results.some((result) => result.relevanceScore >= MIN_SUFFICIENT_RELEVANCE),
  };
}