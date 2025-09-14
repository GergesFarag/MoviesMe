
interface ConnectionStats {
  totalConnections: number;
  totalDisconnections: number;
  transportCloseCount: number;
  pingTimeoutCount: number;
  avgConnectionDuration: number;
  connectionsByTransport: {
    websocket: number;
    polling: number;
  };
  disconnectReasons: Record<string, number>;
  recentEvents: Array<{
    type: 'connect' | 'disconnect';
    socketId: string;
    timestamp: number;
    reason?: string;
    transport?: string;
    duration?: number;
  }>;
}

class WebSocketMonitor {
  private stats: ConnectionStats;
  private connections: Map<string, { connectTime: number; transport: string }>;
  
  constructor() {
    this.stats = {
      totalConnections: 0,
      totalDisconnections: 0,
      transportCloseCount: 0,
      pingTimeoutCount: 0,
      avgConnectionDuration: 0,
      connectionsByTransport: {
        websocket: 0,
        polling: 0
      },
      disconnectReasons: {},
      recentEvents: []
    };
    this.connections = new Map();
  }

  trackConnection(socketId: string, transport: string) {
    this.stats.totalConnections++;
    this.stats.connectionsByTransport[transport as keyof typeof this.stats.connectionsByTransport]++;
    
    this.connections.set(socketId, {
      connectTime: Date.now(),
      transport
    });

    this.addEvent('connect', socketId, undefined, transport);
    
    console.log(`📊 WebSocket Stats - Total connections: ${this.stats.totalConnections}`);
  }

  trackDisconnection(socketId: string, reason: string, transport?: string) {
    this.stats.totalDisconnections++;
    
    // Track specific disconnect reasons
    this.stats.disconnectReasons[reason] = (this.stats.disconnectReasons[reason] || 0) + 1;
    
    if (reason === 'transport close') {
      this.stats.transportCloseCount++;
    } else if (reason === 'ping timeout') {
      this.stats.pingTimeoutCount++;
    }

    // Calculate connection duration
    const connectionInfo = this.connections.get(socketId);
    let duration = 0;
    
    if (connectionInfo) {
      duration = Date.now() - connectionInfo.connectTime;
      this.connections.delete(socketId);
      
      // Update average connection duration
      const totalDuration = this.stats.avgConnectionDuration * (this.stats.totalDisconnections - 1) + duration;
      this.stats.avgConnectionDuration = totalDuration / this.stats.totalDisconnections;
    }

    this.addEvent('disconnect', socketId, reason, transport, duration);
    
    // Log concerning patterns
    if (reason === 'transport close') {
      console.log(`⚠️ Transport close #${this.stats.transportCloseCount} - Socket: ${socketId}, Duration: ${duration}ms`);
      
      if (this.stats.transportCloseCount > 5) {
        console.log(`🚨 HIGH TRANSPORT CLOSE COUNT: ${this.stats.transportCloseCount} transport close events detected`);
        this.analyzePatterns();
      }
    }
  }

  private addEvent(type: 'connect' | 'disconnect', socketId: string, reason?: string, transport?: string, duration?: number) {
    this.stats.recentEvents.push({
      type,
      socketId,
      timestamp: Date.now(),
      reason,
      transport,
      duration
    });

    // Keep only last 50 events
    if (this.stats.recentEvents.length > 50) {
      this.stats.recentEvents.shift();
    }
  }

  private analyzePatterns() {
    console.log(`🔍 Analyzing connection patterns...`);
    
    const recentTransportCloses = this.stats.recentEvents
      .filter(event => event.type === 'disconnect' && event.reason === 'transport close')
      .slice(-10); // Last 10 transport closes

    if (recentTransportCloses.length >= 5) {
      const avgDuration = recentTransportCloses.reduce((sum, event) => sum + (event.duration || 0), 0) / recentTransportCloses.length;
      
      console.log(`📈 Pattern Analysis:`);
      console.log(`- Recent transport closes: ${recentTransportCloses.length}`);
      console.log(`- Average duration: ${Math.round(avgDuration)}ms`);
      
      if (avgDuration < 5000) {
        console.log(`🚨 PATTERN: Quick disconnects suggest network instability`);
      } else if (avgDuration > 60000) {
        console.log(`🚨 PATTERN: Long connections then disconnect - possible resource issue`);
      }

      // Check if all using same transport
      const transports = recentTransportCloses.map(e => e.transport).filter(Boolean);
      const uniqueTransports = [...new Set(transports)];
      
      if (uniqueTransports.length === 1) {
        console.log(`🚨 PATTERN: All disconnects on ${uniqueTransports[0]} transport`);
      }
    }
  }

  getStats(): ConnectionStats {
    return {
      ...this.stats,
      recentEvents: [...this.stats.recentEvents] // Clone to prevent modification
    };
  }

  printSummary() {
    console.log(`
📊 WebSocket Connection Summary:
=====================================
Total Connections: ${this.stats.totalConnections}
Total Disconnections: ${this.stats.totalDisconnections}
Transport Close Events: ${this.stats.transportCloseCount}
Ping Timeout Events: ${this.stats.pingTimeoutCount}
Average Connection Duration: ${Math.round(this.stats.avgConnectionDuration / 1000)}s

Transport Distribution:
- WebSocket: ${this.stats.connectionsByTransport.websocket}
- Polling: ${this.stats.connectionsByTransport.polling}

Disconnect Reasons:
${Object.entries(this.stats.disconnectReasons)
  .map(([reason, count]) => `- ${reason}: ${count}`)
  .join('\n')}

Current Active Connections: ${this.connections.size}
=====================================
    `);
  }

  // Export stats for external analysis
  exportStats() {
    return JSON.stringify(this.getStats(), null, 2);
  }
}

export default WebSocketMonitor;