import app from './app';
import connectDB from './Config/db';
import { getIO, initSocket } from './Sockets/socket';
import http from 'http';
import { QueueMonitor } from './Utils/Monitoring/queue.motitor';
import runEnvValidation from './Config/env.validator';

const PORT = process.env.PORT_NUMBER || 3000;
(async () => {
  await connectDB();

  const server = http.createServer(app);

  runEnvValidation();

  initSocket(server);

  // Start listening
  server.listen(PORT, async () => {
    console.log(`Server is running on: http://localhost:${PORT}/`);
    await Promise.all([
      import('./Queues/model.queue'),
      import('./Queues/generationLib.queue'),
      import('./Queues/story.queue'),
    ]);
    console.log('Queue services loaded');
    setImmediate(() => {
      new QueueMonitor();
    });
  });

  process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
    server.close(() => {
      getIO().emit('error', 'Server is shutting down due to an error');
      process.exit(1);
    });
  });
})();
