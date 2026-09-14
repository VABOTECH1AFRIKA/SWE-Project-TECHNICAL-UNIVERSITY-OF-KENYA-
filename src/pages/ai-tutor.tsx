import { ai_tutor } from 'virtual:content';
import { useState, useRef, useEffect } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Brain, Send, Paperclip, ChevronDown } from 'lucide-react';
import { mockCourses } from '@/lib/mockData';
import { C, CA, courseColors } from '@/lib/colors';
import { api } from '@/lib/api';
import type { TutorCitation, TutorMode } from '@/lib/tutor-contract';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: TutorCitation[];
  groundingStatus?: string;
}

function renderContent(text: string) {
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function AiTutor() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState('');
  const [conversationId, setConversationId] = useState<string>();
  const [selectedCourse, setSelectedCourse] = useState(mockCourses[0].id);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const course = mockCourses.find((c) => c.id === selectedCourse) || mockCourses[0];

  useEffect(() => {
    setConversationId(undefined);
  }, [selectedCourse]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = {
      id: `u${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);
    setError('');
    try {
      const response = await api.tutor({ message: text, courseId: selectedCourse, conversationId, mode: 'explain' as TutorMode });
      setConversationId(response.conversationId);
      setTyping(false);
      const aiMsg: Message = {
        id: `a${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: response.citations,
        groundingStatus: response.groundingStatus,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setTyping(false);
      setError('The Tutor is unavailable right now. Please try again.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      <Helmet>
        <title>AI Tutor — StudyHub AI</title>
        <meta name="description" content="Chat with your AI tutor for instant, contextual help on your course materials." />
        <link rel="canonical" href="https://studyhub.ai/ai-tutor" />
      </Helmet>
      <div
        className="flex flex-col"
        style={{ height: 'calc(100vh - 64px)', fontFamily: 'var(--font-sans)' }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between flex-shrink-0"
          style={{ background: C.paperRaised, borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: CA.teal10 }}
            >
              <Brain className="w-5 h-5" style={{ color: C.teal }} />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
                AI Tutor
              </h1>
              <p className="text-xs" style={{ color: C.coral }}>
                Grounded course support
              </p>
            </div>
          </div>

          {/* Course selector */}
          <div className="relative">
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-lg text-sm font-medium focus:outline-none"
              style={{
                background: C.paper,
                border: `1px solid ${C.border}`,
                color: C.ink,
              }}
            >
              {mockCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: C.inkSoft }} />
          </div>
        </div>

        {/* Context badge */}
        <div
          className="px-6 py-2 flex items-center gap-2 flex-shrink-0"
          style={{ background: CA.teal10 }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: courseColors[course.code] }}
          />
          <p className="text-xs font-medium" style={{ color: C.teal }}>
            Context: {course.code} {course.title} · {course.notesCount} notes loaded
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                  style={{ background: CA.teal10 }}
                >
                  <Brain className="w-4 h-4" style={{ color: C.teal }} />
                </div>
              )}
              <div
                className="max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                style={
                  msg.role === 'user'
                    ? { background: C.teal, color: 'white', borderBottomRightRadius: 4 }
                    : { background: C.paperRaised, color: C.ink, border: `1px solid ${C.border}`, borderBottomLeftRadius: 4 }
                }
              >
                {renderContent(msg.content)}
                {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 pt-2 text-xs" style={{ borderTop: `1px solid ${C.border}`, color: C.inkSoft }}>
                    {msg.citations.map((citation) => (
                      <div key={citation.sourceId}>Source: {citation.title ?? citation.sourceId}{citation.locator ? ` · ${citation.locator}` : ''}</div>
                    ))}
                  </div>
                )}
                {msg.role === 'assistant' && msg.groundingStatus === 'insufficient_sources' && (
                  <p className="mt-2 text-xs" style={{ color: C.coral }}>Insufficient authorized course material was found for a reliable citation.</p>
                )}
                <p
                  className="text-xs mt-1.5 opacity-60"
                  style={{ color: msg.role === 'user' ? 'white' : C.inkSoft }}
                >
                  {msg.timestamp}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {typing && (
            <div className="flex gap-3 justify-start">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: CA.teal10 }}
              >
                <Brain className="w-4 h-4" style={{ color: C.teal }} />
              </div>
              <div
                className="rounded-2xl px-4 py-3 flex items-center gap-1"
                style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{
                      background: C.teal,
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && <div className="px-6 py-2 text-xs" style={{ color: C.coral }}>{error}</div>}

        {/* Suggested questions */}
        <div
          className="px-6 py-3 flex-shrink-0 overflow-x-auto"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <div className="flex gap-2 w-max">
            {ai_tutor.suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
                style={{
                  background: C.paperRaised,
                  border: `1px solid ${C.border}`,
                  color: C.inkSoft,
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div
          className="px-6 py-4 flex-shrink-0"
          style={{ background: C.paperRaised, borderTop: `1px solid ${C.border}` }}
        >
          <div
            className="flex items-end gap-3 rounded-xl p-3"
            style={{ background: C.paper, border: `1px solid ${C.border}` }}
          >
            <button className="p-1.5 rounded-lg transition-all" style={{ color: C.inkSoft }}>
              <Paperclip className="w-4 h-4" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your courses… (Enter to send)"
              rows={1}
              className="flex-1 resize-none text-sm bg-transparent focus:outline-none"
              style={{ color: C.ink, maxHeight: 120 }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || typing}
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                background: input.trim() && !typing ? C.teal : C.border,
                color: input.trim() && !typing ? 'white' : C.inkSoft,
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
