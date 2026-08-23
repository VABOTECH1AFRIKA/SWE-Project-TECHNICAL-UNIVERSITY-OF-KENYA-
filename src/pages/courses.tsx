import { useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Eye, CheckCircle2, Clock, AlertCircle, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { mockCourses, mockNotes, mockAssignments } from '@/lib/mockData';
import { C, CA, courseColors, courseColorAlpha } from '@/lib/colors';

type Tab = 'notes' | 'assignments';

const statusConfig = {
  submitted: { label: 'Submitted', color: C.teal, bg: CA.teal10 },
  pending: { label: 'Pending', color: C.inkSoft, bg: 'hsl(var(--sh-ink-soft) / 0.1)' },
  overdue: { label: 'Overdue', color: C.coral, bg: CA.coral10 },
  graded: { label: 'Graded', color: C.sage, bg: CA.sage10 },
};

export default function CourseMaterials() {
  const [activeCourse, setActiveCourse] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<Tab>('notes');
  const [search, setSearch] = useState('');

  const { data: courses = mockCourses } = useQuery({ queryKey: ['courses'], queryFn: api.getCourses });
  const { data: notes = mockNotes } = useQuery({ queryKey: ['notes'], queryFn: () => api.getNotes() });
  const { data: assignments = mockAssignments } = useQuery({ queryKey: ['assignments'], queryFn: () => api.getAssignments() });

  const filteredNotes = notes.filter(
    (n) =>
      (activeCourse === 'all' || n.course === activeCourse) &&
      n.title.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAssignments = assignments.filter(
    (a) => activeCourse === 'all' || a.course === activeCourse
  );

  return (
    <>
      <Helmet>
        <title>Course Materials — StudyHub AI</title>
        <meta name="description" content="Access your lecture notes, slides, and assignments for all courses." />
        <link rel="canonical" href="https://studyhub.ai/courses" />
      </Helmet>
      <div className="p-6 max-w-7xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
            Course Materials
          </h1>
          <p className="text-sm" style={{ color: C.inkSoft }}>
            Access your lecture notes, slides, and assignments.
          </p>
        </div>

        {/* Course filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCourse('all')}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
            style={{
              background: activeCourse === 'all' ? C.teal : C.paperRaised,
              color: activeCourse === 'all' ? 'white' : C.inkSoft,
              border: `1px solid ${activeCourse === 'all' ? C.teal : C.border}`,
            }}
          >
            All Courses
          </button>
          {courses.map((c) => (
            <button
              key={c.code}
              onClick={() => setActiveCourse(c.code)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: activeCourse === c.code ? courseColors[c.code] : C.paperRaised,
                color: activeCourse === c.code ? 'white' : C.inkSoft,
                border: `1px solid ${activeCourse === c.code ? courseColors[c.code] : C.border}`,
              }}
            >
              {c.code}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl mb-6 w-fit"
          style={{ background: C.paper, border: `1px solid ${C.border}` }}
        >
          {(['notes', 'assignments'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
              style={{
                background: activeTab === tab ? C.paperRaised : 'transparent',
                color: activeTab === tab ? C.ink : C.inkSoft,
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {tab === 'notes' ? 'Notes & Slides' : 'Assignments'}
            </button>
          ))}
        </div>

        {/* Notes tab */}
        {activeTab === 'notes' && (
          <div>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-sm px-4 py-2 rounded-lg text-sm focus:outline-none"
                style={{
                  background: C.paperRaised,
                  border: `1px solid ${C.border}`,
                  color: C.ink,
                }}
              />
            </div>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${C.border}` }}
            >
              {filteredNotes.length === 0 ? (
                <div className="p-8 text-center" style={{ color: C.inkSoft }}>
                  No notes found.
                </div>
              ) : (
                filteredNotes.map((note, i) => (
                  <div
                    key={note.id}
                    className="flex items-center gap-4 px-5 py-4 transition-all hover:bg-background"
                    style={{
                      background: C.paperRaised,
                      borderBottom: i < filteredNotes.length - 1 ? `1px solid ${C.border}` : 'none',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: courseColorAlpha[note.course] }}
                    >
                      <FileText className="w-5 h-5" style={{ color: courseColors[note.course] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: C.ink }}>
                        {note.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: C.inkSoft }}>
                        {note.course} · {note.pages} pages · {note.size} · {note.date}
                      </p>
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium flex-shrink-0"
                      style={{ background: courseColorAlpha[note.course], color: courseColors[note.course] }}
                    >
                      {note.type}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ background: CA.teal10, color: C.teal }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                      <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ background: C.paper, color: C.inkSoft, border: `1px solid ${C.border}` }}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Assignments tab */}
        {activeTab === 'assignments' && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: `1px solid ${C.border}` }}
          >
            {filteredAssignments.map((a, i) => {
              const sc = statusConfig[a.status as keyof typeof statusConfig];
              return (
                <div
                  key={a.id}
                  className="flex flex-col md:flex-row md:items-center gap-4 px-5 py-4 transition-all hover:bg-background"
                  style={{
                    background: C.paperRaised,
                    borderBottom: i < filteredAssignments.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: courseColorAlpha[a.course] }}
                  >
                    <BookOpen className="w-5 h-5" style={{ color: courseColors[a.course] }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: C.ink }}>{a.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: C.inkSoft }}>
                      {a.course} · Due {a.dueDate} · Weight {a.weight}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {a.grade !== null && (
                      <span className="text-sm font-bold" style={{ color: C.teal, fontFamily: 'var(--font-mono)' }}>
                        {a.grade}/{a.maxGrade}
                      </span>
                    )}
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: sc.bg, color: sc.color }}
                    >
                      {sc.label}
                    </span>
                    {a.status === 'overdue' && <AlertCircle className="w-4 h-4" style={{ color: C.coral }} />}
                    {a.status === 'submitted' && <CheckCircle2 className="w-4 h-4" style={{ color: C.teal }} />}
                    {a.status === 'pending' && <Clock className="w-4 h-4" style={{ color: C.inkSoft }} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
