/**
 * Simple in-memory LRU cache with TTL expiration.
 * Suitable for single-process caching of analytics and list endpoints.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class LRUCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize = 100, ttlSeconds = 60) {
    this.maxSize = maxSize;
    this.ttlMs = ttlSeconds * 1000;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    // Delete first to reset insertion order
    this.cache.delete(key);
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Shared cache instances
// Analytics: 60s TTL, data changes infrequently
export const analyticsCache = new LRUCache(20, 60);
// Vehicle list: 30s TTL, may change more often
export const vehicleCache = new LRUCache(50, 30);
