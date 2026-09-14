import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { api } from '@/lib/api';
import {
  Home,
  BookOpen,
  Brain,
  Layers,
  BookMarked,
  Youtube,
  CalendarDays,
  BarChart2,
  MessageSquare,
  GraduationCap,
  Bell,
  Search,
  Menu,
  X,
  Settings,
  LogOut,
  Flame,
  Shield,
  Users,
  BookCopy,
  TrendingUp,
} from 'lucide-react';
import { mockUser, mockLecturer, mockNotifications } from '@/lib/mockData';
import { C, CA } from '@/lib/colors';

type Role = 'student' | 'lecturer' | 'admin';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const studentNav: NavItem[] = [
  { icon: Home, label: 'Dashboard', path: '/dashboard' },
  { icon: BookOpen, label: 'Course Materials', path: '/courses' },
  { icon: Brain, label: 'AI Tutor', path: '/ai-tutor' },
  { icon: Layers, label: 'Quizzes', path: '/quizzes' },
  { icon: BookMarked, label: 'Flashcards', path: '/flashcards' },
  { icon: Youtube, label: 'Video Recommendations', path: '/videos' },
  { icon: CalendarDays, label: 'Study Planner', path: '/planner' },
  { icon: BarChart2, label: 'Progress Analytics', path: '/analytics' },
  { icon: MessageSquare, label: 'Discussion Forum', path: '/forum' },
];

const lecturerNav: NavItem[] = [
  { icon: Home, label: 'Dashboard', path: '/lecturer' },
  { icon: BookCopy, label: 'My Courses', path: '/lecturer/courses' },
  { icon: TrendingUp, label: 'Student Engagement', path: '/lecturer/engagement' },
];

const adminNav: NavItem[] = [
  { icon: Shield, label: 'Dashboard', path: '/admin' },
  { icon: Users, label: 'Manage Users', path: '/admin/users' },
  { icon: BookOpen, label: 'Manage Courses', path: '/admin/courses' },
  { icon: Settings, label: 'System Settings', path: '/admin/settings' },
];

function getNav(role: Role): NavItem[] {
  if (role === 'lecturer') return lecturerNav;
  if (role === 'admin') return adminNav;
  return studentNav;
}

interface DashboardLayoutProps {
  role: Role;
}

export default function DashboardLayout({ role }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');

  const nav = getNav(role);
  const user =
    role === 'lecturer'
      ? mockLecturer
      : role === 'admin'
      ? { name: 'Admin User', avatar: 'AD', role: 'admin' }
      : mockUser;
  const unreadCount = mockNotifications.filter((n) => !n.read).length;

  const isActive = (item: NavItem) =>
    location.pathname === item.path ||
    (item.path !== '/dashboard' &&
      item.path !== '/lecturer' &&
      item.path !== '/admin' &&
      location.pathname.startsWith(item.path));

  const roleBadgeColor =
    role === 'student' ? C.teal : role === 'lecturer' ? C.sage : C.coral;
  const roleBadgeAlpha =
    role === 'student' ? CA.teal10 : role === 'lecturer' ? CA.sage10 : CA.coral10;
  const roleLabel =
    role === 'student' ? 'Student' : role === 'lecturer' ? 'Lecturer' : 'Administrator';

  const SidebarContent = () => (
    <aside
      className="flex flex-col h-full w-64"
      style={{ background: C.paperRaised, borderRight: `1px solid ${C.border}` }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-5 py-5"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: C.teal }}
        >
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <span
          className="text-lg font-bold"
          style={{ fontFamily: 'var(--font-heading)', color: C.ink }}
        >
          Study<span className="highlighter-underline">Hub</span> AI
        </span>
      </div>

      {/* User info */}
      <div className="px-4 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
            style={{ background: roleBadgeColor }}
          >
            {user.avatar}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: C.ink }}>
              {user.name}
            </p>
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{ background: roleBadgeAlpha, color: roleBadgeColor }}
            >
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {nav.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className="sidebar-active flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all"
              style={{
                background: active ? CA.teal10 : 'transparent',
                color: active ? C.teal : C.inkSoft,
                fontWeight: active ? 600 : 400,
              }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Streak badge (students only) */}
      {role === 'student' && (
        <div className="px-4 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: CA.coral10 }}
          >
            <Flame className="w-4 h-4" style={{ color: C.coral }} />
            <span className="text-sm font-semibold" style={{ color: C.coral }}>
              {mockUser.streak} day streak
            </span>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="px-2 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
        <button
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-sm transition-all hover:bg-background"
          style={{ color: C.inkSoft }}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
        <button
          onClick={async () => {
            try {
              await api.logout();
            } finally {
              localStorage.removeItem('studyhub_user');
              sessionStorage.removeItem('studyhub_user');
              navigate('/');
            }
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-sm transition-all hover:bg-background"
          style={{ color: C.inkSoft }}
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col w-64 flex-shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-black/30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col lg:hidden transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          className="h-16 flex items-center px-4 gap-3 flex-shrink-0"
          style={{
            background: C.paperRaised,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          {/* Hamburger */}
          <button
            className="lg:hidden p-2 rounded-lg transition-all hover:bg-background"
            style={{ color: C.inkSoft }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: C.inkSoft }}
            />
            <input
              type="text"
              placeholder="Search notes, quizzes, topics…"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none bg-background"
              style={{
                border: `1px solid ${C.border}`,
                color: C.ink,
              }}
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                }}
                className="relative p-2 rounded-lg transition-all hover:bg-background"
                style={{ color: C.inkSoft }}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span
                    className="absolute top-1 right-1 w-4 h-4 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                    style={{ background: C.coral }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-80 rounded-xl shadow-lg z-50"
                  style={{
                    background: C.paperRaised,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <div className="px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                    <p className="font-semibold text-sm" style={{ color: C.ink }}>
                      Notifications
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {mockNotifications.map((n) => (
                      <div
                        key={n.id}
                        className="px-4 py-3"
                        style={{
                          borderBottom: `1px solid ${C.border}`,
                          background: !n.read ? CA.teal10 : 'transparent',
                        }}
                      >
                        <p className="text-sm" style={{ color: n.urgent ? C.coral : C.ink }}>
                          {n.message}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: C.inkSoft }}>
                          {n.time}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
