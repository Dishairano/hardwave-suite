'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { haptic } from '@/lib/pwa/haptics';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

export function PullToRefresh({ onRefresh, children, disabled }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;

    startYRef.current = e.touches[0].clientY;
    isPullingRef.current = true;
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPullingRef.current || disabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0) {
      e.preventDefault();
      const distance = Math.min(diff * 0.5, MAX_PULL);
      setPullDistance(distance);

      // Trigger haptic when crossing threshold
      if (distance >= PULL_THRESHOLD && !triggered) {
        setTriggered(true);
        haptic('medium');
      } else if (distance < PULL_THRESHOLD && triggered) {
        setTriggered(false);
      }
    }
  }, [disabled, isRefreshing, triggered]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      haptic('success');

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setTriggered(false);
      }
    } else {
      setPullDistance(0);
      setTriggered(false);
    }
  }, [pullDistance, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div ref={containerRef} className="h-full overflow-auto">
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{
          height: isRefreshing ? 60 : pullDistance,
          opacity: showIndicator ? 1 : 0,
        }}
      >
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-full bg-white/10 ${
            isRefreshing ? 'animate-pulse' : ''
          }`}
          style={{
            transform: `rotate(${progress * 180}deg) scale(${0.5 + progress * 0.5})`,
          }}
        >
          <RefreshCw
            className={`w-5 h-5 ${
              triggered || isRefreshing ? 'text-[#FFA500]' : 'text-white/60'
            } ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.1}px)` : undefined,
          transition: pullDistance === 0 ? 'transform 0.2s ease-out' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
