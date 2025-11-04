import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import AuthPage from './AuthPage.jsx';
import HomePage from './HomePage.jsx';
import MatchmakingQueue from './MatchmakingQueue.jsx';
import BattleScreen from './BattleScreen.jsx';
import ResultsScreen from './ResultsScreen.jsx';

// This is a light skeleton to show how state and routing could be wired.

function Navbar({ onLogout }) {
  const loc = useLocation();
  const hideNav = loc.pathname === '/auth';
  if (hideNav) return null;
  return (
    <header className="sticky top-0 z-10 backdrop-blur bg-slate-950/60 border-b border-slate-800">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-semibold text-white">
          ENEM <span className="text-accent">Arena</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link to="/" className="hover:text-accent">Home</Link>
          <Link to="/queue" className="hover:text-accent">Queue</Link>
          <button onClick={onLogout} className="text-slate-300 hover:text-red-400">Logout</button>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [socket, setSocket] = useState(null);
  const [battle, setBattle] = useState(null); // { battleId, opponent, topic }
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!token) {
      if (socket) socket.disconnect();
      setSocket(null);
      return;
    }
    const wsUrl = (import.meta?.env?.VITE_WS_URL || import.meta?.env?.VITE_API_BASE || (import.meta?.env?.DEV ? 'http://localhost:4000' : ''));
    if (!wsUrl) {
      console.error('VITE_WS_URL not set in production; set to your backend URL.');
      return;
    }
    const normalized = wsUrl.endsWith('/') ? wsUrl.slice(0, -1) : wsUrl;
    const s = io(normalized, {
      auth: { token },
      transports: ['websocket']
    });
    setSocket(s);
    return () => s.disconnect();
  }, [token]);

  const authApi = useMemo(() => ({ setToken }), []);

  // Route guard
  const RequireAuth = ({ children }) => (token ? children : <Navigate to="/auth" />);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-cyber-900 via-cyber-700 to-cyber-900">
        <Navbar onLogout={() => { localStorage.removeItem('token'); setToken(null); window.location.href = '/auth'; }} />
        <main className="max-w-5xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/auth" element={<AuthPage authApi={authApi} />} />
            <Route path="/" element={<RequireAuth><HomePage socket={socket} /></RequireAuth>} />
            <Route path="/queue" element={<RequireAuth><MatchmakingQueue socket={socket} /></RequireAuth>} />
            <Route path="/battle" element={<RequireAuth><BattleScreen socket={socket} onComplete={setResults} /></RequireAuth>} />
            <Route path="/results" element={<RequireAuth><ResultsScreen results={results} /></RequireAuth>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
