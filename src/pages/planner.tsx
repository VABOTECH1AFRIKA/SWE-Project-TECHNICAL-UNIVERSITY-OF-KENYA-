import { useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Plus, CheckCircle2, Circle, BookOpen, Pencil, Play, Layers, X } from 'lucide-react';
import { mockStudyPlan, mockCourses } from '@/lib/mockData';
import { C, CA } from '@/lib/colors';

type TaskType = 'study' | 'assignment' | 'video' | 'quiz';

interface Task {
  id: string;
  title: string;
  course: string;
  dueDate: string;
  time: string;
  duration: number;
  type: TaskType;
  completed: boolean;
}

const typeConfig: Record<TaskType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  study: { icon: BookOpen, color: C.teal, bg: CA.teal10, label: 'Study' },
  assignment: { icon: Pencil, color: C.highlighter, bg: CA.highlighter15, label: 'Assignment' },
  video: { icon: Play, color: C.coral, bg: CA.coral10, label: 'Video' },
  quiz: { icon: Layers, color: C.sage, bg: CA.sage10, label: 'Quiz' },
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function StudyPlanner() {
  const [tasks, setTasks] = useState<Task[]>(mockStudyPlan as Task[]);
  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    course: mockCourses[0].code,
    type: 'study' as TaskType,
    time: '09:00',
    duration: 60,
    dueDate: new Date().toISOString().split('T')[0],
  });

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const addTask = () => {
    if (!newTask.title.trim()) return;
    const task: Task = {
      id: `sp${Date.now()}`,
      ...newTask,
      completed: false,
    };
    setTasks((prev) => [...prev, task]);
    setShowModal(false);
    setNewTask({ title: '', course: mockCourses[0].code, type: 'study', time: '09:00', duration: 60, dueDate: new Date().toISOString().split('T')[0] });
  };

  const completed = tasks.filter((t) => t.completed).length;
  const progress = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;

  const typeCounts = Object.keys(typeConfig).map((type) => ({
    type: type as TaskType,
    count: tasks.filter((t) => t.type === type).length,
  }));

  return (
    <>
      <Helmet><title>Study Planner — StudyHub AI</title><meta name="description" content="Organize your study sessions, assignments, and deadlines in one place." /><link rel="canonical" href="https://studyhub.ai/planner" /></Helmet>
      <div className="p-6 max-w-7xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
              Study Planner
            </h1>
            <p className="text-sm" style={{ color: C.inkSoft }}>
              Organize your study sessions and deadlines.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: C.teal }}
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>

        {/* Progress card */}
        <div
          className="rounded-xl p-5 mb-6"
          style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold" style={{ color: C.ink }}>
              This Week's Progress
            </h2>
            <span className="text-sm font-bold" style={{ color: C.teal, fontFamily: 'var(--font-mono)' }}>
              {completed}/{tasks.length} tasks
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: C.paper }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: C.teal }}
            />
          </div>
          <div className="flex flex-wrap gap-4">
            {typeCounts.map(({ type, count }) => {
              const cfg = typeConfig[type];
              const Icon = cfg.icon;
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: cfg.bg }}>
                    <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                  </div>
                  <span className="text-xs" style={{ color: C.inkSoft }}>
                    {count} {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Week view (desktop) */}
        <div className="hidden lg:grid grid-cols-7 gap-2 mb-6">
          {DAYS.map((day) => (
            <div
              key={day}
              className="rounded-xl p-3 min-h-[80px]"
              style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
            >
              <p className="text-xs font-semibold mb-2 text-center" style={{ color: C.inkSoft }}>
                {day}
              </p>
              <div className="space-y-1">
                {tasks.filter((t) => {
                  const d = new Date(t.dueDate);
                  return DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1] === day;
                }).slice(0, 2).map((t) => {
                  const cfg = typeConfig[t.type];
                  return (
                    <div
                      key={t.id}
                      className="text-xs px-1.5 py-1 rounded truncate"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {t.title}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Task list */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${C.border}` }}
        >
          {tasks.map((task, i) => {
            const cfg = typeConfig[task.type];
            const Icon = cfg.icon;
            return (
              <div
                key={task.id}
                className="flex items-center gap-4 px-5 py-4 transition-all hover:bg-background"
                style={{
                  background: C.paperRaised,
                  borderBottom: i < tasks.length - 1 ? `1px solid ${C.border}` : 'none',
                  opacity: task.completed ? 0.6 : 1,
                }}
              >
                <button onClick={() => toggleTask(task.id)} className="flex-shrink-0">
                  {task.completed
                    ? <CheckCircle2 className="w-5 h-5" style={{ color: C.teal }} />
                    : <Circle className="w-5 h-5" style={{ color: C.border }} />
                  }
                </button>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.bg }}
                >
                  <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color: C.ink,
                      textDecoration: task.completed ? 'line-through' : 'none',
                    }}
                  >
                    {task.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: C.inkSoft }}>
                    {task.course} · {task.time} · {task.duration} min · Due {task.dueDate}
                  </p>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium flex-shrink-0"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Add Task Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
            <div
              className="w-full max-w-md rounded-2xl p-6 shadow-xl"
              style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
                  Add Task
                </h2>
                <button onClick={() => setShowModal(false)} style={{ color: C.inkSoft }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>Title</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Task title"
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>Course</label>
                    <select
                      value={newTask.course}
                      onChange={(e) => setNewTask({ ...newTask, course: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                      style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}
                    >
                      {mockCourses.map((c) => (
                        <option key={c.code} value={c.code}>{c.code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>Type</label>
                    <select
                      value={newTask.type}
                      onChange={(e) => setNewTask({ ...newTask, type: e.target.value as TaskType })}
                      className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                      style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}
                    >
                      <option value="study">Study</option>
                      <option value="assignment">Assignment</option>
                      <option value="video">Video</option>
                      <option value="quiz">Quiz</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>Time</label>
                    <input
                      type="time"
                      value={newTask.time}
                      onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                      style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>Duration (min)</label>
                    <input
                      type="number"
                      value={newTask.duration}
                      onChange={(e) => setNewTask({ ...newTask, duration: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                      style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: C.ink }}>Due Date</label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ background: C.paper, border: `1px solid ${C.border}`, color: C.ink }}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: C.paper, color: C.inkSoft, border: `1px solid ${C.border}` }}
                >
                  Cancel
                </button>
                <button
                  onClick={addTask}
                  disabled={!newTask.title.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                  style={{ background: C.teal, opacity: newTask.title.trim() ? 1 : 0.5 }}
                >
                  Add Task
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
