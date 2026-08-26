import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Layout-level cache so per-route UI state (e.g. the customer area's active
// sub-tab) survives route unmounts when switching MobileNav tabs.
const cache = new Map();

export function useRouteCache(key, defaultValue) {
  const location = useLocation();
  const cacheKey = `${location.pathname}::${key}`;
  const [value, setValue] = useState(() =>
    cache.has(cacheKey) ? cache.get(cacheKey) : defaultValue
  );

  useEffect(() => {
    cache.set(cacheKey, value);
  }, [cacheKey, value]);

  return [value, setValue];
}