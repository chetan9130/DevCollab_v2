import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import registerSocketHandlers from './socket/handler.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'DevCollab Signaling Server is running' });
});

// Create HTTP Server
const httpServer = createServer(app);

// Initialize Socket.IO Server
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Listen for connections
io.on('connection', (socket) => {
  console.log(`[Server] New socket connection: ${socket.id}`);
  
  // Register signaling handlers for this client
  registerSocketHandlers(io, socket);
});

// Start Server
httpServer.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 DevCollab Signaling Server running on port ${PORT}`);
  console.log(`🚀 WebSocket URL: ws://localhost:${PORT}`);
  console.log(`==================================================`);
});
