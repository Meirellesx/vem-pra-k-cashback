import { useRef, useState, useCallback } from 'react';

function getScrollContainer(el) {
  let node = el && el.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function usePullToRefresh(onRefresh) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const THRESHOLD = 70;
  const MAX_PULL = 90;

  const onTouchStart = useCallback((e) => {
    if (refreshing) return;
    const scrollEl = getScrollContainer(e.currentTarget);
    const atTop = scrollEl ? scrollEl.scrollTop <= 0 : (typeof window !== 'undefined' && window.scrollY <= 0);
    if (atTop) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
      pullRef.current = 0;
    } else {
      pulling.current = false;
    }
  }, [refreshing]);

  const onTouchMove = useCallback((e) => {
    if (!pulling.current) return;
    const delta = e.touches[0].clientY - startY.current;
    pullRef.current = delta > 0 ? Math.min(delta * 0.5, MAX_PULL) : 0;
    setPullDistance(pullRef.current);
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    const triggered = pullRef.current >= THRESHOLD;
    pullRef.current = 0;
    setPullDistance(0);
    if (triggered) {
      setRefreshing(true);
      try { await onRefresh(); } finally { setRefreshing(false); }
    }
  }, [onRefresh]);

  return { pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd };
}