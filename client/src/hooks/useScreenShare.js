import { useState, useRef, useCallback } from 'react';
import { socketService } from '../services/socket';

/**
 * Custom React hook to manage Screen Sharing lifecycle and WebRTC track replacement.
 * @param {object} params
 * @param {React.MutableRefObject<object>} params.pcsRef Reference to active RTCPeerConnection objects.
 * @param {React.MutableRefObject<MediaStream>} params.localStreamRef Reference to the local camera/mic stream.
 * @param {string} params.roomId The active room ID.
 */
export function useScreenShare({ pcsRef, localStreamRef, roomId }) {
  const [isSharing, setIsSharing] = useState(false);
  const screenStreamRef = useRef(null);

  const startShare = useCallback(async () => {
    try {
      console.log('[useScreenShare] Requesting screen sharing media...');
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          cursor: 'always',
        },
        audio: false,
      });

      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Swap track on every active peer connection
      Object.entries(pcsRef.current).forEach(([peerId, pc]) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          console.log(`[useScreenShare] Swapping video track to screen share for peer: ${peerId}`);
          sender.replaceTrack(screenTrack);
        }
      });

      setIsSharing(true);
      socketService.startScreenShare(roomId);

      // Handle user stopping share from native browser bar
      screenTrack.onended = () => {
        console.log('[useScreenShare] Screen track ended natively');
        stopShare();
      };
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error('[useScreenShare] Screen capture error:', err);
      }
    }
  }, [pcsRef, localStreamRef, roomId]);

  const stopShare = useCallback(() => {
    if (screenStreamRef.current) {
      console.log('[useScreenShare] Stopping screen share tracks...');
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    if (cameraTrack) {
      Object.entries(pcsRef.current).forEach(([peerId, pc]) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          console.log(`[useScreenShare] Swapping video track back to camera for peer: ${peerId}`);
          sender.replaceTrack(cameraTrack);
        }
      });
    }

    setIsSharing(false);
    socketService.stopScreenShare(roomId);
  }, [pcsRef, localStreamRef, roomId]);

  return {
    isSharing,
    startShare,
    stopShare,
    screenStream: screenStreamRef.current
  };
}
