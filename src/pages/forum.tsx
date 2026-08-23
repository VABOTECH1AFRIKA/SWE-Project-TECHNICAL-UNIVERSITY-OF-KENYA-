import { useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Eye, CheckCircle, ArrowLeft, Send, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { mockForumThreads, mockCourses } from '@/lib/mockData';
import { C, CA, courseColors, courseColorAlpha } from '@/lib/colors';

type View = 'list' | 'detail';

export default function DiscussionForum() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>('list');
  const [activeThread, setActiveThread] = useState<(typeof mockForumThreads)[0] | null>(null);
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [replyText, setReplyText] = useState('');
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', details: '', tags: '' });

  const { data: courses = mockCourses } = useQuery({ queryKey: ['courses'], queryFn: api.getCourses });
  const { data: threads = mockForumThreads } = useQuery({ queryKey: ['forum', filterCourse], queryFn: () => api.getThreads(filterCourse === 'all' ? undefined : filterCourse) });

  const replyMutation = useMutation({
    mutationFn: ({ threadId, content }: { threadId: string; content: string }) =>
      api.addReply(threadId, { author: 'Alex Johnson', authorRole: 'student', content }),
    onSuccess: () => { setReplyText(''); qc.invalidateQueries({ queryKey: ['forum'] }); },
  });

  const filtered = threads;

  const openThread = (thread: (typeof mockForumThreads)[0]) => {
    setActiveThread(thread);
    setView('detail');
  };

  if (view === 'detail' && activeThread) {
    return (
      <>
        <Helmet><title>{activeThread.title} — StudyHub AI</title><meta name="description" content="Discussion thread." /><link rel="canonical" href="https://studyhub.ai/forum" /></Helmet>
        <div className="p-6 max-w-4xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
          {/* Back */}
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-2 text-sm mb-6 transition-all"
            style={{ color: C.inkSoft }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to forum
          </button>

          {/* Thread header */}
          <div
            className="rounded-xl p-5 mb-5"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ background: courseColorAlpha[activeThread.course], color: courseColors[activeThread.course] }}
              >
                {activeThread.course}
              </span>
              {activeThread.solved && (
                <span
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium"
                  style={{ background: CA.sage10, color: C.sage }}
                >
                  <CheckCircle className="w-3 h-3" />
                  Solved
                </span>
              )}
              {activeThread.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ background: C.paper, color: C.inkSoft }}
                >
                  #{tag}
                </span>
              ))}
            </div>
            <h1 className="text-xl font-bold mb-3" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
              {activeThread.title}
            </h1>
            <p className="text-sm mb-4" style={{ color: C.inkSoft }}>
              {activeThread.content}
            </p>
            <div className="flex items-center gap-3 text-xs" style={{ color: C.inkSoft }}>
              <span
                className="font-medium"
                style={{ color: activeThread.authorRole === 'lecturer' ? C.teal : C.ink }}
              >
                {activeThread.author}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {activeThread.replies} replies
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {activeThread.views} views
              </span>
              <span>{activeThread.lastActivity}</span>
            </div>
          </div>

          {/* Replies */}
          <div className="space-y-4 mb-6">
            {activeThread.replyList.map((reply) => (
              <div
                key={reply.id}
                className="rounded-xl p-4"
                style={{
                  background: reply.authorRole === 'lecturer' ? CA.teal10 : C.paperRaised,
                  border: `1px solid ${reply.authorRole === 'lecturer' ? C.teal : C.border}`,
                  borderLeft: reply.authorRole === 'lecturer' ? `3px solid ${C.teal}` : `1px solid ${C.border}`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                    style={{ background: reply.authorRole === 'lecturer' ? C.teal : C.inkSoft }}
                  >
                    {reply.author[0]}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: reply.authorRole === 'lecturer' ? C.teal : C.ink }}>
                    {reply.author}
                  </span>
                  {reply.authorRole === 'lecturer' && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ background: CA.teal10, color: C.teal }}
                    >
                      Lecturer
                    </span>
                  )}
                  <span className="text-xs ml-auto" style={{ color: C.inkSoft }}>
                    {reply.timestamp}
                  </span>
                </div>
                <p className="text-sm" style={{ color: C.ink }}>{reply.content}</p>
              </div>
            ))}
          </div>

          {/* Reply input */}
          <div
            className="rounded-xl p-4"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            <p className="text-sm font-semibold mb-3" style={{ color: C.ink }}>Post a Reply</p>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your reply…"
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none mb-3"
              style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}
            />
            <button
              onClick={() => activeThread && replyMutation.mutate({ threadId: activeThread.id, content: replyText })}
              disabled={!replyText.trim() || replyMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
              style={{ background: C.teal, opacity: replyText.trim() ? 1 : 0.5 }}
            >
              <Send className="w-4 h-4" />
              Post Reply
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Discussion Forum — StudyHub AI</title><meta name="description" content="Ask questions, share insights, and connect with classmates and lecturers." /><link rel="canonical" href="https://studyhub.ai/forum" /></Helmet>
      <div className="p-6 max-w-7xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
              Discussion Forum
            </h1>
            <p className="text-sm" style={{ color: C.inkSoft }}>
              Ask questions, share insights, and connect with classmates.
            </p>
          </div>
          <button
            onClick={() => setShowNewPost(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: C.teal }}
          >
            <Plus className="w-4 h-4" />
            New Post
          </button>
        </div>

        {/* Course filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilterCourse('all')}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
            style={{
              background: filterCourse === 'all' ? C.teal : C.paperRaised,
              color: filterCourse === 'all' ? 'white' : C.inkSoft,
              border: `1px solid ${filterCourse === 'all' ? C.teal : C.border}`,
            }}
          >
            All
          </button>
          {courses.map((c) => (
            <button
              key={c.code}
              onClick={() => setFilterCourse(c.code)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: filterCourse === c.code ? courseColors[c.code] : C.paperRaised,
                color: filterCourse === c.code ? 'white' : C.inkSoft,
                border: `1px solid ${filterCourse === c.code ? courseColors[c.code] : C.border}`,
              }}
            >
              {c.code}
            </button>
          ))}
        </div>

        {/* Thread list */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${C.border}` }}
        >
          {filtered.map((thread, i) => (
            <button
              key={thread.id}
              onClick={() => openThread(thread)}
              className="w-full text-left px-5 py-4 transition-all hover:bg-background"
              style={{
                background: C.paperRaised,
                borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none',
              }}
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ background: courseColorAlpha[thread.course], color: courseColors[thread.course] }}
                >
                  {thread.course}
                </span>
                {thread.solved && (
                  <span
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium"
                    style={{ background: CA.sage10, color: C.sage }}
                  >
                    <CheckCircle className="w-3 h-3" />
                    Solved
                  </span>
                )}
                {thread.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-xs px-1.5 py-0.5 rounded" style={{ background: C.paper, color: C.inkSoft }}>
                    #{tag}
                  </span>
                ))}
              </div>
              <p className="text-sm font-semibold mb-1.5" style={{ color: C.ink }}>
                {thread.title}
              </p>
              <div className="flex items-center gap-3 text-xs" style={{ color: C.inkSoft }}>
                <span
                  className="font-medium"
                  style={{ color: thread.authorRole === 'lecturer' ? C.teal : C.inkSoft }}
                >
                  {thread.author}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {thread.replies}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {thread.views}
                </span>
                <span className="ml-auto">{thread.lastActivity}</span>
              </div>
            </button>
          ))}
        </div>

        {/* New Post Modal */}
        {showNewPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
            <div
              className="w-full max-w-md rounded-2xl p-6 shadow-xl"
              style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
                  New Post
                </h2>
                <button onClick={() => setShowNewPost(false)} style={{ color: C.inkSoft }}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>Title</label>
                  <input
                    type="text"
                    value={newPost.title}
                    onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                    placeholder="What's your question?"
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>Details</label>
                  <textarea
                    value={newPost.details}
                    onChange={(e) => setNewPost({ ...newPost, details: e.target.value })}
                    placeholder="Provide more context…"
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none"
                    style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>Tags (comma separated)</label>
                  <input
                    type="text"
                    value={newPost.tags}
                    onChange={(e) => setNewPost({ ...newPost, tags: e.target.value })}
                    placeholder="e.g. trees, algorithms"
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNewPost(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: C.paper, color: C.inkSoft, border: `1px solid ${C.border}` }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowNewPost(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: C.teal }}
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
