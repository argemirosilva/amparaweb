import { type LucideIcon } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";

interface AdminPageHeaderProps {
  icon: LucideIcon;
  breadcrumb: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export default function AdminPageHeader({ icon, breadcrumb, title, description, actions }: AdminPageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <GradientIcon icon={icon} size="sm" variant="admin" />
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{breadcrumb}</p>
            <h1 className="text-2xl font-semibold text-foreground leading-tight">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="mt-4 h-px w-full" style={{ background: "var(--ampara-gradient)", opacity: 0.15 }} />
    </div>
  );
}
