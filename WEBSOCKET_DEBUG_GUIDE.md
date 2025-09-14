# WebSocket Transport Close Debugging Guide

## Overview
You're experiencing "transport close" disconnections in production. This guide provides tools and steps to diagnose and fix the issue.

## Quick Diagnosis Steps

### 1. Use the Debug Page
1. Open `Client Testing/debug-transport-close.html` in your browser
2. Set your production URL (e.g., `https://yourapp.onrender.com`)
3. Try different transport modes:
   - **Auto (polling → websocket)** - Default, should be most stable
   - **Polling Only** - Most reliable but higher latency
   - **WebSocket Only** - Test if WebSocket works at all
   - **WebSocket First** - Test if upgrade is the issue

### 2. Test Different Scenarios
- **Health Check**: Basic connectivity test
- **Small Messages**: Normal usage pattern
- **Large Messages**: Test payload limits
- **Rapid Messages**: Test rate limiting
- **Story Progress**: Simulate your actual use case

### 3. Monitor Statistics
Watch for patterns in:
- Transport close frequency
- Connection duration before disconnect
- Current transport type
- Total disconnections

## Common Causes & Solutions

### Load Balancer Issues (Most Likely)
**Symptoms**: Transport closes after 30-60 seconds, especially with WebSocket
**Solution**: Force polling-only transport

```javascript
// Client-side fix
const socket = io(serverUrl, {
  transports: ['polling'] // Disable WebSocket upgrades
});
```

### Render Platform Limitations
**Symptoms**: Consistent transport closes in production but not locally
**Solutions**:
1. **Increase timeouts** (already done)
2. **Disable WebSocket upgrades**
3. **Add heartbeat mechanism** (already implemented)

### Network/Proxy Issues
**Symptoms**: Random transport closes, upgrade failures
**Solution**: Implement reconnection with exponential backoff

```javascript
const socket = io(serverUrl, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 10
});
```

## Production Fixes to Try

### Option 1: Polling-Only (Safest)
Update your client-side Socket.io connection:

```javascript
// In your client code
const socket = io(serverUrl, {
  transports: ['polling'], // Force polling only
  pingInterval: 60000,
  pingTimeout: 120000,
  reconnection: true,
  reconnectionAttempts: 10
});
```

### Option 2: Enhanced Reconnection
Keep current settings but improve reconnection:

```javascript
const socket = io(serverUrl, {
  transports: ['polling', 'websocket'],
  pingInterval: 60000,
  pingTimeout: 120000,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  randomizationFactor: 0.5
});

socket.on('disconnect', (reason) => {
  if (reason === 'transport close') {
    console.warn('Transport closed, reconnecting...');
    // Force reconnection
    setTimeout(() => {
      if (!socket.connected) {
        socket.connect();
      }
    }, 1000);
  }
});
```

### Option 3: Fallback Strategy
Try WebSocket first, fall back to polling on transport close:

```javascript
let usePollingOnly = false;

function createSocket() {
  const transports = usePollingOnly ? ['polling'] : ['polling', 'websocket'];
  
  const socket = io(serverUrl, {
    transports,
    pingInterval: 60000,
    pingTimeout: 120000
  });
  
  socket.on('disconnect', (reason) => {
    if (reason === 'transport close' && !usePollingOnly) {
      console.warn('Transport close detected, switching to polling only');
      usePollingOnly = true;
      socket.disconnect();
      setTimeout(() => createSocket(), 2000);
    }
  });
  
  return socket;
}
```

## Server-Side Debugging Commands

Your server now responds to these debug events:

```javascript
// Get server statistics
socket.emit('stats:request');

// Print detailed stats to server console  
socket.emit('debug:summary');

// Health check
socket.emit('health:check');
```

## Monitoring in Production

### Server Logs to Watch For
```
✅ Socket connected: [socket-id] (Transport: polling/websocket)
❌ Socket disconnected: [socket-id]. Reason: transport close
⬆️ Socket upgraded to WebSocket
📊 Connection stats: [details]
```

### Key Metrics
- **Transport close frequency**: Should be <5% of connections
- **Average connection duration**: Should be >5 minutes for active users
- **Upgrade success rate**: WebSocket upgrades should succeed >90%

## Testing Protocol

1. **Test locally first**: Verify debug page works with local server
2. **Test production with polling**: Start with safest option
3. **Monitor for 30 minutes**: Check if transport closes stop
4. **If stable, test WebSocket**: Try allowing upgrades again
5. **Load test**: Use rapid messages to stress test

## Emergency Fallback

If all else fails, this minimal configuration should work:

```javascript
const socket = io(serverUrl, {
  transports: ['polling'],
  upgrade: false,
  reconnection: true,
  reconnectionDelay: 1000,
  timeout: 60000
});
```

## Next Steps

1. **Deploy the debug page** to test your production environment
2. **Try polling-only mode** as the first fix
3. **Monitor logs** for 24 hours to confirm stability
4. **Report back** with debug page results

The most likely fix is switching to polling-only transport due to load balancer/proxy issues common on hosting platforms like Render.