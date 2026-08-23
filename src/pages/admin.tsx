import { admin } from 'virtual:content';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Users, BookOpen, Settings, Search, MoreHorizontal, Brain } from 'lucide-react';
import { api } from '@/lib/api';
import { mockAdminStats, mockAdminUsers, mockCourses } from '@/lib/mockData';
import { C, CA, courseColors, courseColorAlpha } from '@/lib/colors';

type TabId = 'users' | 'courses' | 'settings';

const roleConfig: Record<string, { color: string; bg: string }> = {
  student: { color: C.teal, bg: CA.teal10 },
  lecturer: { color: C.sage, bg: CA.sage10 },
  admin: { color: C.coral, bg: CA.coral10 },
};

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userSearch, setUserSearch] = useState('');

  const { data: adminStats = mockAdminStats } = useQuery({ queryKey: ['admin-stats'], queryFn: api.getAdminStats });
  const { data: adminUsers = mockAdminUsers } = useQuery({ queryKey: ['admin-users', userSearch], queryFn: () => api.getAdminUsers(userSearch || undefined) });
  const { data: courses = mockCourses } = useQuery({ queryKey: ['courses'], queryFn: api.getCourses });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateUserStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const activeTab: TabId =
    location.pathname === '/admin/users' ? 'users'
    : location.pathname === '/admin/courses' ? 'courses'
    : location.pathname === '/admin/settings' ? 'settings'
    : 'users';

  const toggleStatus = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    statusMutation.mutate({ id, status: newStatus });
  };

  const filteredUsers = adminUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const stats = [
    { label: 'Total Students', value: adminStats.totalStudents, color: C.teal },
    { label: 'Lecturers', value: adminStats.lecturers, color: C.sage },
    { label: 'Courses', value: adminStats.courses, color: C.coral },
    { label: 'Active Users', value: adminStats.activeUsers, color: C.teal },
    { label: 'Notes Uploaded', value: adminStats.notesUploaded, color: C.highlighter },
    { label: 'Quizzes Taken', value: adminStats.quizzesTaken.toLocaleString(), color: C.sage },
  ];

  return (
    <>
      <Helmet><title>Admin Dashboard — StudyHub AI</title><meta name="description" content="Platform-wide user, course, and system management for administrators." /><link rel="canonical" href="https://studyhub.ai/admin" /></Helmet>
      <div className="p-6 max-w-7xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: CA.coral10 }}
          >
            <Shield className="w-5 h-5" style={{ color: C.coral }} />
          </div>
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
              Admin Dashboard
            </h1>
            <p className="text-sm" style={{ color: C.inkSoft }}>
              Platform-wide management and oversight.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-4"
              style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
            >
              <p className="text-xs font-medium mb-2" style={{ color: C.inkSoft }}>{s.label}</p>
              <p
                className="text-2xl font-bold"
                style={{ fontFamily: 'var(--font-mono)', color: s.color }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl mb-6 w-fit"
          style={{ background: C.paper, border: `1px solid ${C.border}` }}
        >
          {admin.tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.id ? C.paperRaised : 'transparent',
                color: activeTab === tab.id ? C.ink : C.inkSoft,
                boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {activeTab === 'users' && (
          <div>
            <div className="mb-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.inkSoft }} />
                <input
                  type="text"
                  placeholder="Search users…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ background: C.paperRaised, border: `1px solid ${C.border}`, color: C.ink }}
                />
              </div>
            </div>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${C.border}` }}
            >
              {/* Table header */}
              <div
                className="grid grid-cols-5 px-5 py-3 text-xs font-semibold"
                style={{ background: C.paper, color: C.inkSoft, borderBottom: `1px solid ${C.border}` }}
              >
                <span className="col-span-2">Name / Email</span>
                <span>Role</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {filteredUsers.map((user, i) => {
                const rc = roleConfig[user.role] || roleConfig.student;
                const status = user.status;
                return (
                  <div
                    key={user.id}
                    className="grid grid-cols-5 items-center px-5 py-4 transition-all hover:bg-background"
                    style={{
                      background: C.paperRaised,
                      borderBottom: i < filteredUsers.length - 1 ? `1px solid ${C.border}` : 'none',
                    }}
                  >
                    {/* Name + email */}
                    <div className="col-span-2 flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                        style={{ background: rc.color }}
                      >
                        {user.avatar}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: C.ink }}>{user.name}</p>
                        <p className="text-xs truncate" style={{ color: C.inkSoft }}>{user.email}</p>
                      </div>
                    </div>
                    {/* Role */}
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium w-fit capitalize"
                      style={{ background: rc.bg, color: rc.color }}
                    >
                      {user.role}
                    </span>
                    {/* Status */}
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium w-fit capitalize"
                      style={{
                        background: status === 'active' ? CA.sage10 : CA.coral10,
                        color: status === 'active' ? C.sage : C.coral,
                      }}
                    >
                      {status}
                    </span>
                    {/* Actions */}
                    <button
                      onClick={() => toggleStatus(user.id, status)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all w-fit"
                      style={{
                        background: status === 'active' ? CA.coral10 : CA.sage10,
                        color: status === 'active' ? C.coral : C.sage,
                      }}
                    >
                      {status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Courses tab */}
        {activeTab === 'courses' && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: `1px solid ${C.border}` }}
          >
            {courses.map((course, i) => (
              <div
                key={course.id}
                className="flex items-center gap-4 px-5 py-4 transition-all hover:bg-background"
                style={{
                  background: C.paperRaised,
                  borderBottom: i < courses.length - 1 ? `1px solid ${C.border}` : 'none',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: courseColorAlpha[course.code] }}
                >
                  <BookOpen className="w-5 h-5" style={{ color: courseColors[course.code] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: C.ink }}>
                    {course.code} — {course.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: C.inkSoft }}>
                    {course.lecturer} · {course.notesCount} notes
                  </p>
                </div>
                <button className="p-2 rounded-lg transition-all hover:bg-background" style={{ color: C.inkSoft }}>
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Settings tab */}
        {activeTab === 'settings' && (
          <div>
            <div
              className="rounded-xl p-5 mb-5"
              style={{ background: CA.highlighter15, border: `1px solid ${C.highlighter}` }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: C.highlighterText }}>
                System Settings — Placeholder
              </p>
              <p className="text-sm" style={{ color: C.ink }}>
                These settings are placeholders. Backend integration is required to make them functional.
              </p>
            </div>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${C.border}` }}
            >
              {[
                { icon: Brain, label: 'AI Provider', desc: 'Configure the AI model and API keys for tutoring and quiz generation.' },
                { icon: Users, label: 'Email Settings', desc: 'SMTP configuration for transactional emails and notifications.' },
                { icon: BookOpen, label: 'File Storage', desc: 'Configure cloud storage for lecture notes and course materials.' },
                { icon: Shield, label: 'Auth Settings', desc: 'Authentication providers, session duration, and security policies.' },
                { icon: Settings, label: 'Platform Maintenance', desc: 'Scheduled maintenance, backups, and system health monitoring.' },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className="flex items-center gap-4 px-5 py-4 transition-all hover:bg-background"
                  style={{
                    background: C.paperRaised,
                    borderBottom: i < 4 ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: CA.teal10 }}
                  >
                    <s.icon className="w-5 h-5" style={{ color: C.teal }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: C.ink }}>{s.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: C.inkSoft }}>{s.desc}</p>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium flex-shrink-0"
                    style={{ background: CA.highlighter15, color: C.highlighterText }}
                  >
                    Placeholder
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
