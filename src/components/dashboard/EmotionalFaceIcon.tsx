interface Props {
  score: number; // 0-1
  size?: number;
}

type Level = {
  label: string;
  render: (s: number, c: string, cl: string) => JSX.Element;
};

const MAIN = "hsl(263, 70%, 58%)";
const LIGHT = "hsl(263, 70%, 90%)";

function getLevel(score: number): Level {
  if (score >= 0.8) return levels.radiante;
  if (score >= 0.6) return levels.tranquila;
  if (score >= 0.4) return levels.cansada;
  if (score >= 0.25) return levels.triste;
  if (score >= 0.1) return levels.chorando;
  return levels.colapso;
}

const levels: Record<string, Level> = {
  radiante: {
    label: "Radiante",
    render: (_s, c, cl) => (
      <>
        <circle cx="32" cy="32" r="28" fill={cl} stroke={c} strokeWidth="2.5" />
        {/* happy eyes - arcs */}
        <path d="M20 26 Q24 20 28 26" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M36 26 Q40 20 44 26" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* big smile */}
        <path d="M20 38 Q32 50 44 38" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  tranquila: {
    label: "Tranquila",
    render: (_s, c, cl) => (
      <>
        <circle cx="32" cy="32" r="28" fill={cl} stroke={c} strokeWidth="2.5" />
        <circle cx="24" cy="28" r="2.5" fill={c} />
        <circle cx="40" cy="28" r="2.5" fill={c} />
        {/* gentle smile */}
        <path d="M22 38 Q32 44 42 38" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  cansada: {
    label: "Cansada",
    render: (_s, c, cl) => (
      <>
        <circle cx="32" cy="32" r="28" fill={cl} stroke={c} strokeWidth="2.5" />
        {/* half-closed eyes */}
        <line x1="20" y1="28" x2="28" y2="28" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="36" y1="28" x2="44" y2="28" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
        {/* straight mouth */}
        <line x1="24" y1="40" x2="40" y2="40" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
  },
  triste: {
    label: "Triste",
    render: (_s, c, cl) => (
      <>
        <circle cx="32" cy="32" r="28" fill={cl} stroke={c} strokeWidth="2.5" />
        <circle cx="24" cy="28" r="2.5" fill={c} />
        <circle cx="40" cy="28" r="2.5" fill={c} />
        {/* frown */}
        <path d="M22 44 Q32 36 42 44" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  chorando: {
    label: "Chorando",
    render: (_s, c, cl) => (
      <>
        <circle cx="32" cy="32" r="28" fill={cl} stroke={c} strokeWidth="2.5" />
        <circle cx="24" cy="26" r="2.5" fill={c} />
        <circle cx="40" cy="26" r="2.5" fill={c} />
        {/* tears */}
        <ellipse cx="18" cy="34" rx="1.8" ry="3.5" fill={c} opacity="0.5" />
        <ellipse cx="46" cy="34" rx="1.8" ry="3.5" fill={c} opacity="0.5" />
        {/* wavy mouth */}
        <path d="M24 42 Q28 38 32 42 Q36 46 40 42" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  colapso: {
    label: "Em colapso",
    render: (_s, c, cl) => (
      <>
        <circle cx="32" cy="34" r="26" fill={cl} stroke={c} strokeWidth="2.5" />
        {/* wild hair */}
        <line x1="20" y1="12" x2="16" y2="2" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="28" y1="10" x2="26" y2="0" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="36" y1="10" x2="38" y2="0" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="44" y1="12" x2="48" y2="2" stroke={c} strokeWidth="2.5" strokeLinecap="round" />
        {/* wide eyes */}
        <circle cx="24" cy="30" r="4" stroke={c} strokeWidth="2" fill="none" />
        <circle cx="24" cy="30" r="1.5" fill={c} />
        <circle cx="40" cy="30" r="4" stroke={c} strokeWidth="2" fill="none" />
        <circle cx="40" cy="30" r="1.5" fill={c} />
        {/* open mouth */}
        <ellipse cx="32" cy="44" rx="5" ry="4" stroke={c} strokeWidth="2" fill="none" />
      </>
    ),
  },
};

export function getEmotionalLevel(score: number) {
  return getLevel(score);
}

export default function EmotionalFaceIcon({ score, size = 64 }: Props) {
  const level = getLevel(score);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={level.label}
    >
      {level.render(score, MAIN, LIGHT)}
    </svg>
  );
}
