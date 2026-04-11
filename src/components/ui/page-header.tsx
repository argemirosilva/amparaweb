import { type ReactNode } from "react";

interface PageHeaderProps {
  tag: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export default function PageHeader({ tag, title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="pt-6 pb-4 px-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em] mb-1.5">
        {tag}
      </p>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[26px] font-semibold text-foreground leading-[1.3] tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
      {/* Brand accent line */}
      <div
        className="mt-2 h-[2px] w-12 rounded-full"
        style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(292, 84%, 61%))" }}
      />
    </div>
  );
}
