// WebSocket Transport Close Diagnostic Tool
// Run this in your browser console while connected to test different scenarios

class WebSocketDiagnostic {
  constructor(socket) {
    this.socket = socket;
    this.disconnectCount = 0;
    this.connectionTimes = [];
    this.startMonitoring();
  }

  startMonitoring() {
    console.log('🔍 Starting WebSocket diagnostic monitoring...');
    
    // Track connection events
    this.socket.on('connect', () => {
      const connectTime = Date.now();
      this.connectionTimes.push(connectTime);
      console.log(`✅ Connected at ${new Date(connectTime).toISOString()}`);
      console.log(`Transport: ${this.socket.io.engine.transport.name}`);
      console.log(`Upgraded: ${this.socket.io.engine.upgraded}`);
    });

    // Track disconnections
    this.socket.on('disconnect', (reason) => {
      this.disconnectCount++;
      const disconnectTime = Date.now();
      const connectionDuration = this.connectionTimes.length > 0 
        ? disconnectTime - this.connectionTimes[this.connectionTimes.length - 1]
        : 0;
      
      console.log(`❌ Disconnect #${this.disconnectCount}: ${reason}`);
      console.log(`Connection lasted: ${connectionDuration}ms`);
      console.log(`Transport at disconnect: ${this.socket.io.engine.transport.name}`);
      
      if (reason === 'transport close') {
        this.analyzeTransportClose(connectionDuration);
      }
    });

    // Monitor transport changes
    this.socket.io.engine.on('upgrade', () => {
      console.log(`⬆️ Upgraded to: ${this.socket.io.engine.transport.name}`);
    });

    this.socket.io.engine.on('upgradeError', (error) => {
      console.log(`❌ Upgrade failed:`, error);
    });

    // Monitor messages
    let messageCount = 0;
    this.socket.onAny((event, ...args) => {
      messageCount++;
      if (messageCount % 10 === 0) { // Log every 10th message
        console.log(`📨 Message #${messageCount}: ${event}`);
      }
    });
  }

  analyzeTransportClose(duration) {
    console.log('🔍 Analyzing transport close...');
    
    if (duration < 1000) {
      console.log('⚡ VERY QUICK DISCONNECT - Likely connection issue');
    } else if (duration < 5000) {
      console.log('🚀 QUICK DISCONNECT - Possible network instability');
    } else if (duration < 30000) {
      console.log('⏱️ SHORT CONNECTION - May be server/client issue');
    } else {
      console.log('✅ NORMAL DURATION - Unexpected transport close');
    }

    // Check current network status
    if (navigator.connection) {
      console.log('📡 Network info:', {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      });
    }

    // Test scenarios
    this.suggestTests();
  }

  suggestTests() {
    console.log('🧪 Suggested tests:');
    console.log('1. Try polling only: diagnostic.testPollingOnly()');
    console.log('2. Try websocket only: diagnostic.testWebsocketOnly()');
    console.log('3. Test with small messages: diagnostic.testSmallMessages()');
    console.log('4. Test with large messages: diagnostic.testLargeMessages()');
    console.log('5. Stress test: diagnostic.stressTest()');
  }

  // Test scenarios
  testPollingOnly() {
    console.log('🔧 Testing polling only...');
    this.socket.io.opts.transports = ['polling'];
    this.socket.disconnect();
    setTimeout(() => this.socket.connect(), 1000);
  }

  testWebsocketOnly() {
    console.log('🔧 Testing websocket only...');
    this.socket.io.opts.transports = ['websocket'];
    this.socket.disconnect();
    setTimeout(() => this.socket.connect(), 1000);
  }

  testSmallMessages() {
    console.log('🔧 Testing small messages...');
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        this.socket.emit('ping', { test: i, size: 'small' });
      }, i * 100);
    }
  }

  testLargeMessages() {
    console.log('🔧 Testing large messages...');
    const largeData = 'x'.repeat(10000); // 10KB
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.socket.emit('ping', { test: i, size: 'large', data: largeData });
      }, i * 1000);
    }
  }

  stressTest() {
    console.log('🔧 Running stress test...');
    let count = 0;
    const interval = setInterval(() => {
      if (count >= 100) {
        clearInterval(interval);
        console.log('✅ Stress test completed');
        return;
      }
      
      this.socket.emit('health:check', { stressTest: true, count: count++ });
      
      if (!this.socket.connected) {
        clearInterval(interval);
        console.log('❌ Stress test failed - disconnected');
      }
    }, 50); // Send message every 50ms
  }

  // Generate diagnostic report
  generateReport() {
    return {
      disconnectCount: this.disconnectCount,
      connectionTimes: this.connectionTimes,
      currentTransport: this.socket.io.engine.transport.name,
      upgraded: this.socket.io.engine.upgraded,
      connected: this.socket.connected,
      networkInfo: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : 'Not available',
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };
  }
}

// Usage instructions
console.log(`
🔍 WebSocket Diagnostic Tool Loaded!

To start monitoring, run:
const diagnostic = new WebSocketDiagnostic(socket);

Available commands:
- diagnostic.testPollingOnly() - Test with polling transport only
- diagnostic.testWebsocketOnly() - Test with websocket transport only  
- diagnostic.testSmallMessages() - Send small test messages
- diagnostic.testLargeMessages() - Send large test messages
- diagnostic.stressTest() - Send rapid messages to test stability
- diagnostic.generateReport() - Get diagnostic report

The tool will automatically monitor and analyze any transport close events.
`);

// Export for global use
window.WebSocketDiagnostic = WebSocketDiagnostic;