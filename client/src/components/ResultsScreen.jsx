import React from 'react';

export default function ResultsScreen({ results }) {
  if (!results) return <div className="card p-6">No results yet.</div>;
  const { final_results, rewards } = results;
  const topicLabel = (() => {
    const map = {
      'matematica': 'Matemática',
      'linguagens': 'Linguagens',
      'ciencias-natureza': 'Ciências da Natureza',
      'ciencias-humanas': 'Ciências Humanas'
    };
    return map[final_results?.topic] || final_results?.topic || '';
  })();
  const meToken = localStorage.getItem('token');
  // We cannot decode safely without a lib; show both players succinctly
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 card p-6">
        <h2 className="text-xl font-semibold mb-2">Battle Complete</h2>
        <div className="text-slate-400 mb-4">Topic: <span className="text-slate-200">{topicLabel}</span></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-lg bg-slate-800/50">
            <div className="text-slate-400 text-sm">Player One</div>
            <div className="text-2xl font-semibold">{final_results.playerOne.correct} / {final_results.playerOne.total}</div>
            <div className="text-slate-400 text-sm">Accuracy: {(final_results.playerOne.accuracy * 100).toFixed(0)}%</div>
          </div>
          <div className="p-4 rounded-lg bg-slate-800/50">
            <div className="text-slate-400 text-sm">Player Two</div>
            <div className="text-2xl font-semibold">{final_results.playerTwo.correct} / {final_results.playerTwo.total}</div>
            <div className="text-slate-400 text-sm">Accuracy: {(final_results.playerTwo.accuracy * 100).toFixed(0)}%</div>
          </div>
        </div>
        <div className="mt-6 text-slate-300 text-sm">
          <details>
            <summary className="cursor-pointer text-slate-400">Raw data</summary>
            <pre className="mt-2 text-xs bg-slate-900 p-2 rounded">{JSON.stringify({ final_results, rewards }, null, 2)}</pre>
          </details>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="font-medium mb-3">Rewards</h3>
        <div className="text-sm text-slate-400 mb-2">Your KP and ELO change are applied.</div>
        <div className="text-xs text-slate-500">(Exact mapping depends on your userId; see Raw data)</div>
        <button className="btn-primary mt-6 w-full" onClick={() => (window.location.href = '/')}>Back Home</button>
      </div>
    </div>
  );
}
