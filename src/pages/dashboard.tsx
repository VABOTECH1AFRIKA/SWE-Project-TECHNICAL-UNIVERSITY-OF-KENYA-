import { Link } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Brain, Layers, BookMarked, BarChart2, Flame, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { mockUser, mockCourses, mockAnalytics, mockAssignments } from '@/lib/mockData';
import { C, CA, courseColors } from '@/lib/colors';

export default function StudentDashboard() {
  const upcomingDeadlines = mockAssignments.slice(0, 3);

  return (
    <>
      <Helmet>
        <title>Dashboard — StudyHub AI</title>
        <meta name="description" content="Your personal learning hub — track progress, view courses, and access AI tutoring." />
        <link rel="canonical" href="https://studyhub.ai/dashboard" />
      </Helmet>
      <div className="p-6 max-w-7xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
        {/* Welcome */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
              Good morning, <span className="highlighter-underline">{mockUser.name.split(' ')[0]}</span> 👋
            </h1>
            <p className="text-sm" style={{ color: C.inkSoft }}>
              {mockUser.program} · Year {mockUser.year}
            </p>
          </div>
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl self-start"
            style={{ background: CA.coral10 }}
          >
            <Flame className="w-4 h-4" style={{ color: C.coral }} />
            <span className="text-sm font-semibold" style={{ color: C.coral }}>
              {mockUser.streak} day streak
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Overall Grade', value: `${mockAnalytics.overallGrade}%`, color: C.teal, icon: BarChart2 },
            { label: 'Study Hours', value: `${mockAnalytics.studyHours}h`, color: C.sage, icon: Clock },
            { label: 'Quiz Average', value: `${mockAnalytics.quizAverage}%`, color: C.highlighter, icon: Layers },
            { label: 'Assignments Done', value: `${mockAnalytics.assignmentsDone}/${mockAnalytics.assignmentsTotal}`, color: C.sage, icon: CheckCircle2 },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-4"
              style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium" style={{ color: C.inkSoft }}>{s.label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.color + '18' }}>
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
              </div>
              <p
                className="text-2xl font-bold"
                style={{ fontFamily: 'var(--font-mono)', color: C.ink }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Two-column: chart + deadlines */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          {/* Weekly progress chart */}
          <div
            className="lg:col-span-2 rounded-xl p-5"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: C.ink }}>
              Weekly Progress
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={mockAnalytics.weeklyProgress}>
                <defs>
                  <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--sh-teal))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--sh-teal))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--sh-border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--sh-ink-soft))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--sh-ink-soft))' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: C.paperRaised,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--sh-teal))"
                  strokeWidth={2}
                  fill="url(#tealGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Upcoming deadlines */}
          <div
            className="rounded-xl p-5"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: C.ink }}>
              Upcoming Deadlines
            </h2>
            <div className="space-y-3">
              {upcomingDeadlines.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 p-3 rounded-lg"
                  style={{ background: C.paper }}
                >
                  <AlertCircle
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    style={{ color: a.status === 'overdue' ? C.coral : C.inkSoft }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: C.ink }}>
                      {a.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: a.status === 'overdue' ? C.coral : C.inkSoft }}>
                      {a.course} · {a.status === 'overdue' ? 'Overdue' : `Due ${a.dueDate}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* My Courses */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
            My Courses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {mockCourses.map((course) => (
              <Link
                key={course.id}
                to={`/courses/${course.id}`}
                className="rounded-xl p-4 transition-all hover:shadow-md"
                style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: courseColors[course.code] + '18' }}
                >
                  <BookMarked className="w-5 h-5" style={{ color: courseColors[course.code] }} />
                </div>
                <p className="text-xs font-semibold mb-0.5" style={{ color: courseColors[course.code] }}>
                  {course.code}
                </p>
                <p className="text-sm font-semibold mb-3 leading-snug" style={{ color: C.ink }}>
                  {course.title}
                </p>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.paper }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${course.progress}%`, background: courseColors[course.code] }}
                  />
                </div>
                <p className="text-xs mt-1.5" style={{ color: C.inkSoft }}>
                  {course.progress}% complete
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Brain, label: 'Ask AI Tutor', path: '/ai-tutor', color: C.teal },
              { icon: Layers, label: 'Take a Quiz', path: '/quizzes', color: C.sage },
              { icon: BookMarked, label: 'Study Flashcards', path: '/flashcards', color: C.coral },
              { icon: BarChart2, label: 'View Analytics', path: '/analytics', color: C.highlighter },
            ].map((a) => (
              <Link
                key={a.label}
                to={a.path}
                className="flex flex-col items-center gap-3 p-5 rounded-xl text-center transition-all hover:shadow-md"
                style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: a.color + '18' }}
                >
                  <a.icon className="w-6 h-6" style={{ color: a.color }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: C.ink }}>{a.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
