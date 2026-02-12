import { useState, useRef, useCallback, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
}

const THRESHOLD = 60;

export default function PullToRefresh({ onRefresh, children, disabled }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || refreshing) return;
      // Only activate if scrolled to top
      const scrollTop = containerRef.current?.scrollTop ?? window.scrollY;
      if (scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
      }
    },
    [disabled, refreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startY.current === null || refreshing) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 0) {
        // Dampen the pull
        setPullDistance(Math.min(diff * 0.4, THRESHOLD * 1.5));
      }
    },
    [refreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (startY.current === null) return;
    startY.current = null;

    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.6);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: pullDistance > 0 || refreshing ? `${pullDistance}px` : "0px" }}
      >
        <Loader2
          className={`w-5 h-5 text-primary transition-opacity ${
            refreshing ? "animate-spin opacity-100" : pullDistance >= THRESHOLD ? "opacity-100" : "opacity-40"
          }`}
        />
      </div>
      {children}
    </div>
  );
}
