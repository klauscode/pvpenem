import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MatchmakingQueue({ socket }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Searching...');

  useEffect(() => {
    const topic = localStorage.getItem('selectedTopic') || 'matematica';
    const test = localStorage.getItem('testMode') === 'true';
    const strictApi = localStorage.getItem('strictApi') === 'true';
    if (socket) socket.emit('enter_matchmaking', { topic, test, strictApi });
    const onFound = ({ opponent, battleId }) => {
      setStatus(`Matched vs ${opponent.username}`);
      setTimeout(() => navigate('/battle'), 300);
    };
    socket?.on('match_found', onFound);
    return () => socket?.off('match_found', onFound);
  }, [socket]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="h-10 w-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
        <h3 className="text-lg font-medium mb-2">{status}</h3>
        <p className="text-slate-400 mb-6">Waiting for another scholar to join your topic.</p>
        <button className="text-slate-300 hover:text-red-400" onClick={() => navigate('/')}>Cancel</button>
      </div>
    </div>
  );
}
