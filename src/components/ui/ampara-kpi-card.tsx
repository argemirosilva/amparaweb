import { LucideIcon } from "lucide-react";

interface AmparaKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export default function AmparaKpiCard({ title, value, subtitle, icon: Icon, trend, className = "" }: AmparaKpiCardProps) {
  return (
    <div className={`ampara-card-kpi ${className}`}>
      {/* Decorative circle with icon */}
      <div className="kpi-circle">
        <Icon className="w-7 h-7 text-primary/40" />
      </div>

      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <p className="text-2xl md:text-3xl font-bold text-foreground mt-1">{value}</p>

      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
      {trend && (
        <p className={`text-xs font-semibold mt-1 ${trend.positive ? "text-emerald-600" : "text-destructive"}`}>
          {trend.value}
        </p>
      )}
    </div>
  );
}
