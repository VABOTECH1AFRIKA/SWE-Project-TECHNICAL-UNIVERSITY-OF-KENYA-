import { Link } from 'react-router';
import { GraduationCap, ArrowLeft, LogIn, UserPlus, Users, BookOpen, Shield } from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { C, CA } from '@/lib/colors';

export default function GetStarted() {
  return (
    <>
      <Helmet>
        <title>Get Started — StudyHub AI</title>
        <meta name="description" content="Choose how to access StudyHub AI — sign in to your existing account or create a new one." />
        <link rel="canonical" href="https://studyhub.ai/get-started" />
      </Helmet>

      <div className="min-h-screen" style={{ background: C.paper, fontFamily: 'var(--font-sans)' }}>
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${C.border}`, background: C.paperRaised }}
        >
          <Link
            to="/"
            className="flex items-center gap-2 text-sm transition-all"
            style={{ color: C.inkSoft }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.teal }}>
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
              StudyHub AI
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <span
              className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full mb-4"
              style={{ background: CA.teal10, color: C.teal }}
            >
              Welcome
            </span>
            <h1
              className="text-4xl font-bold mb-3"
              style={{ fontFamily: 'var(--font-heading)', color: C.ink }}
            >
              Let's get you <span className="highlighter-underline">started</span>
            </h1>
            <p className="text-base" style={{ color: C.inkSoft }}>
              Sign in to your existing account or create a new one to begin your AI-powered learning journey.
            </p>
          </div>

          {/* Sign in / Register cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            <Link
              to="/login"
              className="flex flex-col items-center gap-4 p-8 rounded-2xl transition-all hover:shadow-md"
              style={{ background: C.paperRaised, border: `2px solid ${C.teal}` }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: CA.teal10 }}
              >
                <LogIn className="w-7 h-7" style={{ color: C.teal }} />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg mb-1" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
                  Sign in
                </p>
                <p className="text-sm" style={{ color: C.inkSoft }}>
                  Already have an account? Sign in to continue.
                </p>
              </div>
            </Link>

            <Link
              to="/register"
              className="flex flex-col items-center gap-4 p-8 rounded-2xl transition-all hover:shadow-md"
              style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: CA.sage10 }}
              >
                <UserPlus className="w-7 h-7" style={{ color: C.sage }} />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg mb-1" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
                  Create account
                </p>
                <p className="text-sm" style={{ color: C.inkSoft }}>
                  New to StudyHub AI? Create your account.
                </p>
              </div>
            </Link>
          </div>

          {/* Roles preview */}
          <div className="mb-8">
            <p className="text-sm font-semibold mb-4 text-center" style={{ color: C.inkSoft }}>
              Available roles
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { icon: Users, title: 'Student', desc: 'Access AI tutoring, quizzes, flashcards, and analytics.', color: C.teal },
                { icon: BookOpen, title: 'Lecturer', desc: 'Upload materials, manage courses, and track engagement.', color: C.sage },
                { icon: Shield, title: 'Administrator', desc: 'Manage users, courses, and platform settings.', color: C.coral },
              ].map((r) => (
                <div
                  key={r.title}
                  className="rounded-xl p-4"
                  style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: r.color + '18' }}
                  >
                    <r.icon className="w-4 h-4" style={{ color: r.color }} />
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: C.ink }}>{r.title}</p>
                  <p className="text-xs" style={{ color: C.inkSoft }}>{r.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div
            className="rounded-xl px-4 py-3 text-sm text-center"
            style={{ background: CA.highlighter15, color: C.ink }}
          >
            This is a UI prototype — role selection appears after authentication in the full build.
          </div>
        </div>
      </div>
    </>
  );
}
