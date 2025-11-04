import React, { useEffect, useRef, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DURATION_MS = 10 * 60 * 1000;

export default function BattleScreen({ socket, onComplete }) {
  const [question, setQuestion] = useState(null);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION_MS / 1000);
  const timerRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'incorrect' | null

  const topicLabel = useMemo(() => {
    const map = {
      'matematica': 'Matemática',
      'linguagens': 'Linguagens',
      'ciencias-natureza': 'Ciências da Natureza',
      'ciencias-humanas': 'Ciências Humanas'
    };
    return question?.topic ? (map[question.topic] || question.topic) : '';
  }, [question?.topic]);

  useEffect(() => {
    function onStart({ first_question }) {
      setQuestion(first_question);
      if (!timerRef.current) {
        const started = Date.now();
        timerRef.current = setInterval(() => {
          const elapsed = Date.now() - started;
          setTimeLeft(Math.max(0, Math.floor((DURATION_MS - elapsed) / 1000)));
        }, 1000);
      }
    }
    function onAnswer({ result, next_question }) {
      if (result === 'correct') setMyScore((s) => s + 1);
      setFeedback(result);
      // small delay for feedback, then move on to next question
      setTimeout(() => {
        setQuestion(next_question);
        setSelected(null);
        setFeedback(null);
        setSubmitting(false);
      }, 420);
    }
    function onOpponent({ score }) { setOpponentScore(score); }
    function onCompleteEvt({ final_results, rewards }) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      onComplete?.({ final_results, rewards });
      window.location.href = '/results';
    }
    socket?.on('battle_start', onStart);
    socket?.on('answer_result', onAnswer);
    socket?.on('opponent_score_update', onOpponent);
    socket?.on('battle_complete', onCompleteEvt);
    return () => {
      socket?.off('battle_start', onStart);
      socket?.off('answer_result', onAnswer);
      socket?.off('opponent_score_update', onOpponent);
      socket?.off('battle_complete', onCompleteEvt);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [socket]);

  function submit(answer) {
    if (submitting) return;
    setSubmitting(true);
    setSelected(answer);
    socket?.emit('submit_answer', { answer });
  }

  if (!question) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="card p-8 text-center">Waiting for question...</div>
    </div>
  );
  const total = DURATION_MS / 1000;
  const pct = Math.max(0, Math.min(100, 100 - (timeLeft / total) * 100));
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 card p-6">
        <div className="mb-4">
          <div className="text-sm text-slate-400 mb-1">Time Left: {timeLeft}s</div>
          <div className="h-2 w-full bg-slate-800 rounded overflow-hidden">
            <div className="h-full bg-accent" style={{ width: `${100 - pct}%`, transition: 'width 1s linear' }} />
          </div>
        </div>
        <div className="flex items-center justify-between mb-2 text-sm text-slate-400">
          <div>Topic: <span className="text-slate-200">{topicLabel}</span></div>
          <div className="flex items-center gap-2">
            {localStorage.getItem('strictApi') === 'true' ? <span className="badge">Strict API</span> : null}
            {localStorage.getItem('testMode') === 'true' ? <span className="badge">Test Mode</span> : null}
          </div>
        </div>
        {question.context ? (
          <div className="mb-4 p-4 rounded bg-slate-800/50 text-sm text-slate-200 prose prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: (props) => <img {...props} className="max-h-72 object-contain rounded border border-slate-800" /> }}>
              {question.context}
            </ReactMarkdown>
          </div>
        ) : null}
        <h3 className="text-xl font-semibold mb-4">{question.text}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {question.options.map((opt, idx) => {
            const isObj = typeof opt === 'object' && opt !== null;
            const letter = isObj ? opt.letter : String.fromCharCode(65 + idx);
            const text = isObj ? opt.text : String(opt);
            const img = isObj ? opt.imageUrl : null;
            const isSel = selected && selected.toUpperCase() === String(letter).toUpperCase();
            const selClass = isSel && feedback === 'correct' ? 'ring-2 ring-emerald-400 bg-emerald-900/30' : isSel && feedback === 'incorrect' ? 'ring-2 ring-rose-500 bg-rose-900/30' : isSel ? 'ring-2 ring-primary-600/70 bg-slate-800/70' : '';
            return (
              <button key={letter + text} disabled={submitting} className={`px-4 py-3 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-left transition ${selClass} ${submitting ? 'opacity-80 cursor-not-allowed' : ''}`} onClick={() => submit(letter)}>
                <div className="font-semibold text-accent mb-1">{letter}</div>
                <div className="prose prose-invert max-w-none text-slate-200">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: (p) => <p className="m-0" {...p} /> }}>{text || ''}</ReactMarkdown>
                </div>
                {img ? <img src={img} alt={`option ${letter}`} className="mt-2 max-h-40 object-contain rounded border border-slate-700" /> : null}
              </button>
            );
          })}
        </div>
        {feedback ? (
          <div className="mt-4 flex items-center gap-2">
            {feedback === 'correct' ? (
              <span className="badge badge-success">✓ Correct</span>
            ) : (
              <span className="badge badge-danger">✗ Incorrect</span>
            )}
            <span className="text-slate-400 text-sm">Next question incoming…</span>
          </div>
        ) : null}
      </div>
      <div className="card p-6">
        <h4 className="font-medium mb-3">Live Score</h4>
        <div className="space-y-2">
          <div className="flex justify-between"><span className="text-slate-400">You</span><span className="text-white font-semibold">{myScore}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Opponent</span><span className="text-white font-semibold">{opponentScore}</span></div>
        </div>
        <p className="text-xs text-slate-500 mt-4">Tip: Answer quickly and accurately. No skips.</p>
      </div>
    </div>
  );
}
