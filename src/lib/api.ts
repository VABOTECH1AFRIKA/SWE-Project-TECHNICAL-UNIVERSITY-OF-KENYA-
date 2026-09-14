/**
 * StudyHub AI — Frontend API Client
 *
 * All data fetching goes through here. In development the Express server
 * proxies /api/* to the Python FastAPI backend (port 8000). If the Python
 * server is not running, the proxy falls back to the built-in TypeScript
 * data layer so the UI keeps working.
 */

import type { TutorRequest, TutorResponse } from './tutor-contract';

const BASE = '/api';

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Course {
  id: string; code: string; title: string; color: string;
  progress: number; notesCount: number; assignmentsCount: number;
  icon: string; lecturer: string;
}

export interface Note {
  id: string; title: string; course: string; type: string;
  date: string; size: string; pages: number;
}

export interface Assignment {
  id: string; title: string; course: string; dueDate: string;
  status: string; grade: number | null; maxGrade: number; weight: string;
}

export interface QuizQuestion {
  id: string; question: string; options: string[];
  correct: number; explanation: string;
}

export interface Quiz {
  id: string; title: string; course: string; difficulty: string;
  questionCount: number; duration: number; bestScore: number | null;
  aiGenerated: boolean; questions: QuizQuestion[];
}

export interface Flashcard {
  id: string; deck: string; front: string; back: string; aiGenerated: boolean;
}

export interface Video {
  id: string; title: string; channel: string; thumbnail: string;
  duration: string; views: string; relevance: number;
  course: string; uploadedAgo: string;
}

export interface StudyTask {
  id: string; title: string; course: string; dueDate: string;
  time: string; duration: number; type: string; completed: boolean;
}

export interface Analytics {
  overallGrade: number; quizAverage: number; studyHours: number;
  assignmentsDone: number; assignmentsTotal: number;
  dayStreak: number; coursesActive: number;
  weeklyProgress: { day: string; hours: number; score: number }[];
  recentQuizScores: { quiz: string; score: number; course: string }[];
  subjectStrengths: { subject: string; score: number; status: string }[];
  radarData: { subject: string; score: number }[];
}

export interface ForumReply {
  id: string; author: string; authorRole: string;
  content: string; timestamp: string;
}

export interface ForumThread {
  id: string; title: string; course: string; author: string;
  authorRole: string; replies: number; views: number;
  tags: string[]; solved: boolean; lastActivity: string;
  content: string; replyList: ForumReply[];
}

export interface Notification {
  id: string; type: string; message: string;
  time: string; read: boolean; urgent: boolean;
}

export interface AdminStats {
  totalStudents: number; lecturers: number; courses: number;
  activeUsers: number; notesUploaded: number; quizzesTaken: number;
}

export interface AdminUser {
  id: string; name: string; email: string; role: string;
  status: string; joined: string; avatar: string;
}

