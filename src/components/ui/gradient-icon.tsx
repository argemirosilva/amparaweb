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
  sm: "w-9 h-9 rounded-lg",
  md: "w-14 h-14 rounded-2xl",
  lg: "w-16 h-16 rounded-2xl",
};

const iconSizeClasses = {
  xs: "w-2.5 h-2.5",
  sm: "w-[18px] h-[18px]",
  md: "w-7 h-7",
  lg: "w-8 h-8",
};

export default function GradientIcon({ icon: Icon, size = "md", variant = "default", className }: GradientIconProps) {
  const isAdmin = variant === "admin";

  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0",
        sizeClasses[size],
        className
      )}
      style={{
        background: isAdmin
          ? "linear-gradient(135deg, hsl(210, 60%, 45%), hsl(220, 70%, 30%))"
          : "var(--ampara-gradient-soft)",
      }}
    >
      <Icon
        className={cn(iconSizeClasses[size])}
        style={{
          color: isAdmin ? "white" : "hsl(var(--ampara-magenta))",
        }}
      />
    </div>
  );
}
