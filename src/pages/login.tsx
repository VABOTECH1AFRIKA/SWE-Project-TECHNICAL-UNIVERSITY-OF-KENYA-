import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { GraduationCap, ArrowLeft, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { C, CA } from '@/lib/colors';

export default function MockLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => navigate('/dashboard'), 700);
  };

  return (
    <>
      <Helmet>
        <title>Sign In — StudyHub AI</title>
        <meta name="description" content="Sign in to your StudyHub AI account." />
        <link rel="canonical" href="https://studyhub.ai/login" />
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ background: C.paper, fontFamily: 'var(--font-sans)' }}>
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${C.border}`, background: C.paperRaised }}
        >
          <Link to="/get-started" className="flex items-center gap-2 text-sm transition-all" style={{ color: C.inkSoft }}>
            <ArrowLeft className="w-4 h-4" />
            Back
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
              Welcome <span className="highlighter-underline">back</span>
            </h1>
            <p className="text-sm mb-8" style={{ color: C.inkSoft }}>
              Sign in to continue your learning journey.
            </p>

            {/* Demo note */}
            <div
              className="rounded-xl px-4 py-3 mb-6 text-sm"
              style={{ background: CA.teal10, color: C.teal }}
            >
              Demo: any email & password will sign you in as <strong>Alex Johnson (Student)</strong>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.inkSoft }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@university.edu"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none"
                    style={{
                      background: C.paper,
                      border: `1px solid ${C.border}`,
                      color: C.ink,
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.inkSoft }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm focus:outline-none"
                    style={{
                      background: C.paper,
                      border: `1px solid ${C.border}`,
                      color: C.ink,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: C.inkSoft }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: C.inkSoft }}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded"
                  />
                  Remember me
                </label>
                <button type="button" className="text-sm" style={{ color: C.teal }}>
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
                style={{ background: C.teal, opacity: loading ? 0.8 : 1 }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <p className="text-sm text-center mt-6" style={{ color: C.inkSoft }}>
              Don't have an account?{' '}
              <Link to="/register" className="font-medium" style={{ color: C.teal }}>
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
