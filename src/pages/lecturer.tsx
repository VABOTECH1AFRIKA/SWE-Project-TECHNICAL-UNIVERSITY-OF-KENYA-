import { Helmet } from '@dr.pogodin/react-helmet';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { BookOpen, Upload, Users, FileText, Star, Brain } from 'lucide-react';
import { mockLecturer, mockCourses } from '@/lib/mockData';
import { C, CA, courseColors, courseColorAlpha } from '@/lib/colors';

const engagementData = mockCourses.map((c) => ({
  course: c.code,
  students: Math.floor(Math.random() * 80 + 20),
  engagement: Math.floor(Math.random() * 40 + 50),
}));

export default function LecturerDashboard() {
  return (
    <>
      <Helmet><title>Lecturer Dashboard — StudyHub AI</title><meta name="description" content="Manage your courses, upload materials, and track student engagement." /><link rel="canonical" href="https://studyhub.ai/lecturer" /></Helmet>
      <div className="p-6 max-w-7xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
            Welcome, Dr. <span className="highlighter-underline">Mitchell</span>
          </h1>
          <p className="text-sm" style={{ color: C.inkSoft }}>
            {mockLecturer.department}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'My Courses', value: mockCourses.length, icon: BookOpen, color: C.teal },
            { label: 'Notes Uploaded', value: 39, icon: FileText, color: C.sage },
            { label: 'Total Students', value: 247, icon: Users, color: C.coral },
            { label: 'Pending Grades', value: 12, icon: Star, color: C.highlighter },
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
              <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: C.ink }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Two-column */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          {/* My Courses list */}
          <div
            className="lg:col-span-2 rounded-xl"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <h2 className="text-base font-semibold" style={{ color: C.ink }}>My Courses</h2>
            </div>
            {mockCourses.map((course, i) => (
              <div
                key={course.id}
                className="flex items-center gap-4 px-5 py-4 transition-all hover:bg-background"
                style={{ borderBottom: i < mockCourses.length - 1 ? `1px solid ${C.border}` : 'none' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: courseColorAlpha[course.code] }}
                >
                  <BookOpen className="w-5 h-5" style={{ color: courseColors[course.code] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: C.ink }}>{course.code} — {course.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.inkSoft }}>
                    {course.notesCount} notes · {course.assignmentsCount} assignments
                  </p>
                </div>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: CA.teal10, color: C.teal }}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                </button>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div
            className="rounded-xl p-5"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: C.ink }}>Quick Actions</h2>
            <div className="space-y-3">
              {[
                { icon: Upload, label: 'Upload Course Material', color: C.teal },
                { icon: Brain, label: 'Generate Quiz from Notes', color: C.sage },
                { icon: Users, label: 'View Student Progress', color: C.coral },
                { icon: FileText, label: 'Grade Assignments', color: C.highlighter },
              ].map((a) => (
                <button
                  key={a.label}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all hover:shadow-sm"
                  style={{ background: C.paper, color: C.ink, border: `1px solid ${C.border}` }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: a.color + '18' }}
                  >
                    <a.icon className="w-4 h-4" style={{ color: a.color }} />
                  </div>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Engagement Chart */}
        <div
          className="rounded-xl p-5"
          style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
        >
          <h2 className="text-base font-semibold mb-4" style={{ color: C.ink }}>
            Student Engagement by Course
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--sh-border))" />
              <XAxis dataKey="course" tick={{ fontSize: 12, fill: 'hsl(var(--sh-ink-soft))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--sh-ink-soft))' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: C.paperRaised, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
              <Legend />
              <Bar dataKey="students" name="Students" fill="hsl(var(--sh-teal))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="engagement" name="Engagement %" fill="hsl(var(--sh-highlighter))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
