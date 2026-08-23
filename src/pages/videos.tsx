import { useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useQuery } from '@tanstack/react-query';
import { Play, Youtube, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { mockYoutubeVideos, mockCourses } from '@/lib/mockData';
import { C, CA, courseColors, courseColorAlpha } from '@/lib/colors';

export default function VideoRecommendations() {
  const [filterCourse, setFilterCourse] = useState<string>('all');

  const { data: courses = mockCourses } = useQuery({ queryKey: ['courses'], queryFn: api.getCourses });
  const { data: videos = mockYoutubeVideos } = useQuery({ queryKey: ['videos'], queryFn: () => api.getVideos() });

  const filtered = filterCourse === 'all'
    ? videos
    : videos.filter((v) => v.course === filterCourse);

  return (
    <>
      <Helmet><title>Video Recommendations — StudyHub AI</title><meta name="description" content="AI-curated YouTube videos relevant to your university courses." /><link rel="canonical" href="https://studyhub.ai/videos" /></Helmet>
      <div className="p-6 max-w-7xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
              Video Recommendations
            </h1>
            <p className="text-sm" style={{ color: C.inkSoft }}>
              AI-curated YouTube videos relevant to your courses.
            </p>
          </div>
          <span
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium self-start"
            style={{ background: CA.coral10, color: C.coral }}
          >
            <Youtube className="w-3.5 h-3.5" />
            YouTube Data API — Backend integration pending
          </span>
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
            All Courses
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

        {/* Video grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {filtered.map((video) => (
            <div
              key={video.id}
              className="rounded-xl overflow-hidden transition-all hover:shadow-md cursor-pointer"
              style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video overflow-hidden group">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                  width={400}
                  height={225}
                />
                {/* Play overlay */}
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ background: CA.overlay }}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white">
                    <Play className="w-5 h-5 ml-0.5" style={{ color: C.coral }} />
                  </div>
                </div>
                {/* Duration badge */}
                <span
                  className="absolute bottom-2 right-2 text-xs px-1.5 py-0.5 rounded font-medium text-white bg-black/70"
                >
                  {video.duration}
                </span>
                {/* Relevance badge */}
                <span
                  className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: CA.sage10, color: C.sage }}
                >
                  {video.relevance}% match
                </span>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ background: courseColorAlpha[video.course], color: courseColors[video.course] }}
                  >
                    {video.course}
                  </span>
                  <span className="text-xs" style={{ color: C.inkSoft }}>{video.views} views</span>
                </div>
                <h3 className="text-sm font-semibold mb-1 leading-snug" style={{ color: C.ink }}>
                  {video.title}
                </h3>
                <p className="text-xs" style={{ color: C.inkSoft }}>
                  {video.channel} · {video.uploadedAgo}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Info card */}
        <div
          className="rounded-xl p-5 flex items-start gap-4"
          style={{ background: CA.teal10, border: `1px solid ${C.teal}` }}
        >
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.teal }} />
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: C.teal }}>
              About Video Recommendations
            </p>
            <p className="text-sm" style={{ color: C.ink }}>
              In the full build, this page will use the YouTube Data API to fetch videos relevant to your uploaded course materials. The AI will analyze your notes and recommend the most helpful videos. Currently showing mock data.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
