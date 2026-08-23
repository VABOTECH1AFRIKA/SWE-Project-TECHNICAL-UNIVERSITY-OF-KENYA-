import { Helmet } from '@dr.pogodin/react-helmet';
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { BarChart2, Brain, Clock, CheckCircle2, Flame, BookOpen } from 'lucide-react';
import { mockAnalytics, mockUser } from '@/lib/mockData';
import { C, CA } from '@/lib/colors';

export default function ProgressAnalytics() {
  const stats = [
    { label: 'Overall Grade', value: `${mockAnalytics.overallGrade}%`, icon: BarChart2, color: C.teal },
    { label: 'Quiz Average', value: `${mockAnalytics.quizAverage}%`, icon: Brain, color: C.highlighter },
    { label: 'Study Hours', value: `${mockAnalytics.studyHours}h`, icon: Clock, color: C.sage },
    { label: 'Assignments Done', value: `${mockAnalytics.assignmentsDone}/${mockAnalytics.assignmentsTotal}`, icon: CheckCircle2, color: C.sage },
    { label: 'Day Streak 🔥', value: `${mockUser.streak}`, icon: Flame, color: C.coral },
    { label: 'Courses Active', value: `${mockAnalytics.coursesActive}`, icon: BookOpen, color: C.teal },
  ];

  const statusColor = (s: string) =>
    s === 'strong' ? C.sage : s === 'needs-work' ? C.coral : C.highlighter;
  const statusBg = (s: string) =>
    s === 'strong' ? CA.sage10 : s === 'needs-work' ? CA.coral10 : CA.highlighter15;
  const statusLabel = (s: string) =>
    s === 'strong' ? 'Strong' : s === 'needs-work' ? 'Needs Work' : 'Average';

  return (
    <>
      <Helmet><title>Progress Analytics — StudyHub AI</title><meta name="description" content="Track your learning progress, quiz scores, and identify areas for improvement." /><link rel="canonical" href="https://studyhub.ai/analytics" /></Helmet>
      <div className="p-6 max-w-7xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
            Progress Analytics
          </h1>
          <p className="text-sm" style={{ color: C.inkSoft }}>
            Track your learning journey and identify areas for improvement.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {stats.map((s) => (
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
              <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: C.ink }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* Weekly Score Trend */}
          <div
            className="rounded-xl p-5"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: C.ink }}>
              Weekly Score Trend
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={mockAnalytics.weeklyProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--sh-border))" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'hsl(var(--sh-ink-soft))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--sh-ink-soft))' }} axisLine={false} tickLine={false} domain={[50, 100]} />
                <Tooltip contentStyle={{ background: C.paperRaised, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--sh-teal))" strokeWidth={2} dot={{ fill: 'hsl(var(--sh-teal))', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Quiz Scores */}
          <div
            className="rounded-xl p-5"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: C.ink }}>
              Recent Quiz Scores
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={mockAnalytics.recentQuizScores}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--sh-border))" />
                <XAxis dataKey="quiz" tick={{ fontSize: 10, fill: 'hsl(var(--sh-ink-soft))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--sh-ink-soft))' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: C.paperRaised, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="score" fill="hsl(var(--sh-teal))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Subject Strengths */}
          <div
            className="rounded-xl p-5"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: C.ink }}>
              Strengths & Areas to Improve
            </h2>
            <div className="space-y-4">
              {mockAnalytics.subjectStrengths.map((s) => (
                <div key={s.subject}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium" style={{ color: C.ink }}>{s.subject}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: statusColor(s.status) }}>
                        {s.score}%
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: statusBg(s.status), color: statusColor(s.status) }}
                      >
                        {statusLabel(s.status)}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: C.paper }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${s.score}%`, background: statusColor(s.status) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Competency Radar */}
          <div
            className="rounded-xl p-5"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: C.ink }}>
              Competency Radar
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={mockAnalytics.radarData}>
                <PolarGrid stroke="hsl(var(--sh-border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'hsl(var(--sh-ink-soft))' }} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="hsl(var(--sh-teal))"
                  fill="hsl(var(--sh-teal))"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Tooltip contentStyle={{ background: C.paperRaised, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
