import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RoomPage from './pages/RoomPage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <Routes>
          {/* Main workspace room page */}
          <Route path="/" element={<RoomPage />} />
          
          {/* Fallback routing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;

