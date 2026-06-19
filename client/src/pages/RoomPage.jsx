import React, { useState, useEffect, useRef } from 'react';
import { socketService } from '../services/socket';
import TerminalConsole from '../components/TerminalConsole';
import { useScreenShare } from '../hooks/useScreenShare';
import ScreenView from '../components/ScreenView';

// Premium Video Feed Component for clean encapsulation
function VideoFeed({ stream, isMuted, className, name, camEnabled, micEnabled, mirror = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, camEnabled]);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800/80 shadow-lg transition-all duration-300 group hover:scale-[1.01] hover:border-indigo-500/30 aspect-video ${className}`}>
      {camEnabled && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className={`w-full h-full object-cover ${mirror ? 'transform scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-900">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-indigo-500/20 animate-pulse select-none">
            {name ? name.substring(0, 2).toUpperCase() : 'U'}
          </div>
          <span className="text-xs font-semibold text-slate-400 mt-3 font-sans uppercase tracking-wider select-none">Camera Off</span>
        </div>
      )}

      {/* Participant Name and Mic/Cam Badges Overlay */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none select-none">
        <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-950/80 backdrop-blur-md border border-slate-800/80 text-slate-300 shadow">
          {name}
        </span>
        <div className="flex space-x-1.5">
          {!micEnabled && (
            <span className="p-1.5 rounded-lg bg-rose-950/80 backdrop-blur-md border border-rose-800/80 text-rose-400 shadow">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6v4.5m0 0a3 3 0 003 3h.75m-.75-3H6m3.75 6v2.25m0-2.25H12m-2.25 0H7.5m10.5-13.5v3a3 3 0 01-3 3h-.75m.75-3h3m-6.75 3v-3a3 3 0 013-3h.75m-.75 3h3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
              </svg>
            </span>
          )}
          {!camEnabled && (
            <span className="p-1.5 rounded-lg bg-rose-950/80 backdrop-blur-md border border-rose-800/80 text-rose-400 shadow">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
              </svg>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RoomPage() {
  // Connection and client identity states
  const [socketId, setSocketId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [logs, setLogs] = useState([]);
  
  // Room states
  const [roomIdInput, setRoomIdInput] = useState('');
  const [activeRoomId, setActiveRoomId] = useState('');
  const [peers, setPeers] = useState([]);

  // WebRTC Media States
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { [peerId]: MediaStream }
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [peerStates, setPeerStates] = useState({}); // { [peerId]: { micEnabled, camEnabled } }

  // WebRTC Peer Connections References
  const pcsRef = useRef({}); // { [peerId]: RTCPeerConnection }
  const localStreamRef = useRef(null);
  const candidateQueuesRef = useRef({}); // { [peerId]: [RTCIceCandidate] }

  // Screen Sharing State
  const [screenSharer, setScreenSharer] = useState(null);

  // Screen Sharing Hook
  const { isSharing, startShare, stopShare, screenStream } = useScreenShare({
    pcsRef,
    localStreamRef,
    roomId: activeRoomId
  });

  // Synchronize screenSharer state when we start/stop sharing
  useEffect(() => {
    if (isSharing) {
      setScreenSharer(socketId);
    } else {
      setScreenSharer(current => current === socketId ? null : current);
    }
  }, [isSharing, socketId]);

  // Username states
  const [usernameInput, setUsernameInput] = useState('');
  const [activeUsername, setActiveUsername] = useState('');
  const [peerUsernames, setPeerUsernames] = useState({}); // { [peerId]: username }

  // Processes any queued ICE candidates for a peer once remote description is set
  const processIceQueue = async (peerId) => {
    const pc = pcsRef.current[peerId];
    const queue = candidateQueuesRef.current[peerId];
    if (pc && queue && queue.length > 0) {
      addLog('system', `Processing ${queue.length} queued ICE candidate(s) for ${peerId.substring(0, 6)}...`);
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Failed to add queued ICE candidate:', err);
        }
      }
      candidateQueuesRef.current[peerId] = [];
    }
  };

  // Modal or custom inline messaging state
  const [customMsgTarget, setCustomMsgTarget] = useState(null);
  const [customMsgInput, setCustomMsgInput] = useState('');
  const [copiedId, setCopiedId] = useState(null);

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

  // Helper to copy text to clipboard with modern API and robust fallback
  const handleCopy = (text, type) => {
    if (!text) return;

    // Try modern API first
    const tryModernCopy = () => {
      if (navigator.clipboard) {
        return navigator.clipboard.writeText(text);
      }
      return Promise.reject(new Error('Modern clipboard API not supported'));
    };

    // Fallback for non-secure contexts (HTTP), iframes, or unsupported browsers
    const tryFallbackCopy = () => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      // Configure styling to prevent page jump and hide the element
      textarea.style.position = 'absolute';
      textarea.style.opacity = '0';
      textarea.style.left = '-9999px';
      textarea.setAttribute('readonly', ''); // Prevent keyboard popup on iOS
      document.body.appendChild(textarea);
      
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, 99999); // Mobile compatibility
      
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) {
          return Promise.resolve();
        } else {
          return Promise.reject(new Error('execCommand copy returned false'));
        }
      } catch (err) {
        document.body.removeChild(textarea);
        return Promise.reject(err);
      }
    };

    tryModernCopy()
      .catch((err) => {
        console.warn('Modern clipboard API failed or restricted. Trying fallback copy method...', err);
        return tryFallbackCopy();
      })
      .then(() => {
        setCopiedId(type);
        addLog('success', `Copied ${type === 'session' ? 'Session ID' : 'Workspace Room ID'} to clipboard!`);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(err => {
        console.error('All clipboard copy attempts failed: ', err);
        addLog('error', 'Failed to copy to clipboard. Please copy manually.');
      });
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
        cleanupAllCalls();
        addLog('error', `Disconnected from signaling server. Reason: ${reason}`);
      }
    );

    socketService.registerEvents({
      onPeerJoined: ({ peerId, username }) => {
        setPeers((prev) => {
          if (!prev.includes(peerId)) {
            return [...prev, peerId];
          }
          return prev;
        });
        const displayName = username || `Peer_${peerId.substring(0, 4)}`;
        setPeerUsernames(prev => ({ ...prev, [peerId]: displayName }));
        addLog('success', `Peer joined: ${displayName}`);
        // Initialize peer connection as receiver (wait for offer)
        initializePeerConnection(peerId, false);
      },
      
      onPeerLeft: ({ peerId }) => {
        cleanupPeer(peerId);
        addLog('system', `Peer left: ${peerId}`);
      },
      
      onSignal: async ({ from, signal }) => {
        addLog('signal', `Received signal from ${from.substring(0, 6)}... | Type: ${signal.type}`);
        
        if (signal.type === 'offer') {
          try {
            let pc = pcsRef.current[from];
            if (!pc) {
              pc = await initializePeerConnection(from, false);
            }
            
            await pc.setRemoteDescription(new RTCSessionDescription({
              type: 'offer',
              sdp: signal.sdp
            }));
            
            addLog('system', 'SDP Offer accepted. Creating SDP Answer...');
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            socketService.sendSignal(from, {
              type: 'answer',
              sdp: pc.localDescription.sdp
            });
            addLog('signal', `Sent SDP Answer back to: ${from.substring(0, 6)}...`);

            // Flush any ICE candidates that arrived before the offer was set
            await processIceQueue(from);
          } catch (err) {
            console.error('Failed to handle SDP offer:', err);
            addLog('error', `Error responding to SDP Offer from ${from.substring(0, 6)}...`);
          }
        } 
        else if (signal.type === 'answer') {
          try {
            const pc = pcsRef.current[from];
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription({
                type: 'answer',
                sdp: signal.sdp
              }));
              addLog('success', `WebRTC SDP Handshake completed with: ${from.substring(0, 6)}...! 🎉`);
              
              // Flush any ICE candidates that arrived before the answer was set
              await processIceQueue(from);
            } else {
              console.warn(`[WebRTC] Answer received but no RTCPeerConnection exists for peer ${from}`);
            }
          } catch (err) {
            console.error('Failed to handle SDP answer:', err);
            addLog('error', `Error setting SDP Answer from ${from.substring(0, 6)}...`);
          }
        } 
        else if (signal.type === 'candidate') {
          try {
            const pc = pcsRef.current[from];
            // Only add candidate if remoteDescription is already set
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } else {
              // Otherwise queue it
              if (!candidateQueuesRef.current[from]) {
                candidateQueuesRef.current[from] = [];
              }
              candidateQueuesRef.current[from].push(signal.candidate);
              console.log(`[WebRTC] Queued ICE candidate from ${from.substring(0, 6)}...`);
            }
          } catch (err) {
            console.error('Failed to add ICE candidate:', err);
          }
        }
        else if (signal.type === 'media_state') {
          setPeerStates(prev => ({
            ...prev,
            [from]: {
              camEnabled: signal.camEnabled,
              micEnabled: signal.micEnabled
            }
          }));
        }
        else if (signal.type === 'message') {
          addLog('signal', `Message from ${from.substring(0, 6)}...: "${signal.content}"`);
        }
      },

      onScreenShareStarted: ({ from }) => {
        addLog('system', `Screen share started by: ${from.substring(0, 6)}...`);
        setScreenSharer(from);
      },

      onScreenShareStopped: ({ from }) => {
        addLog('system', `Screen share stopped by: ${from.substring(0, 6)}...`);
        setScreenSharer(currentSharer => currentSharer === from ? null : currentSharer);
      }
    });

    // Cleanup on unmount
    return () => {
      cleanupAllCalls();
      socketService.unregisterEvents();
      socketService.disconnect();
    };
  }, []);

  // Set up local user media devices
  const startLocalStream = async () => {
    try {
      addLog('system', 'Requesting camera and microphone permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCamEnabled(true);
      setMicEnabled(true);
      addLog('success', 'Camera and microphone feeds acquired.');
      return stream;
    } catch (err) {
      console.warn('Could not acquire both video and audio. Trying microphone-only fallback...', err);
      addLog('warning', 'Video input blocked or unavailable. Falling back to audio-only call...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setCamEnabled(false);
        setMicEnabled(true);
        addLog('success', 'Microphone feed acquired (Audio-only fallback).');
        return stream;
      } catch (errAudio) {
        console.error('All media acquisition failed.', errAudio);
        addLog('error', 'Failed to access camera/mic: permissions denied. Joining call as listener/receiver.');
        localStreamRef.current = null;
        setLocalStream(null);
        setCamEnabled(false);
        setMicEnabled(false);
        return null;
      }
    }
  };

  // Stop local media tracks
  const stopLocalStream = () => {
    if (localStreamRef.current) {
      addLog('system', 'Stopping camera and microphone tracks...');
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  };

  // Initialize RTCPeerConnection for a peer
  const initializePeerConnection = async (peerId, isInitiator, stream) => {
    if (pcsRef.current[peerId]) {
      return pcsRef.current[peerId];
    }

    addLog('system', `Creating RTCPeerConnection for peer ID: ${peerId.substring(0, 6)}...`);
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pcsRef.current[peerId] = pc;

    // Attach local stream tracks to this peer connection
    const activeStream = stream || localStreamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach(track => {
        pc.addTrack(track, activeStream);
      });
      addLog('system', `Attached local media tracks to ${peerId.substring(0, 6)}...`);
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendSignal(peerId, {
          type: 'candidate',
          candidate: event.candidate
        });
      }
    };

    // Connection state logging
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state change with ${peerId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        cleanupPeer(peerId);
      }
    };

    // Remote Track handler
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track from ${peerId}:`, event.track);
      addLog('success', `Remote track (${event.track.kind}) received from ${peerId.substring(0, 6)}...`);
      
      const remoteStream = event.streams[0] || new MediaStream();
      setRemoteStreams(prev => {
        // Create a new MediaStream instance with all current tracks from the stream
        // to guarantee a reference change and force React/video binding update.
        const newStream = new MediaStream(remoteStream.getTracks());
        return {
          ...prev,
          [peerId]: newStream
        };
      });
    };

    // If initiator, negotiate with offer
    if (isInitiator) {
      try {
        addLog('system', `Creating and sending SDP Offer to: ${peerId.substring(0, 6)}...`);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketService.sendSignal(peerId, {
          type: 'offer',
          sdp: pc.localDescription.sdp
        });
      } catch (err) {
        console.error('Failed to create SDP offer for peer:', peerId, err);
        addLog('error', `Failed to create SDP Offer for ${peerId.substring(0, 6)}...`);
      }
    } else {
      // Send our current microphone and camera status to the newly joined peer immediately
      socketService.sendSignal(peerId, {
        type: 'media_state',
        camEnabled: camEnabled,
        micEnabled: micEnabled
      });
    }

    return pc;
  };

  // Clean up connection to a specific peer
  const cleanupPeer = (peerId) => {
    if (pcsRef.current[peerId]) {
      pcsRef.current[peerId].close();
      delete pcsRef.current[peerId];
    }
    if (candidateQueuesRef.current[peerId]) {
      delete candidateQueuesRef.current[peerId];
    }
    setScreenSharer(currentSharer => currentSharer === peerId ? null : currentSharer);
    setPeerUsernames(prev => {
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
    setRemoteStreams(prev => {
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
    setPeerStates(prev => {
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
    setPeers(prev => prev.filter(id => id !== peerId));
  };

  // Reset and leave all connections and calls
  const cleanupAllCalls = () => {
    try {
      stopShare();
    } catch (err) {
      console.warn('Error stopping screen share during cleanup:', err);
    }
    stopLocalStream();
    Object.keys(pcsRef.current).forEach(peerId => {
      pcsRef.current[peerId].close();
    });
    pcsRef.current = {};
    candidateQueuesRef.current = {};
    setRemoteStreams({});
    setPeerStates({});
    setPeers([]);
    setActiveRoomId('');
    setScreenSharer(null);
    setPeerUsernames({});
  };

  // Handles joining room and starts WebRTC call
  const handleJoinRoom = async (e) => {
    e.preventDefault();
    const cleanRoomId = roomIdInput.trim();
    if (!cleanRoomId) return;

    const chosenUsername = usernameInput.trim() || `User_${socketId ? socketId.substring(0, 4) : 'local'}`;

    cleanupAllCalls();
    addLog('system', `Joining workspace room: "${cleanRoomId}" as "${chosenUsername}"...`);

    // 1. Acquire local camera and mic first
    const stream = await startLocalStream();

    // 2. Connect to the room
    socketService.joinRoom(cleanRoomId, chosenUsername, (response) => {
      if (response && response.status === 'ok') {
        setActiveRoomId(response.roomId);
        setActiveUsername(chosenUsername);
        setPeers(response.peers || []);
        addLog('success', `Joined room "${response.roomId}". Discovered ${response.peers.length} other peer(s).`);
        
        if (response.peerUsernames) {
          setPeerUsernames(response.peerUsernames);
        }

        if (response.screenSharer) {
          const sharerName = response.peerUsernames?.[response.screenSharer] || response.screenSharer.substring(0, 6);
          addLog('system', `Active screen share in room by: ${sharerName}`);
          setScreenSharer(response.screenSharer);
        }

        // 3. Initiate WebRTC peer connections with each existing peer
        response.peers.forEach(peerId => {
          initializePeerConnection(peerId, true, stream);
        });
      } else {
        addLog('error', `Failed to join room: ${response?.message || 'Unknown server error'}`);
        stopLocalStream();
      }
    });
  };

  // Handles leaving room
  const handleLeaveRoom = () => {
    if (activeRoomId) {
      addLog('system', `Leaving room: "${activeRoomId}"...`);
      socketService.leaveRoom(activeRoomId, () => {
        addLog('success', `Successfully left room: "${activeRoomId}"`);
        cleanupAllCalls();
      });
    }
  };

  // Toggles video camera
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const nextState = !videoTrack.enabled;
        videoTrack.enabled = nextState;
        setCamEnabled(nextState);
        addLog('system', `Camera toggled ${nextState ? 'ON' : 'OFF'}`);
        
        // Broadcast state change
        peers.forEach(peerId => {
          socketService.sendSignal(peerId, {
            type: 'media_state',
            camEnabled: nextState,
            micEnabled: micEnabled
          });
        });
      } else {
        addLog('warning', 'No video device available to toggle');
      }
    }
  };

  // Toggles microphone
  const toggleMicrophone = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const nextState = !audioTrack.enabled;
        audioTrack.enabled = nextState;
        setMicEnabled(nextState);
        addLog('system', `Microphone toggled ${nextState ? 'UNMUTED' : 'MUTED'}`);
        
        // Broadcast state change
        peers.forEach(peerId => {
          socketService.sendSignal(peerId, {
            type: 'media_state',
            camEnabled: camEnabled,
            micEnabled: nextState
          });
        });
      } else {
        addLog('warning', 'No audio device available to toggle');
      }
    }
  };

  // Triggers direct message input modal
  const triggerSendText = (peerId) => {
    setCustomMsgTarget(peerId);
    setCustomMsgInput('');
  };

  // Submit direct message
  const submitTextMessage = (e) => {
    e.preventDefault();
    if (!customMsgInput.trim() || !customMsgTarget) return;

    const payload = {
      type: 'message',
      content: customMsgInput.trim()
    };
    
    socketService.sendSignal(customMsgTarget, payload);
    addLog('signal', `Sent message to ${customMsgTarget.substring(0, 8)}...`);
    
    setCustomMsgTarget(null);
    setCustomMsgInput('');
  };

  // Manually toggles connection to signaling server
  const toggleConnection = () => {
    if (connectionStatus === 'connected') {
      cleanupAllCalls();
      socketService.disconnect();
    } else {
      setConnectionStatus('connecting');
      socketService.connect(
        (id) => {
          setSocketId(id);
          setConnectionStatus('connected');
          addLog('success', `Reconnected. Socket ID: ${id}`);
        },
        () => {
          setSocketId('');
          setConnectionStatus('disconnected');
          cleanupAllCalls();
        }
      );
    }
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 flex flex-col justify-between">
      {/* Header Panel */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 mb-8 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 bg-clip-text text-transparent m-0 select-none">
            DevCollab Workspace
          </h1>
          <p className="text-sm text-slate-400 mt-1 select-none font-sans">
            Phase 2: Live WebRTC Video & Audio Calling (Mesh Call)
          </p>
        </div>

        <div className="mt-4 md:mt-0 flex items-center space-x-3">
          {/* Connection Status Indicator */}
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full select-none">
            <span className={`w-2.5 h-2.5 rounded-full inline-block ${
              connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
              connectionStatus === 'connecting' ? 'bg-amber-500 animate-spin border border-dashed border-slate-100' :
              'bg-rose-500'
            }`} />
            <span className="text-xs font-mono text-slate-300 capitalize font-semibold font-sans">
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
        
        {/* Left Columns: Control & Identity Card */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* User profile card */}
          <div className="glassmorphism p-5 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 select-none">My Session</h3>
            {connectionStatus === 'connected' ? (
              <div className="space-y-3 font-mono">
                {activeUsername && (
                  <div>
                    <span className="text-xs text-slate-500 block">USERNAME</span>
                    <span className="text-sm text-pink-300 break-all font-semibold bg-pink-950/20 px-2 py-1 rounded border border-pink-900/30 block mt-1">
                      {activeUsername}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-xs text-slate-500 block">SESSION ID</span>
                  <div className="flex items-center justify-between bg-indigo-950/30 px-2 py-1 rounded border border-indigo-900/40 mt-1">
                    <span className="text-sm text-indigo-300 break-all font-semibold select-all truncate mr-2">
                      {socketId}
                    </span>
                    <button
                      onClick={() => handleCopy(socketId, 'session')}
                      className="p-1 rounded bg-indigo-900/40 hover:bg-indigo-900/70 text-indigo-300 hover:text-indigo-100 transition-colors cursor-pointer shrink-0"
                      title="Copy Session ID"
                    >
                      {copiedId === 'session' ? (
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">WORKSPACE ROOM</span>
                  <div className="flex items-center justify-between bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/40 mt-1">
                    <span className="text-sm text-emerald-300 break-all font-semibold truncate mr-2">
                      {activeRoomId || 'Not in a room'}
                    </span>
                    {activeRoomId && (
                      <button
                        onClick={() => handleCopy(activeRoomId, 'room')}
                        className="p-1 rounded bg-emerald-900/40 hover:bg-emerald-900/70 text-emerald-300 hover:text-emerald-100 transition-colors cursor-pointer shrink-0"
                        title="Copy Room ID"
                      >
                        {copiedId === 'room' ? (
                          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm font-mono text-rose-300 select-none">
                Not connected. Click connect above to start session.
              </p>
            )}
          </div>

          {/* Room joining card */}
          <div className="glassmorphism p-5 rounded-2xl shadow-lg">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 select-none">Call Setup</h3>
            
            {!activeRoomId ? (
              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-xs font-mono text-slate-400 mb-2">
                    YOUR USERNAME
                  </label>
                  <input
                    id="username"
                    type="text"
                    placeholder="e.g. karan"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    disabled={connectionStatus !== 'connected'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                </div>

                <div>
                  <label htmlFor="room-id" className="block text-xs font-mono text-slate-400 mb-2">
                    WORKSPACE ROOM ID
                  </label>
                  <input
                    id="room-id"
                    type="text"
                    placeholder="e.g. video-meeting-room"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value)}
                    disabled={connectionStatus !== 'connected'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={connectionStatus !== 'connected' || !roomIdInput.trim()}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-650 hover:to-purple-750 text-white rounded-xl py-2.5 text-sm font-bold shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:transform-none cursor-pointer"
                >
                  START / JOIN CALL
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl">
                  <span className="text-xs text-emerald-400 font-semibold block mb-1">Live Call Active</span>
                  <span className="text-xs text-slate-400">You are connected to room <strong className="text-slate-200">"{activeRoomId}"</strong></span>
                </div>
                <button
                  onClick={handleLeaveRoom}
                  className="w-full bg-rose-950/45 hover:bg-rose-900/60 text-rose-300 border border-rose-800 rounded-xl py-2.5 text-sm font-bold transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  DISCONNECT CALL
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right Columns: Video Grid Room Workspace */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Video call workspace */}
          <div className="glassmorphism p-6 rounded-2xl shadow-lg min-h-[350px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-200">Live Video Workspace</h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-sans">
                    {activeRoomId ? `Connected participants inside "${activeRoomId}"` : 'Please join a room to start video calling.'}
                  </p>
                </div>
                {activeRoomId && (
                  <span className="text-xs font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-900 px-2.5 py-1 rounded-full">
                    {peers.length + 1} ONLINE
                  </span>
                )}
              </div>

              {/* Grid content / waiting triggers */}
              {!activeRoomId ? (
                <div className="flex flex-col items-center justify-center py-16 text-center select-none">
                  <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-2xl text-slate-500 mb-4 shadow">
                    📹
                  </div>
                  <h4 className="text-base font-semibold text-slate-300 font-sans">Workspace Call Off</h4>
                  <p className="text-sm text-slate-500 max-w-sm mt-1 font-sans">
                    Enter a workspace Room ID and click Join. Your browser will prompt for camera and microphone access to link with other sessions.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Pinned Screen Share */}
                  {screenSharer && (
                    <div className="mb-6">
                      <ScreenView
                        stream={isSharing ? screenStream : remoteStreams[screenSharer]}
                        sharerName={screenSharer === socketId ? activeUsername : (peerUsernames[screenSharer] || screenSharer.substring(0, 6))}
                        isLocal={screenSharer === socketId || isSharing}
                        onRequestControl={screenSharer !== socketId ? () => addLog('system', `Requested remote control for ${peerUsernames[screenSharer] || screenSharer.substring(0, 6)} (wiring in Phase 3)...`) : null}
                      />
                    </div>
                  )}

                  {/* WebRTC Video Feeds Grid */}
                  <div className={`grid gap-4 ${
                    screenSharer 
                      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 max-w-3xl mx-auto' 
                      : peers.length === 0 
                      ? 'grid-cols-1 max-w-md mx-auto' 
                      : peers.length === 1 
                      ? 'grid-cols-1 sm:grid-cols-2' 
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  }`}>
                    {/* Local Stream (Muted self view) */}
                    <VideoFeed
                      stream={localStream}
                      isMuted={true}
                      className={`border-indigo-500/35 glow-indigo/5 ${screenSharer ? 'aspect-video' : ''}`}
                      name={`${activeUsername || 'Local'} (You)`}
                      camEnabled={camEnabled}
                      micEnabled={micEnabled}
                      mirror={true}
                    />

                    {/* Remote Streams */}
                    {Object.entries(remoteStreams).map(([peerId, stream]) => {
                      const state = peerStates[peerId] || { camEnabled: true, micEnabled: true };
                      return (
                        <VideoFeed
                          key={peerId}
                          stream={stream}
                          isMuted={false}
                          className="border-slate-800 hover:border-indigo-500/20"
                          name={peerUsernames[peerId] || `Peer: ${peerId.substring(0, 6)}`}
                          camEnabled={state.camEnabled}
                          micEnabled={state.micEnabled}
                          mirror={false}
                        />
                      );
                    })}
                  </div>

                  {/* WebRTC Controls Panel */}
                  <div className="flex items-center justify-center space-x-4 p-3 bg-slate-950/60 border border-slate-800 rounded-2xl max-w-sm mx-auto shadow-md">
                    {/* Toggle Microphone */}
                    <button
                      onClick={toggleMicrophone}
                      disabled={!localStream}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        micEnabled 
                          ? 'bg-slate-900 border-slate-800 text-indigo-400 hover:text-indigo-300 hover:bg-slate-850' 
                          : 'bg-rose-950/60 border-rose-800 text-rose-400 hover:text-rose-300 hover:bg-rose-900/60'
                      } disabled:opacity-50`}
                      title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
                    >
                      {micEnabled ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 116 0v8.25a3 3 0 0 1-3 3z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9a3 3 0 0 0 3 3h.75m-.75-3H6m3.75 6v2.25m0-2.25H12m-2.25 0H7.5m10.5-13.5v3a3 3 0 0 1-3 3h-.75m.75-3h3m-6.75 3v-3a3 3 0 0 1 3-3h.75m-.75 3h3" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5" />
                        </svg>
                      )}
                    </button>

                    {/* Toggle Camera */}
                    <button
                      onClick={toggleCamera}
                      disabled={!localStream || !localStream.getVideoTracks().length}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        camEnabled 
                          ? 'bg-slate-900 border-slate-800 text-indigo-400 hover:text-indigo-300 hover:bg-slate-850' 
                          : 'bg-rose-950/60 border-rose-800 text-rose-400 hover:text-rose-300 hover:bg-rose-900/60'
                      } disabled:opacity-50`}
                      title={camEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                    >
                      {camEnabled ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9" />
                        </svg>
                      )}
                    </button>

                    {/* Toggle Screen Share */}
                    <button
                      onClick={isSharing ? stopShare : startShare}
                      disabled={!localStream || (screenSharer && screenSharer !== socketId)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSharing 
                          ? 'bg-rose-950/60 border-rose-800 text-rose-400 hover:text-rose-350 hover:bg-rose-900/60 animate-pulse' 
                          : 'bg-slate-900 border-slate-800 text-indigo-400 hover:text-indigo-300 hover:bg-slate-850'
                      } disabled:opacity-30`}
                      title={isSharing ? 'Stop Screen Share' : 'Share Screen'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                      </svg>
                    </button>

                    {/* Disconnect/Leave call */}
                    <button
                      onClick={handleLeaveRoom}
                      className="p-3 rounded-xl border bg-rose-900/80 border-rose-700 text-rose-100 hover:bg-rose-800 transition-all cursor-pointer"
                      title="Leave Call"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Peer Session Listing below (shows direct text messaging option) */}
              {activeRoomId && peers.length > 0 && (
                <div className="mt-8 border-t border-slate-800/80 pt-6">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 select-none">Active Dev Sessions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {peers.map((peerId) => (
                      <div key={peerId} className="bg-slate-900/50 border border-slate-800/40 rounded-xl p-3 flex items-center justify-between hover:border-slate-800 transition-colors shadow-inner">
                        <div className="flex items-center space-x-2.5 overflow-hidden">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                          <span className="text-xs font-mono text-indigo-300 truncate font-semibold" title={`${peerUsernames[peerId] || 'User'} (${peerId})`}>
                            {peerUsernames[peerId] || peerId.substring(0, 12)}
                          </span>
                        </div>
                        <button
                          onClick={() => triggerSendText(peerId)}
                          className="px-2.5 py-1 text-xxs font-bold font-mono bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-all cursor-pointer"
                        >
                          MSG
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Waiting state in room */}
              {activeRoomId && peers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center select-none">
                  <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500 mb-3 shadow animate-pulse">
                    📡
                  </div>
                  <h4 className="text-sm font-semibold text-indigo-400 font-sans">Waiting for Peers to Join</h4>
                  <p className="text-xs text-slate-500 max-w-xs mt-1 font-sans">
                    You are currently the only session in room <strong className="text-slate-400">"{activeRoomId}"</strong>.
                  </p>
                  <p className="text-xxs text-indigo-400/70 font-mono mt-3 select-all bg-indigo-950/20 border border-indigo-900/35 px-2.5 py-1 rounded">
                    Tip: Open another browser window and join room "{activeRoomId}"
                  </p>
                </div>
              )}
            </div>

            {/* Inline custom message box */}
            {customMsgTarget && (
              <form onSubmit={submitTextMessage} className="mt-6 p-4 border border-indigo-900/40 bg-indigo-950/10 rounded-xl animate-fadeIn space-y-3">
                <div className="flex justify-between items-center select-none">
                  <span className="text-xs font-mono text-indigo-400 font-medium">
                    Send Signal payload message to: <strong className="break-all">{peerUsernames[customMsgTarget] || customMsgTarget.substring(0, 8)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomMsgTarget(null)}
                    className="text-slate-400 hover:text-rose-400 text-xs font-mono font-bold cursor-pointer"
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
                    className="flex-1 bg-slate-950 border border-indigo-900/40 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500 placeholder-slate-700"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all font-mono cursor-pointer"
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
