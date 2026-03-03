import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface GradientIconProps {
  icon: LucideIcon;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "default" | "admin";
  className?: string;
}

const sizeClasses = {
  xs: "w-5 h-5 rounded-md",
  sm: "w-10 h-10 rounded-xl",
  md: "w-14 h-14 rounded-2xl",
  lg: "w-16 h-16 rounded-2xl",
};

const iconSizeClasses = {
  xs: "w-2.5 h-2.5",
  sm: "w-5 h-5",
  md: "w-7 h-7",
  lg: "w-8 h-8",
};

const variantGradients = {
  default: "var(--ampara-gradient)",
  admin: "linear-gradient(135deg, hsl(210, 60%, 45%), hsl(220, 70%, 30%))",
};

export default function GradientIcon({ icon: Icon, size = "md", variant = "default", className }: GradientIconProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center shadow-md shrink-0",
        sizeClasses[size],
        className
      )}
      style={{ background: variantGradients[variant] }}
    >
      <Icon className={cn("text-white", iconSizeClasses[size])} />
    </div>
  );
}
