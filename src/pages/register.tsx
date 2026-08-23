import { Link } from 'react-router';
import { GraduationCap, ArrowLeft } from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { C, CA } from '@/lib/colors';

export default function Register() {
  return (
    <>
      <Helmet>
        <title>Create Account — StudyHub AI</title>
        <meta name="description" content="Create your StudyHub AI account." />
        <link rel="canonical" href="https://studyhub.ai/register" />
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ background: C.paper, fontFamily: 'var(--font-sans)' }}>
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${C.border}`, background: C.paperRaised }}
        >
          <Link to="/login" className="flex items-center gap-2 text-sm transition-all" style={{ color: C.inkSoft }}>
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
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

        {/* Card */}
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div
            className="w-full max-w-md rounded-2xl p-8 shadow-sm"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <h1
              className="text-3xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-heading)', color: C.ink }}
            >
              Create your account
            </h1>
            <p className="text-sm mb-6" style={{ color: C.inkSoft }}>
              Join StudyHub AI and start learning smarter.
            </p>

            {/* Yellow info banner */}
            <div
              className="rounded-xl px-4 py-3 mb-6 text-sm font-medium"
              style={{ background: CA.highlighter20, color: C.highlighterText }}
            >
              Account creation is a placeholder — use demo login instead.{' '}
              <Link to="/login" className="underline font-semibold">
                Sign in here
              </Link>
            </div>

            <div className="space-y-4">
              {/* Full name */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>
                  Full name
                </label>
                <input
                  type="text"
                  disabled
                  placeholder="Your full name"
                  className="w-full px-4 py-2.5 rounded-lg text-sm cursor-not-allowed"
                  style={{
                    background: C.paper,
                    border: `1px dashed ${C.borderStrong}`,
                    color: C.inkSoft,
                  }}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>
                  University email
                </label>
                <input
                  type="email"
                  disabled
                  placeholder="you@university.edu"
                  className="w-full px-4 py-2.5 rounded-lg text-sm cursor-not-allowed"
                  style={{
                    background: C.paper,
                    border: `1px dashed ${C.borderStrong}`,
                    color: C.inkSoft,
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>
                  Password
                </label>
                <input
                  type="password"
                  disabled
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-lg text-sm cursor-not-allowed"
                  style={{
                    background: C.paper,
                    border: `1px dashed ${C.borderStrong}`,
                    color: C.inkSoft,
                  }}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>
                  Role
                </label>
                <select
                  disabled
                  className="w-full px-4 py-2.5 rounded-lg text-sm cursor-not-allowed"
                  style={{
                    background: C.paper,
                    border: `1px dashed ${C.borderStrong}`,
                    color: C.inkSoft,
                  }}
                >
                  <option>Student</option>
                  <option>Lecturer</option>
                </select>
              </div>

              {/* Disabled submit */}
              <button
                disabled
                className="w-full py-3 rounded-lg text-sm font-semibold text-white cursor-not-allowed opacity-50"
                style={{ background: C.teal }}
              >
                Create account
              </button>
            </div>

            <p className="text-sm text-center mt-6" style={{ color: C.inkSoft }}>
              Already have an account?{' '}
              <Link to="/login" className="font-medium" style={{ color: C.teal }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
