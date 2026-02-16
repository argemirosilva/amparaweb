import { LucideIcon } from "lucide-react";

interface GovKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
}

export default function GovKpiCard({ title, value, subtitle, icon: Icon, trend }: GovKpiCardProps) {
  const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

  return (
    <div
      className="rounded-md border p-4"
      style={{
        background: "hsl(0 0% 100%)",
        borderColor: "hsl(220 13% 91%)",
        boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)",
        ...fontStyle,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "hsl(220 9% 46%)" }}>
          {title}
        </p>
        <div
          className="w-8 h-8 rounded flex items-center justify-center"
          style={{ background: "hsl(224 76% 33% / 0.08)" }}
        >
          <Icon className="w-4 h-4" style={{ color: "hsl(224 76% 33%)" }} />
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color: "hsl(220 13% 18%)", fontWeight: 700 }}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: "hsl(220 9% 46%)" }}>
          {subtitle}
        </p>
      )}
      {trend && (
        <p
          className="text-xs mt-1 font-medium"
          style={{ color: trend.positive ? "hsl(142 64% 24%)" : "hsl(0 73% 42%)" }}
        >
          {trend.value}
        </p>
      )}
    </div>
  );
}
