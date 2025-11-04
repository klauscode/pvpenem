import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.js';

export default function HomePage({ socket }) {
  const [profile, setProfile] = useState(null);
  const [topic, setTopic] = useState('matematica');
  const [testMode, setTestMode] = useState(() => localStorage.getItem('testMode') === 'true');
  const [strictApi, setStrictApi] = useState(() => (localStorage.getItem('strictApi') ?? 'true') === 'true');

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('token');
      const res = await apiFetch('/users/profile', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setProfile(data.user);
    })();
  }, []);

  function play() {
    window.location.href = '/queue';
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 card p-6">
        <h2 className="text-xl font-semibold mb-4">Welcome, {profile?.username}</h2>
        <p className="text-slate-400 mb-6">Choose a topic and enter the arena. You have 10 minutes to answer as many questions as possible. Fast, focused, accurate.</p>
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Topic</label>
            <select className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="matematica">Matemática</option>
              <option value="linguagens">Linguagens</option>
              <option value="ciencias-natureza">Ciências da Natureza</option>
              <option value="ciencias-humanas">Ciências Humanas</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
              Test Mode (bot opponent)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={strictApi} onChange={(e) => setStrictApi(e.target.checked)} />
              Strict API questions only
            </label>
          </div>
          <button className="btn-primary" onClick={() => {
            localStorage.setItem('selectedTopic', topic);
            localStorage.setItem('testMode', String(testMode));
            localStorage.setItem('strictApi', String(strictApi));
            play();
          }}>Play</button>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="font-medium mb-3">Your Stats</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">ELO</span><span>{profile?.elo}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Knowledge Points</span><span>{profile?.kp}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Scholar Gems</span><span>{profile?.sg}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Win Streak</span><span>{profile?.winStreak}</span></div>
        </div>
      </div>
    </div>
  );
}
