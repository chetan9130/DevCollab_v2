import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

let socket = null;

export const socketService = {
  /**
   * Retrieve the active Socket.IO client instance, or initialize a new one.
   * @returns {import('socket.io-client').Socket} The socket instance.
   */
  getSocket() {
    if (!socket) {
      console.log(`[SocketService] Initializing socket client pointing to: ${SOCKET_URL}`);
      socket = io(SOCKET_URL, {
        autoConnect: false,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000
      });
    }
    return socket;
  },

  /**
   * Connect to the Socket.IO server.
   * @param {Function} onConnect Callback executed when connection is established (receives socket ID).
   * @param {Function} onDisconnect Callback executed when socket disconnects (receives reason string).
   * @returns {import('socket.io-client').Socket}
   */
  connect(onConnect, onDisconnect) {
    const s = this.getSocket();

    // Register primary connection state listeners
    s.off('connect');
    s.on('connect', () => {
      console.log(`[SocketService] Socket connected. Local Socket ID: ${s.id}`);
      if (onConnect) onConnect(s.id);
    });

    s.off('disconnect');
    s.on('disconnect', (reason) => {
      console.log(`[SocketService] Socket disconnected. Reason: ${reason}`);
      if (onDisconnect) onDisconnect(reason);
    });

    if (!s.connected) {
      s.connect();
    }

    return s;
  },

  /**
   * Disconnect the client from the signaling server.
   */
  disconnect() {
    if (socket) {
      console.log('[SocketService] Shutting down socket connection...');
      socket.disconnect();
      socket = null;
    }
  },

  /**
   * Emit a request to join a room.
   * @param {string} roomId The target room name/id.
   * @param {Function} callback Handler receiving the server acknowledgment response (status and peers list).
   */
  joinRoom(roomId, callback) {
    const s = this.getSocket();
    if (!s.connected) {
      console.error('[SocketService] Cannot join room: socket connection is inactive');
      return;
    }

    console.log(`[SocketService] Emitting join_room event for: ${roomId}`);
    s.emit('join_room', { roomId }, (response) => {
      console.log('[SocketService] Room join acknowledgment response:', response);
      if (callback) callback(response);
    });
  },

  /**
   * Relay a WebRTC signaling payload to a target peer.
   * @param {string} to Target peer socket ID.
   * @param {any} signal WebRTC Session Description (SDP offer/answer) or ICE Candidate payload.
   */
  sendSignal(to, signal) {
    const s = this.getSocket();
    if (!s.connected) {
      console.error('[SocketService] Cannot relay signal: socket connection is inactive');
      return;
    }

    console.log(`[SocketService] Relaying signal wrapper to peer ID: ${to}`);
    s.emit('signal', { to, signal });
  },

  /**
   * Register listeners for incoming socket actions from other room peers.
   * @param {object} listeners Event handlers for peer events.
   * @param {Function} listeners.onPeerJoined Triggered when another peer joins.
   * @param {Function} listeners.onPeerLeft Triggered when a peer disconnects or leaves.
   * @param {Function} listeners.onSignal Triggered when a signal relay is received.
   */
  registerEvents({ onPeerJoined, onPeerLeft, onSignal }) {
    const s = this.getSocket();

    if (onPeerJoined) {
      s.off('peer_joined');
      s.on('peer_joined', ({ peerId }) => {
        console.log(`[SocketService] peer_joined: ${peerId}`);
        onPeerJoined({ peerId });
      });
    }

    if (onPeerLeft) {
      s.off('peer_left');
      s.on('peer_left', ({ peerId }) => {
        console.log(`[SocketService] peer_left: ${peerId}`);
        onPeerLeft({ peerId });
      });
    }

    if (onSignal) {
      s.off('signal');
      s.on('signal', ({ from, signal }) => {
        console.log(`[SocketService] Received signal from: ${from}`);
        onSignal({ from, signal });
      });
    }
  },

  /**
   * Unregister signaling listeners to prevent memory leaks and duplicate handler runs.
   */
  unregisterEvents() {
    if (socket) {
      socket.off('peer_joined');
      socket.off('peer_left');
      socket.off('signal');
    }
  }
};
