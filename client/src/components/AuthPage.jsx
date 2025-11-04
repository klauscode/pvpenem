import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';

export default function AuthPage({ authApi }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiFetch(`/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      localStorage.setItem('token', data.token);
      authApi.setToken(data.token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="card max-w-md w-full p-8">
        <h2 className="text-2xl font-semibold mb-2">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className="text-slate-400 mb-6">ENEM Arena — The Knowledge Race</p>
        <form onSubmit={submit} className="space-y-4">
          <input className="input" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="btn-primary w-full">{mode === 'login' ? 'Login' : 'Register'}</button>
        </form>
        {error && <div className="mt-3 text-red-400 text-sm">{error}</div>}
        <div className="mt-6 text-sm text-slate-400">
          {mode === 'login' ? 'No account?' : 'Already have an account?'}{' '}
          <button className="text-accent" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Register' : 'Login'}
          </button>
        </div>
      </div>
    </div>
  );
}
