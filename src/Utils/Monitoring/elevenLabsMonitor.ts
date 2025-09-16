interface ElevenLabsUsageStats {
  totalCalls: number;
  cachedCalls: number;
  apiCalls: number;
  lastCallTime: Date | null;
  errors: number;
}

class ElevenLabsMonitor {
  private stats: ElevenLabsUsageStats = {
    totalCalls: 0,
    cachedCalls: 0,
    apiCalls: 0,
    lastCallTime: null,
    errors: 0
  };

  recordApiCall(): void {
    this.stats.totalCalls++;
    this.stats.apiCalls++;
    this.stats.lastCallTime = new Date();
  }

  recordCachedCall(): void {
    this.stats.totalCalls++;
    this.stats.cachedCalls++;
  }

  recordError(): void {
    this.stats.errors++;
  }

  getStats(): ElevenLabsUsageStats {
    return { ...this.stats };
  }

  logDailyStats(): void {
    console.log("ElevenLabs Daily Usage Stats:", {
      ...this.stats,
      cacheHitRate: this.stats.totalCalls > 0 ? 
        ((this.stats.cachedCalls / this.stats.totalCalls) * 100).toFixed(2) + '%' : '0%'
    });
  }
}

export const elevenLabsMonitor = new ElevenLabsMonitor();