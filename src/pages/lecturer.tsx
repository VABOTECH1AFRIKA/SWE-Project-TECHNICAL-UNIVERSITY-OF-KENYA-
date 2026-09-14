import { Helmet } from '@dr.pogodin/react-helmet';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { BookOpen, Upload, Users, FileText, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { C, CA, courseColors, courseColorAlpha } from '@/lib/colors';

export default function LecturerDashboard() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [resourceType, setResourceType] = useState('document');
  const [visibility, setVisibility] = useState('course');
  const [status, setStatus] = useState('draft');
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: courses = [] } = useQuery({ queryKey: ['courses'], queryFn: api.getCourses });
  const { data: resources = [] } = useQuery({ queryKey: ['learning-resources'], queryFn: () => api.getLearningResources() });

  const resourceMutation = useMutation({
    mutationFn: (payload: { courseId: string; title: string; resourceType?: string; visibility?: string; status?: string }) =>
      api.createLearningResource(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning-resources'] });
      setTitle('');
      if (courses[0]) setCourseId(courses[0].id);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => api.uploadLearningResource(id, file),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ['learning-resources'] });
      qc.invalidateQueries({ queryKey: ['learning-resource-processing', variables.id] });
      setSelectedFile(null);
    },
  });

  const { data: processing } = useQuery({
    queryKey: ['learning-resource-processing', selectedResourceId],
    queryFn: () => api.getLearningResourceProcessing(selectedResourceId),
    enabled: Boolean(selectedResourceId),
  });

  const engagementData = useMemo(
    () => (courses ?? []).map((c) => ({
      course: c.code,
      students: Math.floor(Math.random() * 80 + 20),
      engagement: Math.floor(Math.random() * 40 + 50),
    })),
    [courses],
  );

  const myResources = resources.filter((resource) => resource.createdBy || resource.ownerUserId);
  const resourceStats = [
    { label: 'My Courses', value: courses.length, icon: BookOpen, color: C.teal },
    { label: 'Resource Metadata', value: myResources.length, icon: FileText, color: C.sage },
    { label: 'Published', value: myResources.filter((r) => r.status === 'published').length, icon: Users, color: C.coral },
    { label: 'Drafts', value: myResources.filter((r) => r.status === 'draft').length, icon: Star, color: C.highlighter },
  ];

  return (
    <>
      <Helmet><title>Lecturer Dashboard — StudyHub AI</title><meta name="description" content="Manage your courses, upload materials, and track student engagement." /><link rel="canonical" href="https://studyhub.ai/lecturer" /></Helmet>
      <div className="p-6 max-w-7xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
            Lecturer Console
          </h1>
          <p className="text-sm" style={{ color: C.inkSoft }}>
            Metadata control for learning resources, course visibility, and publication workflow.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {resourceStats.map((s) => (
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          <div
            className="lg:col-span-2 rounded-xl"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <h2 className="text-base font-semibold" style={{ color: C.ink }}>Course Resource Registry</h2>
            </div>
            {myResources.length === 0 && (
              <div className="px-5 py-6 text-sm" style={{ color: C.inkSoft }}>
                No resource metadata has been created yet. Add a new draft item to start the publication workflow.
              </div>
            )}
            {myResources.map((resource, i) => (
              <div
                key={resource.id}
                className="flex items-center gap-4 px-5 py-4 transition-all hover:bg-background"
                style={{ borderBottom: i < myResources.length - 1 ? `1px solid ${C.border}` : 'none' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: courseColorAlpha[resource.courseCode ?? 'CS'] ?? CA.teal10 }}
                >
                  <BookOpen className="w-5 h-5" style={{ color: courseColors[resource.courseCode ?? 'CS'] ?? C.teal }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: C.ink }}>{resource.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.inkSoft }}>
                    {resource.courseCode ?? resource.courseTitle ?? 'Course'} · {resource.resourceType} · {resource.visibility} · {resource.status}
                  </p>
                </div>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: CA.teal10, color: C.teal }}
                  onClick={() => resourceMutation.mutate({
                    courseId: resource.courseId,
                    title: `${resource.title} (copy)`,
                    resourceType: resource.resourceType,
                    visibility: resource.visibility,
                    status: 'draft',
                  })}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Clone
                </button>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl p-5"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: C.ink }}>Create Resource Metadata</h2>
            <div className="space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resource title" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }} />
              <select value={(courseId || courses[0]?.id) ?? ''} onChange={(e) => setCourseId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <select value={resourceType} onChange={(e) => setResourceType(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}>
                  <option value="document">Document</option>
                  <option value="video">Video</option>
                  <option value="slide">Slide</option>
                  <option value="reading">Reading</option>
                </select>
                <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}>
                  <option value="course">Course</option>
                  <option value="private">Private</option>
                  <option value="institution">Institution</option>
                </select>
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              <button
                className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all"
                style={{ background: CA.teal10, color: C.teal }}
                disabled={!courseId || !title || resourceMutation.isPending}
                onClick={() => resourceMutation.mutate({ courseId, title, resourceType, visibility, status })}
              >
                {resourceMutation.isPending ? 'Creating…' : 'Save resource metadata'}
              </button>
              <div className="pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: C.inkSoft }} htmlFor="resource-upload">Upload content</label>
                <select id="resource-upload-resource" value={selectedResourceId} onChange={(e) => setSelectedResourceId(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm mb-2" style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}>
                  <option value="">Choose a resource</option>
                  {myResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.title}</option>)}
                </select>
                <input id="resource-upload" type="file" accept=".txt,.md,.markdown,.pdf,.docx,.pptx" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} className="w-full text-xs" />
                {selectedFile && <p className="text-xs mt-1.5" style={{ color: C.inkSoft }}>{selectedFile.name}</p>}
                <button
                  className="w-full mt-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: C.teal, color: 'white' }}
                  disabled={!selectedResourceId || !selectedFile || uploadMutation.isPending}
                  onClick={() => selectedFile && uploadMutation.mutate({ id: selectedResourceId, file: selectedFile })}
                >
                  {uploadMutation.isPending ? 'Uploading…' : 'Upload and process'}
                </button>
                {processing && <p className="text-xs mt-2" style={{ color: processing.processingJob.status === 'failed' ? C.coral : C.inkSoft }}>
                  {processing.processingJob.status === 'completed' ? 'Processing complete' : `Processing ${processing.processingJob.status}`}
                </p>}
                {processing?.processingJob.status === 'failed' && (
                  <button className="w-full mt-2 px-4 py-2 rounded-xl text-xs font-medium" style={{ background: CA.coral10, color: C.coral }} onClick={() => api.retryLearningResourceProcessing(selectedResourceId).then(() => qc.invalidateQueries({ queryKey: ['learning-resource-processing', selectedResourceId] }))}>
                    Retry processing
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

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
