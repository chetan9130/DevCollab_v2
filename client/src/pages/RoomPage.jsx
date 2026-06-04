import React, { useState, useEffect } from 'react';
import { socketService } from '../services/socket';
import TerminalConsole from '../components/TerminalConsole';

export default function RoomPage() {
  // Connection and client identity states
  const [socketId, setSocketId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [logs, setLogs] = useState([]);
  
  // Room states
  const [roomIdInput, setRoomIdInput] = useState('');
  const [activeRoomId, setActiveRoomId] = useState('');
  const [peers, setPeers] = useState([]);

  // Modal or custom inline messaging state
  const [customMsgTarget, setCustomMsgTarget] = useState(null);
  const [customMsgInput, setCustomMsgInput] = useState('');

  // Helper to add log entries
  const addLog = (type, message) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: time,
        type,
        message,
      },
    ]);
  };

  // Connect socket and register socket listeners on mount
  useEffect(() => {
    addLog('system', 'Initializing socket service...');
    setConnectionStatus('connecting');

    // Establish socket connection
    socketService.connect(
      (id) => {
        setSocketId(id);
        setConnectionStatus('connected');
        addLog('success', `Connected to signaling server with Client ID: ${id}`);
      },
      (reason) => {
        setSocketId('');
        setConnectionStatus('disconnected');
        setActiveRoomId('');
        setPeers([]);
        addLog('error', `Disconnected from signaling server. Reason: ${reason}`);
      }
    );

    // Register signaling event listeners
    socketService.registerEvents({
      onPeerJoined: ({ peerId }) => {
        setPeers((prev) => {
          if (!prev.includes(peerId)) {
            return [...prev, peerId];
          }
          return prev;
        });
        addLog('success', `Peer joined: ${peerId}`);
      },
      
      onPeerLeft: ({ peerId }) => {
        setPeers((prev) => prev.filter((id) => id !== peerId));
        addLog('system', `Peer left: ${peerId}`);
      },
      
      onSignal: ({ from, signal }) => {
        addLog('signal', `Received signal from ${from} | Type: ${signal.type}`);
        
        // Log detailed payload information
        if (signal.type === 'offer') {
          addLog('system', `SDP Offer details: "${signal.sdp.substring(0, 45)}..."`);
          
          // Auto-respond with a Mock SDP Answer to simulate WebRTC negotiation flow
          addLog('system', `Auto-generating mock SDP Answer for ${from}...`);
          const mockAnswer = {
            type: 'answer',
            sdp: `v=0\no=DevCollab-Answer ${Math.floor(Date.now()/1000)} IN IP4 127.0.0.1\ns=Mock Answer\nt=0 0\nc=IN IP4 127.0.0.1`
          };
          socketService.sendSignal(from, mockAnswer);
          addLog('signal', `Sent auto-reply SDP Answer back to: ${from}`);
        } 
        else if (signal.type === 'answer') {
          addLog('success', `SDP Answer received from ${from}. Connection negotiation successfully simulated! 🎉`);
        } 
        else if (signal.type === 'message') {
          addLog('signal', `Message content from ${from}: "${signal.content}"`);
        }
      }
    });

    // Cleanup on unmount
    return () => {
      socketService.unregisterEvents();
      socketService.disconnect();
    };
  }, []);

  // Handles joining room
  const handleJoinRoom = (e) => {
    e.preventDefault();
    const cleanRoomId = roomIdInput.trim();
    if (!cleanRoomId) return;

    socketService.joinRoom(cleanRoomId, (response) => {
      if (response && response.status === 'ok') {
        setActiveRoomId(response.roomId);
        setPeers(response.peers || []);
        addLog('success', `Successfully joined room "${response.roomId}". Found ${response.peers.length} other peers.`);
        if (response.peers.length > 0) {
          addLog('system', `Peers discovered: ${response.peers.join(', ')}`);
        }
      } else {
        addLog('error', `Failed to join room: ${response?.message || 'Unknown server error'}`);
      }
    });
  };

  // Triggers manual text signaling to a peer
  const triggerSendText = (peerId) => {
    setCustomMsgTarget(peerId);
    setCustomMsgInput('');
  };

  const submitTextMessage = (e) => {
    e.preventDefault();
    if (!customMsgInput.trim() || !customMsgTarget) return;

    const payload = {
      type: 'message',
      content: customMsgInput.trim()
    };
    
    socketService.sendSignal(customMsgTarget, payload);
    addLog('signal', `Sent direct text message to ${customMsgTarget}`);
    
    setCustomMsgTarget(null);
    setCustomMsgInput('');
  };

  // Triggers mock WebRTC SDP offer signaling to a peer
  const triggerMockHandshake = (peerId) => {
    addLog('system', `Initiating Mock WebRTC Handshake with peer ${peerId}...`);
    
    // Construct a mock SDP offer
    const mockOffer = {
      type: 'offer',
      sdp: `v=0\no=DevCollab-Offer ${Math.floor(Date.now()/1000)} IN IP4 127.0.0.1\ns=Mock Offer\nt=0 0\nc=IN IP4 127.0.0.1`
    };

    socketService.sendSignal(peerId, mockOffer);
    addLog('signal', `Sent mock SDP Offer to peer: ${peerId}`);
  };

  // Manually toggles connection
  const toggleConnection = () => {
    if (connectionStatus === 'connected') {
      socketService.disconnect();
    } else {
      setConnectionStatus('connecting');
      socketService.connect(
        (id) => {
          setSocketId(id);
          setConnectionStatus('connected');
          addLog('success', `Reconnected with ID: ${id}`);
        },
        () => {
          setSocketId('');
          setConnectionStatus('disconnected');
          setActiveRoomId('');
          setPeers([]);
        }
      );
    }
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 flex flex-col justify-between">
      {/* Top Navigation / App Title */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 mb-8 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent m-0 select-none">
            DevCollab Workspace
          </h1>
          <p className="text-sm text-slate-400 mt-1 select-none font-sans">
            Phase 1: WebRTC Room Management & Real-Time Signaling Relay
          </p>
        </div>

        <div className="mt-4 md:mt-0 flex items-center space-x-3">
          {/* Status Indicator */}
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full select-none">
            <span className={`w-2.5 h-2.5 rounded-full inline-block ${
              connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
              connectionStatus === 'connecting' ? 'bg-amber-500 animate-spin border border-dashed border-slate-100' :
              'bg-rose-500'
            }`} />
            <span className="text-xs font-mono text-slate-300 capitalize font-semibold">
              {connectionStatus}
            </span>
          </div>

          <button
            onClick={toggleConnection}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all ${
              connectionStatus === 'connected'
                ? 'bg-rose-950/45 hover:bg-rose-900/60 text-rose-300 border-rose-800'
                : 'bg-indigo-950/45 hover:bg-indigo-900/60 text-indigo-300 border-indigo-800'
            }`}
          >
            {connectionStatus === 'connected' ? 'DISCONNECT' : 'CONNECT'}
          </button>
        </div>
      </header>

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-8">
        
        {/* Left Side: Controller Forms */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Local client profile card */}
          <div className="glassmorphism p-5 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Client Identity</h3>
            {connectionStatus === 'connected' ? (
              <div className="space-y-3 font-mono">
                <div>
                  <span className="text-xs text-slate-500 block">SOCKET ID</span>
                  <span className="text-sm text-indigo-300 break-all font-semibold select-all bg-indigo-950/30 px-2 py-1 rounded border border-indigo-900/40 block mt-1">
                    {socketId}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">CURRENT ROOM</span>
                  <span className="text-sm text-emerald-300 break-all font-semibold bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/40 block mt-1">
                    {activeRoomId || 'Not in a room'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm font-mono text-rose-300">
                Disconnected from signaling server. Connect to generate a client session ID.
              </p>
            )}
          </div>

          {/* Join/Create room card */}
          <div className="glassmorphism p-5 rounded-2xl shadow-lg">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Room Management</h3>
            
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label htmlFor="room-id" className="block text-xs font-mono text-slate-400 mb-2">
                  ENTER ROOM ID
                </label>
                <input
                  id="room-id"
                  type="text"
                  placeholder="e.g. workspace-alpha"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  disabled={connectionStatus !== 'connected'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={connectionStatus !== 'connected' || !roomIdInput.trim()}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-650 hover:to-purple-750 text-white rounded-xl py-2.5 text-sm font-bold shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:transform-none"
              >
                JOIN ROOM
              </button>
            </form>
          </div>

        </div>

        {/* Right Side: Room Participants & Operations */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Peer Discovery and Signaling Simulation Workspace */}
          <div className="glassmorphism p-6 rounded-2xl shadow-lg min-h-[280px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-200">Active Room Workspace</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeRoomId ? `Connected participants inside "${activeRoomId}"` : 'Please join a room to discover peers.'}
                  </p>
                </div>
                {activeRoomId && (
                  <span className="text-xs font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-900 px-2.5 py-1 rounded-full">
                    {peers.length + 1} SESSIONS ACTIVE
                  </span>
                )}
              </div>

              {/* Peers listing */}
              {!activeRoomId ? (
                <div className="flex flex-col items-center justify-center py-10 text-center select-none">
                  <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500 mb-3 shadow">
                    📁
                  </div>
                  <h4 className="text-sm font-semibold text-slate-400">Waiting for Room Entry</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    Once you enter a Room ID and join, this area will list discovered socket clients in the same space.
                  </p>
                </div>
              ) : peers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center select-none">
                  <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500 mb-3 shadow animate-pulse">
                    📡
                  </div>
                  <h4 className="text-sm font-semibold text-indigo-400">Waiting for Peers to Join</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    You are currently the only developer session in room <strong className="text-slate-400">"{activeRoomId}"</strong>.
                  </p>
                  <p className="text-xxs text-indigo-400/70 font-mono mt-3 select-all bg-indigo-950/20 border border-indigo-900/35 px-2 py-0.5 rounded">
                    Tip: Open another browser window and join room "{activeRoomId}"
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {peers.map((peerId) => (
                    <div key={peerId} className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between relative hover:border-slate-700 transition-colors shadow">
                      
                      <div>
                        {/* Peer session card top */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-mono font-bold bg-slate-950 border border-slate-800/60 px-2 py-1 rounded text-slate-400">
                            PEER SESSION
                          </span>
                          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block animate-ping"></span>
                        </div>
                        
                        {/* Peer ID display */}
                        <span className="text-xs font-mono text-indigo-300 break-all select-all font-semibold bg-slate-950 border border-slate-850 px-2 py-1.5 rounded block mb-4">
                          {peerId}
                        </span>
                      </div>

                      {/* WebRTC testing actions */}
                      <div className="flex items-center space-x-2 pt-2 border-t border-slate-850">
                        <button
                          onClick={() => triggerMockHandshake(peerId)}
                          className="flex-1 py-1.5 text-xxs font-bold font-mono bg-indigo-600 hover:bg-indigo-750 text-white rounded-lg transition-all border border-indigo-500 hover:scale-102"
                        >
                          SDP HANDSHAKE
                        </button>
                        
                        <button
                          onClick={() => triggerSendText(peerId)}
                          className="px-3 py-1.5 text-xxs font-bold font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-all hover:scale-102"
                        >
                          MSG
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Inline message box popup */}
            {customMsgTarget && (
              <form onSubmit={submitTextMessage} className="mt-6 p-4 border border-indigo-850/60 bg-indigo-950/20 rounded-xl animate-fadeIn space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-indigo-400 font-medium">
                    Send Signal message to: <strong className="break-all">{customMsgTarget.substring(0, 8)}...</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomMsgTarget(null)}
                    className="text-slate-400 hover:text-rose-400 text-xs font-mono font-bold"
                  >
                    CANCEL
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Enter signal payload payload text..."
                    value={customMsgInput}
                    onChange={(e) => setCustomMsgInput(e.target.value)}
                    required
                    className="flex-1 bg-slate-950 border border-indigo-900 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500 placeholder-slate-700"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all font-mono"
                  >
                    SEND
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

      </div>

      {/* Retro log terminal console */}
      <TerminalConsole
        logs={logs}
        onClear={() => setLogs([])}
      />
    </div>
  );
}
