import { cn } from "@/lib/utils";

interface AdminTableWrapperProps {
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

export default function AdminTableWrapper({ children, className, footer }: AdminTableWrapperProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card shadow-sm overflow-hidden", className)}>
      <div className="overflow-x-auto">
        {children}
      </div>
      {footer && (
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}
