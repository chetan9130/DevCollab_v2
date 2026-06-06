import React, { useEffect, useRef } from 'react';

/**
 * A beautiful, developer-themed retro-terminal console component.
 * Displays real-time WebSockets event logs with custom levels and timestamps.
 */
export default function TerminalConsole({ logs, onClear }) {
  const containerRef = useRef(null);

  // Auto-scroll terminal container to the bottom when logs change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  // Color mapping based on log type
  const getLogStyle = (type) => {
    switch (type) {
      case 'success':
        return 'text-emerald-400 font-semibold';
      case 'error':
        return 'text-rose-400 font-bold';
      case 'signal':
        return 'text-violet-400 font-semibold';
      case 'system':
        return 'text-sky-400 font-medium';
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="w-full flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl console-glow">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-slate-950 px-4 py-2 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          {/* Mock Window buttons */}
          <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
          <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
          <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
          <span className="text-xs font-mono text-slate-500 ml-2">devcollab-signaling-console ~ bash</span>
        </div>
        <button
          onClick={onClear}
          className="text-xs font-semibold px-2 py-1 bg-slate-850 hover:bg-indigo-650 text-slate-400 hover:text-white rounded border border-slate-800 hover:border-indigo-500 transition-all font-mono"
        >
          CLEAR LOGS
        </button>
      </div>

      {/* Log Feed */}
      <div
        ref={containerRef}
        className="flex-1 p-4 h-64 overflow-y-auto font-mono text-xs md:text-sm space-y-1.5 min-h-[220px] scroll-smooth"
      >
        {logs.length === 0 ? (
          <div className="text-slate-500 italic flex items-center h-full justify-center">
            <span>Terminal ready. Awaiting connection and socket events...</span>
            <span className="ml-1 animate-pulse border-r-2 border-indigo-500 h-4 w-1"></span>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start space-x-2 leading-relaxed hover:bg-slate-850/50 py-0.5 px-1 rounded transition-colors">
              <span className="text-indigo-400 select-none font-medium">
                [{log.timestamp}]
              </span>
              <span className="text-slate-500 font-medium select-none">
                {log.type.toUpperCase()}:
              </span>
              <span className={`flex-1 break-all ${getLogStyle(log.type)}`}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Terminal Footer */}
      <div className="bg-slate-950 px-4 py-2 border-t border-slate-800/60 flex items-center justify-between text-xxs font-mono text-slate-600">
        <span>Active Log Stream: Enabled</span>
        <div className="flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block"></span>
          <span>Listening to ws://localhost:5000</span>
        </div>
      </div>
    </div>
  );
}
