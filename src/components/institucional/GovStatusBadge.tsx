interface GovStatusBadgeProps {
  status: "verde" | "amarelo" | "laranja" | "vermelho";
  label: string;
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  verde: { bg: "hsl(142 64% 24% / 0.1)", text: "hsl(142 64% 24%)" },
  amarelo: { bg: "hsl(45 93% 41% / 0.1)", text: "hsl(45 93% 41%)" },
  laranja: { bg: "hsl(20 91% 40% / 0.1)", text: "hsl(20 91% 40%)" },
  vermelho: { bg: "hsl(0 73% 42% / 0.1)", text: "hsl(0 73% 42%)" },
};

export default function GovStatusBadge({ status, label }: GovStatusBadgeProps) {
  const s = statusStyles[status] || statusStyles.verde;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{
        background: s.bg,
        color: s.text,
        fontFamily: "Inter, Roboto, sans-serif",
      }}
    >
      {label}
    </span>
  );
}
