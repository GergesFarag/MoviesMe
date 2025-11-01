import NodeCache from 'node-cache';

class AppCache {
  private static instance: AppCache;
  private cache: NodeCache;

  private constructor() {
    this.cache = new NodeCache({
      stdTTL: 600,
      checkperiod: 60,
      useClones: false,
    });
    console.log('AppCache singleton initialized');
  }

  public static getInstance(): AppCache {
    if (!AppCache.instance) {
      AppCache.instance = new AppCache();
    }
    return AppCache.instance;
  }

  public get(key: string): any {
    return this.cache.get(key);
  }

  public set(key: string, value: any, ttl?: number): boolean {
    return this.cache.set(key, value, ttl || 0);
  }

  public del(key: string | string[]): number {
    return this.cache.del(key);
  }

  public has(key: string): boolean {
    return this.cache.has(key);
  }

  public getStats(): NodeCache.Stats {
    return this.cache.getStats();
  }

  public flushAll(): void {
    this.cache.flushAll();
  }

  public keys(): string[] {
    return this.cache.keys();
  }
}

const appCache = AppCache.getInstance();
export default appCache;
