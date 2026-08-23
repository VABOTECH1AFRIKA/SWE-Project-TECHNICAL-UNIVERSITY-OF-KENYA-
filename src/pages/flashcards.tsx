import { useState } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { BookMarked, ArrowLeft, ArrowRight, RotateCcw, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { mockFlashcards, mockCourses } from '@/lib/mockData';
import { C, CA, courseColors, courseColorAlpha } from '@/lib/colors';

export default function Flashcards() {
  const [activeDeck, setActiveDeck] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [learning, setLearning] = useState<Set<string>>(new Set());
  const [filterCourse, setFilterCourse] = useState<string>('all');

  const decks = mockCourses.map((c) => ({
    course: c,
    cards: mockFlashcards.filter((f) => f.deck === c.code),
  })).filter((d) => d.cards.length > 0);

  const filteredDecks = filterCourse === 'all' ? decks : decks.filter((d) => d.course.code === filterCourse);

  const activeDeckData = decks.find((d) => d.course.code === activeDeck);
  const cards = activeDeckData?.cards || [];
  const currentCard = cards[cardIndex];

  const handleGotIt = () => {
    setKnown((prev) => new Set([...prev, currentCard.id]));
    setLearning((prev) => { const s = new Set(prev); s.delete(currentCard.id); return s; });
    if (cardIndex < cards.length - 1) { setCardIndex(cardIndex + 1); setFlipped(false); }
  };

  const handleStillLearning = () => {
    setLearning((prev) => new Set([...prev, currentCard.id]));
    setKnown((prev) => { const s = new Set(prev); s.delete(currentCard.id); return s; });
    if (cardIndex < cards.length - 1) { setCardIndex(cardIndex + 1); setFlipped(false); }
  };

  const resetDeck = () => {
    setCardIndex(0);
    setFlipped(false);
    setKnown(new Set());
    setLearning(new Set());
  };

  // Study mode
  if (activeDeck && activeDeckData) {
    const progress = ((cardIndex) / cards.length) * 100;

    return (
      <>
        <Helmet><title>Flashcards — StudyHub AI</title><meta name="description" content="Study flashcards." /><link rel="canonical" href="https://studyhub.ai/flashcards" /></Helmet>
        <div className="p-6 max-w-2xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => { setActiveDeck(null); resetDeck(); }}
              className="p-2 rounded-lg transition-all hover:bg-background"
              style={{ color: C.inkSoft }}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: C.ink }}>
                {activeDeckData.course.code} — {activeDeckData.course.title}
              </p>
              <p className="text-xs" style={{ color: C.inkSoft }}>
                Card {cardIndex + 1} of {cards.length}
              </p>
            </div>
            <button
              onClick={resetDeck}
              className="p-2 rounded-lg transition-all hover:bg-background"
              style={{ color: C.inkSoft }}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Progress */}
          <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: C.paper }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: C.teal }} />
          </div>
          <div className="flex justify-between text-xs mb-8" style={{ color: C.inkSoft }}>
            <span style={{ color: C.sage }}>✓ {known.size} known</span>
            <span style={{ color: C.coral }}>↺ {learning.size} learning</span>
          </div>

          {/* 3D Flip Card */}
          <div
            className="relative cursor-pointer mb-6"
            style={{ height: 280, perspective: 1000 }}
            onClick={() => setFlipped(!flipped)}
          >
            <div
              className={`flip-card-inner absolute inset-0 ${flipped ? 'flipped' : ''}`}
              style={{ width: '100%', height: '100%' }}
            >
              {/* Front */}
              <div
                className="flip-card-front absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-8 text-center"
                style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
              >
                <p className="text-xs font-semibold mb-4 uppercase tracking-wide" style={{ color: C.inkSoft }}>
                  Question — tap to flip
                </p>
                <p className="text-lg font-semibold leading-relaxed" style={{ color: C.ink }}>
                  {currentCard?.front}
                </p>
              </div>

              {/* Back */}
              <div
                className="flip-card-back absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-8 text-center"
                style={{ background: CA.teal10, border: `1px solid ${C.teal}` }}
              >
                <p className="text-xs font-semibold mb-4 uppercase tracking-wide" style={{ color: C.teal }}>
                  Answer
                </p>
                <p className="text-base leading-relaxed" style={{ color: C.ink }}>
                  {currentCard?.back}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons (show after flip) */}
          {flipped && (
            <div className="flex gap-3 mb-6">
              <button
                onClick={handleStillLearning}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: CA.coral10, color: C.coral, border: `1px solid ${C.coral}` }}
              >
                Still Learning
              </button>
              <button
                onClick={handleGotIt}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: CA.sage10, color: C.sage, border: `1px solid ${C.sage}` }}
              >
                Got It! ✓
              </button>
            </div>
          )}

          {/* Prev / Next */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => { if (cardIndex > 0) { setCardIndex(cardIndex - 1); setFlipped(false); } }}
              disabled={cardIndex === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: C.paperRaised,
                border: `1px solid ${C.border}`,
                color: cardIndex === 0 ? C.border : C.inkSoft,
              }}
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <button
              onClick={() => { if (cardIndex < cards.length - 1) { setCardIndex(cardIndex + 1); setFlipped(false); } }}
              disabled={cardIndex === cards.length - 1}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: C.paperRaised,
                border: `1px solid ${C.border}`,
                color: cardIndex === cards.length - 1 ? C.border : C.inkSoft,
              }}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </>
    );
  }

  // Deck listing
  return (
    <>
      <Helmet><title>Flashcards — StudyHub AI</title><meta name="description" content="AI-generated flashcard decks for your courses with 3D flip study mode." /><link rel="canonical" href="https://studyhub.ai/flashcards" /></Helmet>
      <div className="p-6 max-w-7xl mx-auto" style={{ fontFamily: 'var(--font-sans)' }}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)', color: C.ink }}>
            Flashcards
          </h1>
          <p className="text-sm" style={{ color: C.inkSoft }}>
            AI-generated flashcard decks for your courses.
          </p>
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
          {mockCourses.map((c) => (
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

        {filteredDecks.map((deck) => (
          <div
            key={deck.course.code}
            className="rounded-xl mb-5"
            style={{ background: C.paperRaised, border: `1px solid ${C.border}` }}
          >
            {/* Deck header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: courseColorAlpha[deck.course.code] }}
                >
                  <BookMarked className="w-5 h-5" style={{ color: courseColors[deck.course.code] }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: C.ink }}>
                    {deck.course.code} — {deck.course.title}
                  </p>
                  <p className="text-xs" style={{ color: C.inkSoft }}>
                    {deck.cards.length} cards · {deck.cards.filter((c) => c.aiGenerated).length} AI generated
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setActiveDeck(deck.course.code); resetDeck(); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ background: C.teal, color: 'white' }}
              >
                Study Deck
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Cards grid */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {deck.cards.map((card, i) => (
                <div
                  key={card.id}
                  className="rounded-xl p-4"
                  style={{ background: C.paper, border: `1px solid ${C.border}` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold" style={{ color: C.inkSoft }}>
                      #{i + 1}
                    </span>
                    {card.aiGenerated && (
                      <span
                        className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ background: CA.teal10, color: C.teal }}
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        AI
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium mb-2 leading-snug" style={{ color: C.ink }}>
                    {card.front}
                  </p>
                  <p
                    className="text-xs leading-relaxed line-clamp-2"
                    style={{ color: C.inkSoft }}
                  >
                    {card.back}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
