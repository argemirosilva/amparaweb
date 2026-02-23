import { cn } from "@/lib/utils";

interface AdminFilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export default function AdminFilterBar({ children, className }: AdminFilterBarProps) {
  return (
    <div className={cn(
      "flex flex-wrap gap-3 items-end p-4 rounded-lg bg-card border border-border shadow-sm mb-4",
      className
    )}>
      {children}
    </div>
  );
}