export interface LearningResource {
  id: string;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  title: string;
  resourceType: string;
  ownerUserId?: string | null;
  ownerName?: string;
  createdBy: string;
  visibility: string;
  status: string;
  currentVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface LearningResourceVersion {
  id: string;
  resourceId: string;
  versionNumber: number;
  checksum?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  storageReference?: string | null;
  extractionStatus: string;
  createdBy: string;
  createdAt: string;
  supersededAt?: string | null;
  publishedAt?: string | null;
}

export interface LearningResourceChunk {
  id: string;
  versionId: string;
  ordinal: number;
  text: string;
  tokenCount: number;
  pageNumber: number;
  headingPath: string;
  charStart: number;
  charEnd: number;
  metadata: Record<string, unknown>;
}

export interface LearningResourceIngestResult {
  version: LearningResourceVersion;
  processingJob: {
    id: string;
    versionId: string;
    jobType: string;
    status: string;
    attemptCount: number;
    lastError?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    nextAttemptAt?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  chunks: LearningResourceChunk[];
}

export interface LearningResourceProcessing {
  version: LearningResourceVersion;
  processingJob: LearningResourceIngestResult['processingJob'];
}

export interface User {
  id: string; name: string; email: string; avatar: string;
  role: string; streak?: number; program?: string; year?: number;
  department?: string;
}

export interface AuthResponse {
  user: User;
  message?: string;
}

// ── API Methods ────────────────────────────────────────────────────────────

export const api = {
  // Tutor
  tutor: (data: TutorRequest) =>
    request<TutorResponse>('/ai/tutor', { method: 'POST', body: JSON.stringify(data) }),

  // Courses
  getCourses: () => request<Course[]>('/courses'),
  getMyCourses: () => request<Course[]>('/courses/mine'),
  getCourse: (id: string) => request<Course>(`/courses/${id}`),

  // Notes
  getNotes: (course?: string) =>
    request<Note[]>(course ? `/notes?course=${course}` : '/notes'),

  // Assignments
  getAssignments: (course?: string) =>
    request<Assignment[]>(course ? `/assignments?course=${course}` : '/assignments'),

  // Quizzes
  getQuizzes: (course?: string) =>
    request<Quiz[]>(course ? `/quizzes?course=${course}` : '/quizzes'),
  getQuiz: (id: string) => request<Quiz>(`/quizzes/${id}`),

  // Flashcards
  getFlashcards: (deck?: string) =>
    request<Flashcard[]>(deck ? `/flashcards?deck=${deck}` : '/flashcards'),

  // Videos
  getVideos: (course?: string) =>
    request<Video[]>(course ? `/videos?course=${course}` : '/videos'),

  // Study Plan
  getStudyPlan: () => request<StudyTask[]>('/study-plan'),
  createTask: (task: Omit<StudyTask, 'id' | 'completed'>) =>
    request<StudyTask>('/study-plan', { method: 'POST', body: JSON.stringify(task) }),
  toggleTask: (id: string) =>
    request<StudyTask>(`/study-plan/${id}/toggle`, { method: 'PATCH' }),

  // Analytics
  getAnalytics: () => request<Analytics>('/analytics'),

  // Forum
  getThreads: (course?: string) =>
    request<ForumThread[]>(course ? `/forum?course=${course}` : '/forum'),
  getThread: (id: string) => request<ForumThread>(`/forum/${id}`),
  createThread: (data: { title: string; course: string; author: string; authorRole: string; content: string; tags: string[] }) =>
    request<ForumThread>('/forum', { method: 'POST', body: JSON.stringify(data) }),
  addReply: (threadId: string, data: { author: string; authorRole: string; content: string }) =>
    request<ForumReply>(`/forum/${threadId}/replies`, { method: 'POST', body: JSON.stringify(data) }),

  // Notifications
  getNotifications: () => request<Notification[]>('/notifications'),
  markNotificationRead: (id: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: 'PATCH' }),

  // Learning resources
  getLearningResources: (courseId?: string) =>
    request<LearningResource[]>(courseId ? `/learning-resources?course=${encodeURIComponent(courseId)}` : '/learning-resources'),
  getLearningResource: (id: string) => request<LearningResource>(`/learning-resources/${id}`),
  getLearningResourceVersions: (id: string) => request<LearningResourceVersion[]>(`/learning-resources/${id}/versions`),
  getLearningResourceProcessing: (id: string) => request<LearningResourceProcessing>(`/learning-resources/${id}/processing`),
  uploadLearningResource: async (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    const response = await fetch(`${BASE}/learning-resources/${id}/ingest`, { method: 'POST', body: form, credentials: 'same-origin' });
    if (!response.ok) throw new Error(`API ${response.status}: ${await response.text().catch(() => '')}`);
    return response.json() as Promise<LearningResourceProcessing>;
  },
  retryLearningResourceProcessing: (id: string) =>
    request<LearningResourceProcessing>(`/learning-resources/${id}/retry-processing`, { method: 'POST', body: JSON.stringify({}) }),
  ingestLearningResource: (id: string, payload: { mimeType?: string; filename?: string; content: string }) =>
    request<LearningResourceIngestResult>(`/learning-resources/${id}/ingest`, { method: 'POST', body: JSON.stringify(payload) }),
  createLearningResource: (payload: {
    courseId: string; title: string; resourceType?: string; ownerUserId?: string | null; visibility?: string; status?: string;
  }) => request<LearningResource>('/learning-resources', { method: 'POST', body: JSON.stringify(payload) }),
  updateLearningResource: (id: string, payload: Partial<{
    title: string; courseId: string; resourceType: string; ownerUserId: string | null; visibility: string; status: string; currentVersionId: string | null;
  }>) => request<LearningResource>(`/learning-resources/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // Admin
  getAdminStats: () => request<AdminStats>('/admin/stats'),
  getAdminUsers: (search?: string) =>
    request<AdminUser[]>(search ? `/admin/users?search=${encodeURIComponent(search)}` : '/admin/users'),
  updateUserStatus: (id: string, status: string) =>
    request<AdminUser>(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Auth
  getCurrentUser: () => request<User>('/user/me'),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  register: (data: { name: string; email: string; password: string; role: string }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST', body: JSON.stringify(data),
    }),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
};
