import { type ReactNode } from "react";

interface PageHeaderProps {
  tag: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export default function PageHeader({ tag, title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(280,60%,96%)] via-[hsl(320,40%,95%)] to-[hsl(280,30%,93%)] dark:from-[hsl(280,30%,12%)] dark:via-[hsl(320,20%,10%)] dark:to-[hsl(280,20%,8%)]" />
      
      {/* Decorative circles */}
      <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-[hsl(320,70%,50%)] opacity-[0.07]" />
      <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-[hsl(280,60%,48%)] opacity-[0.06]" />
      <div className="absolute top-1/2 right-1/4 w-10 h-10 rounded-full bg-[hsl(320,60%,55%)] opacity-[0.05]" />
      
      {/* Halftone dots pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, hsl(280,60%,48%) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />

      {/* Sparkle accents */}
      <div className="absolute top-3 right-12 w-1.5 h-1.5 rounded-full bg-[hsl(320,70%,60%)] opacity-30 animate-pulse" />
      <div className="absolute bottom-4 right-24 w-1 h-1 rounded-full bg-[hsl(280,60%,55%)] opacity-25 animate-pulse" style={{ animationDelay: "0.5s" }} />
      <div className="absolute top-6 right-32 w-1 h-1 rounded-full bg-[hsl(320,70%,65%)] opacity-20 animate-pulse" style={{ animationDelay: "1s" }} />

      {/* Content */}
      <div className="relative px-5 py-5 md:px-6 md:py-6">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em] mb-1.5">{tag}</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
