export default function registerSocketHandlers(io, socket) {
  // Handle room joining
  socket.on('join_room', ({ roomId }, callback) => {
    if (!roomId) {
      console.warn(`[Socket ${socket.id}] Join room requested without roomId`);
      if (typeof callback === 'function') {
        callback({ status: 'error', message: 'Room ID is required' });
      }
      return;
    }

    console.log(`[Socket ${socket.id}] Joining room: ${roomId}`);
    
    // Join socket to room
    socket.join(roomId);
    
    // Notify existing participants in this room using peer_joined event
    socket.to(roomId).emit('peer_joined', { peerId: socket.id });
    
    // Fetch all existing peer IDs in the room (excluding this socket itself)
    const clients = io.sockets.adapter.rooms.get(roomId);
    const existingPeers = clients 
      ? Array.from(clients).filter(id => id !== socket.id)
      : [];

    console.log(`[Socket ${socket.id}] Room ${roomId} currently contains other peers:`, existingPeers);

    // Call callback with successful join and the list of active peers
    if (typeof callback === 'function') {
      callback({
        status: 'ok',
        roomId,
        peers: existingPeers
      });
    }
  });

  // Handle signal relay
  socket.on('signal', ({ to, signal }) => {
    if (!to) {
      console.warn(`[Socket ${socket.id}] Relay failed: 'to' peer ID is missing`);
      return;
    }

    // Relay signaling payload to target peer
    io.to(to).emit('signal', {
      from: socket.id,
      signal
    });
  });

  // Handle socket connection teardown
  socket.on('disconnecting', () => {
    // Notify other peers in all rooms that this client is leaving
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        console.log(`[Socket ${socket.id}] Leaving room ${room} due to disconnect, notifying peers`);
        socket.to(room).emit('peer_left', { peerId: socket.id });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket ${socket.id}] Disconnected`);
  });
}
