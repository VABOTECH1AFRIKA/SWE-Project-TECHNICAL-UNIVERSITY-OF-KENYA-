import { RouteObject } from 'react-router';
import { lazy, Suspense } from 'react';
import DashboardLayout from './layouts/DashboardLayout';

import LandingPage from './pages/index';
import ProdNotFoundPage from './pages/_404';

const NotFoundPage = ProdNotFoundPage;

const GetStarted = lazy(() => import('./pages/get-started'));
const MockLogin = lazy(() => import('./pages/login'));
const Register = lazy(() => import('./pages/register'));
const StudentDashboard = lazy(() => import('./pages/dashboard'));
const CourseMaterials = lazy(() => import('./pages/courses'));
const AiTutor = lazy(() => import('./pages/ai-tutor'));
const Quizzes = lazy(() => import('./pages/quizzes'));
const Flashcards = lazy(() => import('./pages/flashcards'));
const VideoRecommendations = lazy(() => import('./pages/videos'));
const StudyPlanner = lazy(() => import('./pages/planner'));
const ProgressAnalytics = lazy(() => import('./pages/analytics'));
const DiscussionForum = lazy(() => import('./pages/forum'));
const LecturerDashboard = lazy(() => import('./pages/lecturer'));
const AdminDashboard = lazy(() => import('./pages/admin'));

const Spin = () => (
  <div className="flex items-center justify-center h-64">
    <div
      className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
      style={{ borderColor: 'hsl(var(--sh-teal))', borderTopColor: 'transparent' }}
    />
  </div>
);

const S = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<Spin />}>{children}</Suspense>
);

export const routes: RouteObject[] = [
  // Public pages
  { path: '/', element: <LandingPage /> },
  { path: '/get-started', element: <S><GetStarted /></S> },
  { path: '/login', element: <S><MockLogin /></S> },
  { path: '/register', element: <S><Register /></S> },

  // Student layout
  {
    element: <DashboardLayout role="student" />,
    children: [
      { path: '/dashboard', element: <S><StudentDashboard /></S> },
      { path: '/courses', element: <S><CourseMaterials /></S> },
      { path: '/courses/:id', element: <S><CourseMaterials /></S> },
      { path: '/ai-tutor', element: <S><AiTutor /></S> },
      { path: '/quizzes', element: <S><Quizzes /></S> },
      { path: '/flashcards', element: <S><Flashcards /></S> },
      { path: '/videos', element: <S><VideoRecommendations /></S> },
      { path: '/planner', element: <S><StudyPlanner /></S> },
      { path: '/analytics', element: <S><ProgressAnalytics /></S> },
      { path: '/forum', element: <S><DiscussionForum /></S> },
    ],
  },

  // Lecturer layout
  {
    element: <DashboardLayout role="lecturer" />,
    children: [
      { path: '/lecturer', element: <S><LecturerDashboard /></S> },
      { path: '/lecturer/courses', element: <S><CourseMaterials /></S> },
      { path: '/lecturer/engagement', element: <S><ProgressAnalytics /></S> },
    ],
  },

  // Admin layout
  {
    element: <DashboardLayout role="admin" />,
    children: [
      { path: '/admin', element: <S><AdminDashboard /></S> },
      { path: '/admin/users', element: <S><AdminDashboard /></S> },
      { path: '/admin/courses', element: <S><AdminDashboard /></S> },
      { path: '/admin/settings', element: <S><AdminDashboard /></S> },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
];

export type Path = '/' | '/dashboard' | '/courses' | '/ai-tutor' | '/quizzes' | '/flashcards' | '/videos' | '/planner' | '/analytics' | '/forum' | '/lecturer' | '/admin';
export type Params = Record<string, string | undefined>;
