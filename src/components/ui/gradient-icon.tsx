import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface GradientIconProps {
  icon: LucideIcon;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-10 h-10 rounded-xl",
  md: "w-14 h-14 rounded-2xl",
  lg: "w-16 h-16 rounded-2xl",
};

const iconSizeClasses = {
  sm: "w-5 h-5",
  md: "w-7 h-7",
  lg: "w-8 h-8",
};

export default function GradientIcon({ icon: Icon, size = "md", className }: GradientIconProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center shadow-md shrink-0",
        sizeClasses[size],
        className
      )}
      style={{ background: "var(--ampara-gradient)" }}
    >
      <Icon className={cn("text-white", iconSizeClasses[size])} />
    </div>
  );
}
