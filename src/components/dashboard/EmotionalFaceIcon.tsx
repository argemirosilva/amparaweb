interface Props {
  score: number; // 0-1
  size?: number;
  className?: string;
}

type Level = {
  label: string;
  render: (stroke: string, muted: string) => JSX.Element;
};

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
    render: (s, m) => (
      <>
        <circle cx="32" cy="32" r="27" fill="none" stroke={m} strokeWidth="1.5" />
        <circle cx="24" cy="28" r="1.8" fill={s} />
        <circle cx="40" cy="28" r="1.8" fill={s} />
        <path d="M21 37 Q32 46 43 37" stroke={s} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  tranquila: {
    label: "Tranquila",
    render: (s, m) => (
      <>
        <circle cx="32" cy="32" r="27" fill="none" stroke={m} strokeWidth="1.5" />
        <circle cx="24" cy="28" r="1.8" fill={s} />
        <circle cx="40" cy="28" r="1.8" fill={s} />
        <path d="M23 38 Q32 43 41 38" stroke={s} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  cansada: {
    label: "Cansada",
    render: (s, m) => (
      <>
        <circle cx="32" cy="32" r="27" fill="none" stroke={m} strokeWidth="1.5" />
        <line x1="21" y1="28" x2="27" y2="28" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="37" y1="28" x2="43" y2="28" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="26" y1="39" x2="38" y2="39" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  },
  triste: {
    label: "Triste",
    render: (s, m) => (
      <>
        <circle cx="32" cy="32" r="27" fill="none" stroke={m} strokeWidth="1.5" />
        <circle cx="24" cy="27" r="1.8" fill={s} />
        <circle cx="40" cy="27" r="1.8" fill={s} />
        <path d="M23 43 Q32 36 41 43" stroke={s} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  chorando: {
    label: "Chorando",
    render: (s, m) => (
      <>
        <circle cx="32" cy="32" r="27" fill="none" stroke={m} strokeWidth="1.5" />
        <circle cx="24" cy="26" r="1.8" fill={s} />
        <circle cx="40" cy="26" r="1.8" fill={s} />
        <line x1="20" y1="31" x2="20" y2="37" stroke={s} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        <line x1="44" y1="31" x2="44" y2="37" stroke={s} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
        <path d="M24 43 Q32 37 40 43" stroke={s} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  colapso: {
    label: "Em colapso",
    render: (s, m) => (
      <>
        <circle cx="32" cy="34" r="25" fill="none" stroke={m} strokeWidth="1.5" />
        {/* hair lines */}
        <line x1="22" y1="12" x2="19" y2="4" stroke={s} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <line x1="29" y1="10" x2="28" y2="2" stroke={s} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <line x1="35" y1="10" x2="36" y2="2" stroke={s} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <line x1="42" y1="12" x2="45" y2="4" stroke={s} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        {/* wide eyes */}
        <circle cx="25" cy="30" r="3.5" stroke={s} strokeWidth="1.5" fill="none" />
        <circle cx="25" cy="30" r="1.2" fill={s} />
        <circle cx="39" cy="30" r="3.5" stroke={s} strokeWidth="1.5" fill="none" />
        <circle cx="39" cy="30" r="1.2" fill={s} />
        {/* open mouth */}
        <ellipse cx="32" cy="43" rx="4" ry="3" stroke={s} strokeWidth="1.5" fill="none" />
      </>
    ),
  },
};

export function getEmotionalLevel(score: number) {
  return getLevel(score);
}

export function computeEmotionalScore(sentimentos: Record<string, number>, totalAlertas: number): number {
  const positivo = sentimentos.positivo || 0;
  const neutro = sentimentos.neutro || 0;
  const total = Object.values(sentimentos).reduce((a, b) => a + b, 0);
  const score = total > 0 ? (positivo * 2 + neutro) / (total * 2) : 0.5;
  return totalAlertas > 0 ? Math.max(0, score - 0.15) : score;
}

export default function EmotionalFaceIcon({ score, size = 48, className }: Props) {
  const level = getLevel(score);
  const stroke = "hsl(var(--muted-foreground))";
  const muted = "hsl(var(--border))";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={level.label}
      className={className}
    >
      {level.render(stroke, muted)}
    </svg>
  );
}
