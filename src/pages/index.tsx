import { Link } from 'react-router';
import { GraduationCap, Brain, Layers, BookMarked, BarChart2, CalendarDays, MessageSquare, ArrowRight, Quote, CheckCircle, Zap, Users, BookOpen } from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { C, CA } from '@/lib/colors';

export default function LandingPage() {
  return (
    <>
      <Helmet>
        <title>StudyHub AI — Intelligent University Learning Platform</title>
        <meta name="description" content="Turn lecture notes into personalized quizzes, flashcards, AI tutoring, and progress analytics. The intelligent learning platform for university students." />
        <link rel="canonical" href="https://studyhub.ai/" />
      </Helmet>

      <div className="min-h-screen" style={{ background: C.paper, fontFamily: 'var(--font-sans)' }}>
        {/* Sticky Nav */}
        <nav
          className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto"
          style={{ background: C.paper }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.teal }}>
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
              Study<span className="highlighter-underline">Hub</span> AI
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium transition-all" style={{ color: C.inkSoft }}>
              Sign in
            </Link>
            <Link
              to="/get-started"
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
              style={{ background: C.teal }}
            >
              Get Started
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div>
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-6"
                style={{ background: CA.teal10, color: C.teal }}
              >
                <Zap className="w-3 h-3" />
                AI-powered learning
              </span>
              <h1
                className="text-4xl lg:text-5xl font-bold leading-tight mb-5"
                style={{ fontFamily: 'var(--font-heading)', color: C.ink }}
              >
                Your personal{' '}
                <span className="highlighter-underline">AI tutor</span>{' '}
                for university success
              </h1>
              <p className="text-lg mb-8 leading-relaxed" style={{ color: C.inkSoft }}>
                Turn lecture notes, slides, and assignments into personalized quizzes, flashcards, and intelligent tutoring. Study smarter, not harder.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                <Link
                  to="/get-started"
                  className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold text-white transition-all"
                  style={{ background: C.teal }}
                >
                  Get started free
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/login"
                  className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: C.paperRaised, color: C.ink, border: `1px solid ${C.border}` }}
                >
                  See how it works
                </Link>
              </div>
              <div className="flex flex-wrap gap-4">
                {['No credit card required', 'Free for students', 'AI-powered'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-sm" style={{ color: C.inkSoft }}>
                    <CheckCircle className="w-4 h-4" style={{ color: C.sage }} />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — mock AI chat card */}
            <div className="relative">
              {/* Blur orbs */}
              <div
                className="absolute -top-8 -right-8 w-48 h-48 rounded-full blur-3xl opacity-30"
                style={{ background: C.teal }}
              />
              <div
                className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full blur-3xl opacity-20"
                style={{ background: C.highlighter }}
              />

              <div
                className="relative rounded-2xl p-5 shadow-xl"
                style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
              >
                {/* Chat header */}
                <div className="flex items-center gap-3 mb-4 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: CA.teal10 }}>
                    <Brain className="w-4 h-4" style={{ color: C.teal }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: C.ink }}>AI Tutor</p>
                    <p className="text-xs" style={{ color: C.sage }}>● Online · CS301</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-3 mb-4">
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: CA.teal10 }}>
                      <Brain className="w-3 h-3" style={{ color: C.teal }} />
                    </div>
                    <div className="rounded-xl rounded-tl-sm px-3 py-2 text-xs max-w-[80%]" style={{ background: C.paper, color: C.ink }}>
                      Hello Alex! What would you like to explore in Data Structures today?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="rounded-xl rounded-tr-sm px-3 py-2 text-xs text-white max-w-[80%]" style={{ background: C.teal }}>
                      Can you explain BFS vs DFS?
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: CA.teal10 }}>
                      <Brain className="w-3 h-3" style={{ color: C.teal }} />
                    </div>
                    <div className="rounded-xl rounded-tl-sm px-3 py-2 text-xs max-w-[80%]" style={{ background: C.paper, color: C.ink }}>
                      <strong>BFS</strong> explores level by level (queue), while <strong>DFS</strong> goes deep first (stack). Both are O(V+E)!
                    </div>
                  </div>
                </div>

                {/* Input */}
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: C.paper, border: `1px solid ${C.border}` }}
                >
                  <span className="text-xs flex-1" style={{ color: C.inkSoft }}>Ask anything about your courses…</span>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: C.teal }}>
                    <ArrowRight className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <section style={{ background: C.teal }}>
          <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { value: '1,200+', label: 'Students' },
              { value: '48', label: 'Lecturers' },
              { value: '92', label: 'Courses' },
              { value: '12K+', label: 'Quizzes generated' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p
                  className="text-3xl font-bold text-white mb-1"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {s.value}
                </p>
                <p className="text-sm" style={{ color: 'hsl(var(--sh-teal) / 0.7)', filter: 'brightness(1.8)' }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Features grid */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2
              className="text-3xl font-bold mb-3"
              style={{ fontFamily: 'var(--font-heading)', color: C.ink }}
            >
              Everything you need to <span className="highlighter-underline">ace your degree</span>
            </h2>
            <p className="text-base" style={{ color: C.inkSoft }}>
              Six powerful tools, one intelligent platform.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Brain, title: 'AI Tutor', desc: 'Ask questions about your course materials and get instant, contextual explanations.', color: C.teal },
              { icon: Layers, title: 'AI Quizzes', desc: 'Auto-generated quizzes from your lecture notes with instant feedback and explanations.', color: C.sage },
              { icon: BookMarked, title: 'Flashcards', desc: '3D flip flashcard decks with spaced repetition to maximize retention.', color: C.coral },
              { icon: BarChart2, title: 'Analytics', desc: 'Track your progress, identify weak areas, and visualize your learning journey.', color: C.teal },
              { icon: CalendarDays, title: 'Study Planner', desc: 'Organize your study sessions, assignments, and deadlines in one place.', color: C.highlighter },
              { icon: MessageSquare, title: 'Discussion Forum', desc: 'Connect with classmates and lecturers to discuss course topics and get help.', color: C.sage },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl p-5 transition-all hover:shadow-md cursor-default"
                style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: f.color + '18' }}
                >
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="font-semibold mb-2" style={{ color: C.ink }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: C.inkSoft }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Roles section */}
        <section className="max-w-6xl mx-auto px-6 py-12">
          <div className="text-center mb-10">
            <h2
              className="text-3xl font-bold mb-3"
              style={{ fontFamily: 'var(--font-heading)', color: C.ink }}
            >
              Built for everyone in the classroom
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: Users,
                title: 'Students',
                color: C.teal,
                items: ['AI-powered tutoring', 'Auto-generated quizzes', 'Progress analytics', 'Study planner'],
              },
              {
                icon: BookOpen,
                title: 'Lecturers',
                color: C.sage,
                items: ['Upload course materials', 'Track student engagement', 'Manage assignments', 'View analytics'],
              },
              {
                icon: GraduationCap,
                title: 'Administrators',
                color: C.coral,
                items: ['Platform-wide oversight', 'User management', 'Course management', 'System settings'],
              },
            ].map((r) => (
              <div
                key={r.title}
                className="rounded-xl p-6 transition-all hover:shadow-md"
                style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: r.color + '18' }}
                >
                  <r.icon className="w-6 h-6" style={{ color: r.color }} />
                </div>
                <h3 className="text-lg font-bold mb-3" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
                  {r.title}
                </h3>
                <ul className="space-y-2">
                  {r.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm" style={{ color: C.inkSoft }}>
                      <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: r.color }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                quote: "StudyHub AI completely changed how I study. The AI tutor explains concepts from my actual lecture notes — it's like having a personal tutor available 24/7.",
                name: 'Priya S.',
                role: 'CS Year 2',
              },
              {
                quote: "The auto-generated quizzes save me hours of prep time. My students are more engaged and I can see exactly where they're struggling.",
                name: 'Dr. Mitchell',
                role: 'Lecturer, Computer Science',
              },
            ].map((t) => (
              <div
                key={t.name}
                className="rounded-xl p-6"
                style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
              >
                <Quote className="w-8 h-8 mb-4" style={{ color: C.highlighter }} />
                <p
                  className="text-lg leading-relaxed mb-5"
                  style={{ fontFamily: 'var(--font-heading)', color: C.ink }}
                >
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                    style={{ background: C.teal }}
                  >
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: C.ink }}>{t.name}</p>
                    <p className="text-xs" style={{ color: C.inkSoft }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA block */}
        <section className="max-w-6xl mx-auto px-6 py-12">
          <div
            className="relative rounded-3xl px-8 py-16 text-center overflow-hidden"
            style={{ background: C.teal }}
          >
            {/* Blur orbs */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20" style={{ background: C.highlighter }} />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-3xl opacity-20" style={{ background: C.paperRaised }} />
            <div className="relative">
              <h2
                className="text-3xl lg:text-4xl font-bold text-white mb-4"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Ready to study smarter?
              </h2>
              <p className="text-base mb-8 opacity-80 text-white">
                Join 1,200+ students already using StudyHub AI to ace their degrees.
              </p>
              <Link
                to="/get-started"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: C.paperRaised, color: C.teal }}
              >
                Get started free
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer
          className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: C.teal }}>
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
              StudyHub AI
            </span>
          </div>
          <p className="text-xs text-center" style={{ color: C.inkSoft }}>
            © 2026 StudyHub AI · UI Prototype — AI/backend integration pending
          </p>
        </footer>
      </div>
    </>
  );
}
