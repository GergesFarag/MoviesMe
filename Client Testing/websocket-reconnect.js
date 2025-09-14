// Enhanced WebSocket client with reconnection logic for Render production
class RobustWebSocketClient {
  constructor(serverUrl, userId) {
    this.serverUrl = serverUrl;
    this.userId = userId;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.isConnected = false;
    this.messageQueue = [];
    
    this.connect();
  }
  
  connect() {
    console.log('🔌 Attempting to connect to WebSocket server...');
    
    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      timeout: 60000, // 60 seconds connection timeout
      forceNew: false,
      autoConnect: true,
      // Enhanced reconnection settings for production
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      // Keep connection alive during long operations
      pingTimeout: 120000, // Match server setting
      pingInterval: 60000,  // Match server setting
    });
    
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    // Connection established
    this.socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000; // Reset delay
      
      // Join user room
      this.socket.emit('join:user', this.userId);
      
      // Send any queued messages
      this.flushMessageQueue();
      
      // Request health check
      this.socket.emit('health:check');
    });
    
    // Connection confirmed by server
    this.socket.on('connection:confirmed', (data) => {
      console.log('🎯 Connection confirmed by server:', data);
    });
    
    // Disconnection handling
    this.socket.on('disconnect', (reason) => {
      console.warn('❌ Disconnected from server. Reason:', reason);
      this.isConnected = false;
      
      if (reason === 'ping timeout') {
        console.warn('⚠️ Ping timeout detected - network latency issues');
      } else if (reason === 'transport close') {
        console.warn('⚠️ Transport closed - connection terminated');
      }
      
      // Don't reconnect if server initiated disconnect
      if (reason !== 'io server disconnect') {
        this.scheduleReconnect();
      }
    });
    
    // Reconnection attempts
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
      this.socket.emit('reconnect:attempt', {
        attempt: attemptNumber,
        userId: this.userId,
        timestamp: Date.now()
      });
    });
    
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      this.isConnected = true;
    });
    
    this.socket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect after maximum attempts');
      this.handleReconnectFailure();
    });
    
    // Story generation progress
    this.socket.on('story:progress', (data) => {
      console.log('📈 Story progress update:', data);
      this.updateProgressUI(data);
    });
    
    this.socket.on('story:completed', (data) => {
      console.log('✅ Story generation completed:', data);
      this.handleStoryCompleted(data);
    });
    
    this.socket.on('story:failed', (data) => {
      console.error('❌ Story generation failed:', data);
      this.handleStoryFailed(data);
    });
    
    // Error handling
    this.socket.on('socket:error', (error) => {
      console.error('🚨 Socket error:', error);
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('🚨 Connection error:', error);
      this.scheduleReconnect();
    });
    
    // Health check response
    this.socket.on('health:response', (data) => {
      console.log('💚 Health check response:', data);
    });
    
    // Pong response for custom ping
    this.socket.on('pong', (data) => {
      console.log('🏓 Pong received:', data);
    });
  }
  
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Maximum reconnection attempts reached');
      this.handleReconnectFailure();
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    
    console.log(`⏰ Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, delay);
  }
  
  handleReconnectFailure() {
    console.error('💀 Connection permanently lost. Please refresh the page.');
    // Show user notification to refresh page
    alert('Connection lost. Please refresh the page to continue.');
  }
  
  // Send message with queueing for offline scenarios
  sendMessage(event, data) {
    if (this.isConnected && this.socket) {
      this.socket.emit(event, data);
    } else {
      console.warn('📤 Queueing message for when connection is restored:', event, data);
      this.messageQueue.push({ event, data });
    }
  }
  
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const { event, data } = this.messageQueue.shift();
      this.socket.emit(event, data);
      console.log('📤 Sent queued message:', event, data);
    }
  }
  
  // Custom ping for testing connection
  ping() {
    if (this.socket && this.isConnected) {
      this.socket.emit('ping');
    }
  }
  
  // Health check
  healthCheck() {
    if (this.socket && this.isConnected) {
      this.socket.emit('health:check');
    }
  }
  
  // UI update methods (implement based on your frontend framework)
  updateProgressUI(data) {
    // Update progress bar, status text, etc.
    const progressElement = document.getElementById('progress');
    const statusElement = document.getElementById('status');
    
    if (progressElement) {
      progressElement.value = data.progress;
      progressElement.textContent = `${data.progress}%`;
    }
    
    if (statusElement) {
      statusElement.textContent = data.status;
    }
  }
  
  handleStoryCompleted(data) {
    // Handle completed story
    console.log('Story completed with data:', data);
    // Redirect to results page, show video, etc.
  }
  
  handleStoryFailed(data) {
    // Handle failed story generation
    console.error('Story generation failed:', data);
    // Show error message to user
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Usage example
document.addEventListener('DOMContentLoaded', function() {
  const serverUrl = 'ws://localhost:3000'; // Replace with your production URL
  const userId = 'user123'; // Get from your auth system
  
  const wsClient = new RobustWebSocketClient(serverUrl, userId);
  
  // Example: Start story generation
  document.getElementById('generateStory')?.addEventListener('click', function() {
    const storyData = {
      prompt: 'A magical adventure story',
      numOfScenes: 3,
      style: 'fantasy',
      genre: 'adventure'
    };
    
    wsClient.sendMessage('generate:story', storyData);
  });
  
  // Periodic health check (optional)
  setInterval(() => {
    wsClient.healthCheck();
  }, 60000); // Every minute
});