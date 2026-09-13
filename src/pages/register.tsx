import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { GraduationCap, ArrowLeft, User, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { api } from '@/lib/api';
import { C, CA } from '@/lib/colors';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'student', program: '', year: '1' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) { setError('All fields are required.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const data = await api.register({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      });

      localStorage.removeItem('studyhub_user');
      sessionStorage.removeItem('studyhub_user');

      const role = data.user.role;
      if (role === 'admin') navigate('/admin');
      else if (role === 'lecturer') navigate('/lecturer');
      else navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message.includes('API ') ? message.replace(/^API \d+:\s*/, '') : message);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Create Account — StudyHub AI</title>
        <meta name="description" content="Create your StudyHub AI account and start learning smarter." />
        <link rel="canonical" href="https://studyhub.ai/register" />
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ background: C.paper, fontFamily: 'var(--font-sans)' }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}`, background: C.paperRaised }}>
          <Link to="/login" className="flex items-center gap-2 text-sm transition-all" style={{ color: C.inkSoft }}>
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.teal }}>
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>StudyHub AI</span>
          </div>
        </div>

        {/* Card */}
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-2xl p-8 shadow-sm" style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}>
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
              Create your account
            </h1>
            <p className="text-sm mb-6" style={{ color: C.inkSoft }}>Join StudyHub AI and start learning smarter.</p>

            {error && (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: CA.coral10, color: C.coral }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full name */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>Full name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.inkSoft }} />
                  <input type="text" value={form.name} onChange={set('name')} placeholder="Your full name" required
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none"
                    style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>University email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.inkSoft }} />
                  <input type="email" value={form.email} onChange={set('email')} placeholder="you@university.edu" required
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none"
                    style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }} />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>Role</label>
                <select value={form.role} onChange={set('role')}
                  className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none"
                  style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}>
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                </select>
              </div>

              {/* Program (students only) */}
              {form.role === 'student' && (
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>Program / Major</label>
                  <input type="text" value={form.program} onChange={set('program')} placeholder="e.g. Computer Science"
                    className="w-full px-4 py-2.5 rounded-lg text-sm focus:outline-none"
                    style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }} />
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.inkSoft }} />
                  <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Min. 6 characters" required
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm focus:outline-none"
                    style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: C.inkSoft }}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.inkSoft }} />
                  <input type="password" value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="••••••••" required
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none"
                    style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }} />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
                style={{ background: C.teal, opacity: loading ? 0.8 : 1 }}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account…</> : 'Create account'}
              </button>
            </form>

            <p className="text-sm text-center mt-6" style={{ color: C.inkSoft }}>
              Already have an account?{' '}
              <Link to="/login" className="font-medium" style={{ color: C.teal }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
