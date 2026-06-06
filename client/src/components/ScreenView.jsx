import React, { useEffect, useRef } from 'react';

/**
 * ScreenView component displays the active screen share stream with a premium widescreen layout.
 * @param {object} props
 * @param {MediaStream} props.stream The screen share media stream.
 * @param {string} props.sharerName The name or ID of the user sharing screen.
 * @param {boolean} props.isLocal True if the local user is sharing their own screen.
 * @param {Function} props.onRequestControl Callback to trigger remote control request (Phase 3).
 */
export default function ScreenView({ stream, sharerName, isLocal, onRequestControl }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-950 border border-indigo-500/25 shadow-2xl transition-all duration-300 aspect-video w-full max-w-4xl mx-auto group">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain bg-slate-950"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-900 select-none">
          <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl text-slate-500 mb-3 shadow animate-pulse">
            🖥️
          </div>
          <span className="text-sm font-semibold text-slate-400 font-sans uppercase tracking-wider">Connecting Screen Share...</span>
        </div>
      )}

      {/* Screen Sharer Badge & Status Indicator */}
      <div className="absolute top-4 left-4 flex items-center space-x-2 select-none pointer-events-none">
        <span className="flex h-2.5 w-2.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
        </span>
        <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-slate-950/80 backdrop-blur-md border border-slate-800/80 text-rose-400 shadow">
          {isLocal ? 'YOUR SCREEN' : `${sharerName}'S SCREEN`}
        </span>
      </div>

      {/* Request Control Button (Placeholder for Phase 3) */}
      {!isLocal && onRequestControl && (
        <div className="absolute bottom-4 right-4">
          <button
            onClick={onRequestControl}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-mono rounded-xl transition-all border border-indigo-500 hover:scale-102 cursor-pointer shadow-lg shadow-indigo-500/10"
          >
            REQUEST REMOTE CONTROL
          </button>
        </div>
      )}
    </div>
  );
}
