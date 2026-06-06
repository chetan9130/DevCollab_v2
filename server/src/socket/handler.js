const roomScreenSharers = new Map(); // roomId -> socketId
const socketUsernames = new Map(); // socketId -> username

export default function registerSocketHandlers(io, socket) {
  // Handle room joining
  socket.on('join_room', ({ roomId, username }, callback) => {
    if (!roomId) {
      console.warn(`[Socket ${socket.id}] Join room requested without roomId`);
      if (typeof callback === 'function') {
        callback({ status: 'error', message: 'Room ID is required' });
      }
      return;
    }

    const cleanUsername = username?.trim() || `User_${socket.id.substring(0, 4)}`;
    console.log(`[Socket ${socket.id}] Joining room: ${roomId} with username: ${cleanUsername}`);
    socketUsernames.set(socket.id, cleanUsername);
    
    // Leave all other rooms first (excluding the client's own socket.id room)
    for (const room of socket.rooms) {
      if (room !== socket.id && room !== roomId) {
        console.log(`[Socket ${socket.id}] Leaving room ${room} prior to joining ${roomId}`);
        socket.leave(room);
        if (roomScreenSharers.get(room) === socket.id) {
          roomScreenSharers.delete(room);
          socket.to(room).emit('screen_share_stopped', { from: socket.id });
        }
        socket.to(room).emit('peer_left', { peerId: socket.id });
      }
    }
    
    // Join socket to room
    socket.join(roomId);
    
    // Notify existing participants in this room using peer_joined event
    socket.to(roomId).emit('peer_joined', { peerId: socket.id, username: cleanUsername });
    
    // Fetch all existing peer IDs in the room (excluding this socket itself)
    const clients = io.sockets.adapter.rooms.get(roomId);
    const existingPeers = clients 
      ? Array.from(clients).filter(id => id !== socket.id)
      : [];

    console.log(`[Socket ${socket.id}] Room ${roomId} currently contains other peers:`, existingPeers);

    // Map existing peer IDs to their usernames
    const peerUsernamesMap = {};
    existingPeers.forEach(id => {
      peerUsernamesMap[id] = socketUsernames.get(id) || `User_${id.substring(0, 4)}`;
    });

    // Call callback with successful join, list of active peers, peers' usernames, and current screen sharer
    if (typeof callback === 'function') {
      callback({
        status: 'ok',
        roomId,
        peers: existingPeers,
        peerUsernames: peerUsernamesMap,
        screenSharer: roomScreenSharers.get(roomId) || null
      });
    }
  });

  // Handle explicit room leaving
  socket.on('leave_room', ({ roomId }, callback) => {
    if (!roomId) return;
    console.log(`[Socket ${socket.id}] Explicitly leaving room: ${roomId}`);
    socket.leave(roomId);
    if (roomScreenSharers.get(roomId) === socket.id) {
      roomScreenSharers.delete(roomId);
      socket.to(roomId).emit('screen_share_stopped', { from: socket.id });
    }
    socket.to(roomId).emit('peer_left', { peerId: socket.id });
    if (typeof callback === 'function') {
      callback({ status: 'ok', roomId });
    }
  });

  // Handle screen share started notification
  socket.on('screen_share_started', ({ roomId }) => {
    if (!roomId) return;
    console.log(`[Socket ${socket.id}] Started screen sharing in room ${roomId}`);
    roomScreenSharers.set(roomId, socket.id);
    socket.to(roomId).emit('screen_share_started', { from: socket.id });
  });

  // Handle screen share stopped notification
  socket.on('screen_share_stopped', ({ roomId }) => {
    if (!roomId) return;
    console.log(`[Socket ${socket.id}] Stopped screen sharing in room ${roomId}`);
    if (roomScreenSharers.get(roomId) === socket.id) {
      roomScreenSharers.delete(roomId);
    }
    socket.to(roomId).emit('screen_share_stopped', { from: socket.id });
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
        if (roomScreenSharers.get(room) === socket.id) {
          roomScreenSharers.delete(room);
          socket.to(room).emit('screen_share_stopped', { from: socket.id });
        }
        socket.to(room).emit('peer_left', { peerId: socket.id });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket ${socket.id}] Disconnected`);
    socketUsernames.delete(socket.id);
  });
}

