// StudyHub AI — Design System Color Tokens via CSS Variables
// All colors reference the --sh-* CSS variables defined in globals.css

export const C = {
  paper: 'hsl(var(--sh-paper))',
  paperRaised: 'hsl(var(--sh-paper-raised))',
  ink: 'hsl(var(--sh-ink))',
  inkSoft: 'hsl(var(--sh-ink-soft))',
  highlighter: 'hsl(var(--sh-highlighter))',
  teal: 'hsl(var(--sh-teal))',
  coral: 'hsl(var(--sh-coral))',
  sage: 'hsl(var(--sh-sage))',
  border: 'hsl(var(--sh-border))',
  borderStrong: 'hsl(var(--sh-border-strong))',
  highlighterText: 'hsl(var(--sh-highlighter-text))',
} as const;

// Alpha variants using CSS color-mix or hsl with opacity
export const CA = {
  teal10: 'hsl(var(--sh-teal) / 0.10)',
  teal15: 'hsl(var(--sh-teal) / 0.15)',
  teal20: 'hsl(var(--sh-teal) / 0.20)',
  coral10: 'hsl(var(--sh-coral) / 0.10)',
  coral15: 'hsl(var(--sh-coral) / 0.15)',
  sage10: 'hsl(var(--sh-sage) / 0.10)',
  sage15: 'hsl(var(--sh-sage) / 0.15)',
  highlighter15: 'hsl(var(--sh-highlighter) / 0.15)',
  highlighter20: 'hsl(var(--sh-highlighter) / 0.20)',
  ink5: 'hsl(var(--sh-ink) / 0.05)',
  overlay: 'hsl(0 0% 0% / 0.30)',
  overlayDark: 'hsl(0 0% 0% / 0.75)',
} as const;

// Course color map
export const courseColors: Record<string, string> = {
  CS301: C.teal,
  CS302: C.sage,
  CS303: C.coral,
  CS304: C.highlighter,
};

export const courseColorAlpha: Record<string, string> = {
  CS301: CA.teal15,
  CS302: CA.sage15,
  CS303: CA.coral15,
  CS304: CA.highlighter15,
};
