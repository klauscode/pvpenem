import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Server as SocketIOServer } from 'socket.io';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import leaderboardRoutes from './routes/leaderboard.js';
import gachaRoutes from './routes/gacha.js';

import User from './models/User.js';
import Battle from './models/Battle.js';
import { socketAuthMiddleware } from './middleware/auth.js';
import { expectedScore, newRating, kFactorForGames } from './services/elo.js';
import { fetchQuestion, getCorrectAnswer, getAnswerDetail } from './services/questions.js';

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/enem_arena';
const MATCH_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const DISCONNECT_GRACE_MS = 60 * 1000; // 60 seconds

let memoryServer = null;

async function connectWithFallback() {
  try {
    await mongoose.connect(MONGODB_URI, { dbName: process.env.MONGO_DBNAME || undefined });
    console.log(`[DB] Connected to MongoDB at ${MONGODB_URI}`);
    return 'mongo';
  } catch (err) {
    console.warn(`[DB] Failed to connect to ${MONGODB_URI}. Falling back to in-memory MongoDB. Reason: ${err?.message}`);
    memoryServer = await MongoMemoryServer.create();
    const uri = memoryServer.getUri();
    await mongoose.connect(uri);
    console.log(`[DB] Connected to in-memory MongoDB`);
    return 'memory';
  }
}

function makeCorsOrigin(allowed) {
  if (!allowed || allowed === '*') {
    return (origin, callback) => callback(null, true);
  }
  const items = String(allowed)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const patterns = items.map((s) => {
    if (s.includes('*')) {
      const esc = s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      const rx = '^' + esc.replace(/\*/g, '.*') + '$';
      return new RegExp(rx);
    }
    return s;
  });
  return (origin, callback) => {
    if (!origin) return callback(null, true);
    const ok = patterns.some((p) => (p instanceof RegExp ? p.test(origin) : p === origin));
    callback(ok ? null : new Error('Not allowed by CORS'), ok);
  };
}

const corsOrigin = makeCorsOrigin(process.env.CORS_ORIGIN || '*');

const app = express();
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/gacha', gachaRoutes);

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: corsOrigin, credentials: true }
});

io.use(socketAuthMiddleware);

// Matchmaking and battle state
const topicQueues = new Map(); // topic -> [ { userId, username, socketId } ]
const battles = new Map(); // battleId -> battleState
const socketToBattle = new Map(); // socketId -> { battleId, side: 'one'|'two' }

function getQueue(topic) {
  if (!topicQueues.has(topic)) topicQueues.set(topic, []);
  return topicQueues.get(topic);
}

function makeBattleId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nowMs() {
  return Date.now();
}

async function startBattle(topic, p1, p2, options = {}) {
  const battleId = makeBattleId();
  const room = `battle_${battleId}`;
  const startTime = nowMs();
  const endAt = startTime + MATCH_DURATION_MS;

  const strictApi = !!options.strictApi;
  const isTestBattle = !!options.isTestBattle;
  let firstQ1, firstQ2;
  try {
    firstQ1 = await fetchQuestion(topic, { strictApi });
    firstQ2 = await fetchQuestion(topic, { strictApi });
  } catch (err) {
    const s1 = io.sockets.sockets.get(p1.socketId);
    const s2 = io.sockets.sockets.get(p2.socketId);
    s1?.emit('battle_complete', { final_results: null, error: 'ENEM_API_UNAVAILABLE' });
    s2?.emit('battle_complete', { final_results: null, error: 'ENEM_API_UNAVAILABLE' });
    return null;
  }

  const state = {
    battleId,
    topic,
    room,
    startTime,
    endAt,
    timer: null,
    strictApi,
    isTestBattle,
    playerOne: {
      userId: p1.userId,
      username: p1.username,
      socketId: p1.socketId,
      score: 0,
      totalAnswers: 0,
      correctAnswers: 0,
      lastCorrectAt: null,
      currentQuestion: firstQ1,
      disconnected: false,
      disconnectTimer: null
    },
    playerTwo: {
      userId: p2.userId,
      username: p2.username,
      socketId: p2.socketId,
      isBot: p2.isBot || false,
      score: 0,
      totalAnswers: 0,
      correctAnswers: 0,
      lastCorrectAt: null,
      currentQuestion: firstQ2,
      disconnected: false,
      disconnectTimer: null
    }
  };

  battles.set(battleId, state);
  socketToBattle.set(p1.socketId, { battleId, side: 'one' });
  socketToBattle.set(p2.socketId, { battleId, side: 'two' });

  const s1 = io.sockets.sockets.get(p1.socketId);
  const s2 = io.sockets.sockets.get(p2.socketId);
  if (s1) s1.join(room);
  if (s2) s2.join(room);

  const opponent1 = { id: p2.userId, username: p2.username };
  const opponent2 = { id: p1.userId, username: p1.username };
  if (s1) s1.emit('match_found', { opponent: opponent1, battleId });
  if (s2) s2.emit('match_found', { opponent: opponent2, battleId });

  if (s1) s1.emit('battle_start', { first_question: firstQ1 });
  if (s2) s2.emit('battle_start', { first_question: firstQ2 });

  state.timer = setTimeout(() => {
    completeBattle(battleId, 'time');
  }, MATCH_DURATION_MS);

  if (state.playerTwo.isBot) {
    scheduleBot(state);
  }

  return state;
}

function accuracy(player) {
  return player.totalAnswers > 0 ? player.correctAnswers / player.totalAnswers : 0;
}

async function computeKFactor(userId) {
  const gamesPlayed = await Battle.countDocuments({
    $or: [{ playerOneId: userId }, { playerTwoId: userId }]
  });
  return kFactorForGames(gamesPlayed);
}

async function completeBattle(battleId, reason = 'time', forfeitLoserSide = null) {
  const state = battles.get(battleId);
  if (!state) return;

  // Prevent double finish
  battles.delete(battleId);
  if (state.timer) clearTimeout(state.timer);
  if (state.playerOne.disconnectTimer) clearTimeout(state.playerOne.disconnectTimer);
  if (state.playerTwo.disconnectTimer) clearTimeout(state.playerTwo.disconnectTimer);

  const p1 = state.playerOne;
  const p2 = state.playerTwo;

  // Determine winner per rules
  let winner = null; // 'one' | 'two' | 'draw'
  if (forfeitLoserSide === 'one') winner = 'two';
  else if (forfeitLoserSide === 'two') winner = 'one';
  else {
    if (p1.correctAnswers > p2.correctAnswers) winner = 'one';
    else if (p2.correctAnswers > p1.correctAnswers) winner = 'two';
    else {
      const acc1 = accuracy(p1);
      const acc2 = accuracy(p2);
      if (acc1 > acc2) winner = 'one';
      else if (acc2 > acc1) winner = 'two';
      else {
        const t1 = p1.lastCorrectAt ?? Infinity;
        const t2 = p2.lastCorrectAt ?? Infinity;
        if (t1 < t2) winner = 'one';
        else if (t2 < t1) winner = 'two';
        else winner = 'draw';
      }
    }
  }

  // Test battles (vs bot) do not persist or change ELO/KP
  if (state.isTestBattle || p2.userId === 'BOT') {
    const acc1Test = accuracy(p1);
    const acc2Test = accuracy(p2);
    const finalResultsTest = {
      battleId,
      topic: state.topic,
      playerOne: { userId: p1.userId, correct: p1.correctAnswers, total: p1.totalAnswers, accuracy: acc1Test },
      playerTwo: { userId: p2.userId, correct: p2.correctAnswers, total: p2.totalAnswers, accuracy: acc2Test },
      winner: winner === 'one' ? p1.userId : winner === 'two' ? p2.userId : null,
      reason
    };
    io.to(state.room).emit('battle_complete', {
      final_results: finalResultsTest,
      rewards: {
        [p1.userId]: { kp: 0, eloChange: 0 },
        [p2.userId]: { kp: 0, eloChange: 0 }
      }
    });

    socketToBattle.forEach((val, key) => {
      if (val.battleId === battleId) socketToBattle.delete(key);
    });
    return;
  }

  // Load users
  const [u1, u2] = await Promise.all([
    User.findById(p1.userId),
    User.findById(p2.userId)
  ]);

  // Compute rewards
  const baseKP1 = 10 * p1.correctAnswers;
  const baseKP2 = 10 * p2.correctAnswers;
  let bonus1 = 0;
  let bonus2 = 0;
  const acc1 = accuracy(p1);
  const acc2 = accuracy(p2);
  if (acc1 > 0.75) bonus1 += 50; else if (acc1 > 0.6) bonus1 += 25;
  if (acc2 > 0.75) bonus2 += 50; else if (acc2 > 0.6) bonus2 += 25;
  if (winner === 'one') bonus1 += 100;
  if (winner === 'two') bonus2 += 100;
  const rewards = {
    p1: { kp: baseKP1 + bonus1 },
    p2: { kp: baseKP2 + bonus2 }
  };

  // ELO update
  const oldElo1 = u1.elo;
  const oldElo2 = u2.elo;
  const [k1, k2] = await Promise.all([
    computeKFactor(u1._id),
    computeKFactor(u2._id)
  ]);
  const exp1 = expectedScore(u1.elo, u2.elo);
  const exp2 = expectedScore(u2.elo, u1.elo);
  let score1 = 0.5, score2 = 0.5;
  if (winner === 'one') { score1 = 1; score2 = 0; }
  if (winner === 'two') { score1 = 0; score2 = 1; }
  const newElo1 = newRating(u1.elo, score1, exp1, k1);
  const newElo2 = newRating(u2.elo, score2, exp2, k2);

  // Update stats and persistence
  u1.elo = newElo1;
  u2.elo = newElo2;
  u1.kp += rewards.p1.kp;
  u2.kp += rewards.p2.kp;
  if (!u1.stats[state.topic]) u1.stats[state.topic] = { correct: 0, incorrect: 0 };
  if (!u2.stats[state.topic]) u2.stats[state.topic] = { correct: 0, incorrect: 0 };
  u1.stats[state.topic].correct += p1.correctAnswers;
  u1.stats[state.topic].incorrect += (p1.totalAnswers - p1.correctAnswers);
  u2.stats[state.topic].correct += p2.correctAnswers;
  u2.stats[state.topic].incorrect += (p2.totalAnswers - p2.correctAnswers);
  if (winner === 'one') { u1.winStreak += 1; u2.winStreak = 0; }
  else if (winner === 'two') { u2.winStreak += 1; u1.winStreak = 0; }
  else { u1.winStreak = 0; u2.winStreak = 0; }

  await Promise.all([u1.save(), u2.save()]);

  // Create battle log
  const battleDoc = await Battle.create({
    playerOneId: u1._id,
    playerTwoId: u2._id,
    playerOneScore: p1.correctAnswers,
    playerTwoScore: p2.correctAnswers,
    playerOneTotalAnswers: p1.totalAnswers,
    playerTwoTotalAnswers: p2.totalAnswers,
    winnerId: winner === 'one' ? u1._id : winner === 'two' ? u2._id : null,
    topic: state.topic
  });

  // Notify clients
  const finalResults = {
    battleId,
    topic: state.topic,
    playerOne: {
      userId: p1.userId,
      correct: p1.correctAnswers,
      total: p1.totalAnswers,
      accuracy: acc1
    },
    playerTwo: {
      userId: p2.userId,
      correct: p2.correctAnswers,
      total: p2.totalAnswers,
      accuracy: acc2
    },
    winner: winner === 'one' ? p1.userId : winner === 'two' ? p2.userId : null,
    reason
  };

  io.to(state.room).emit('battle_complete', {
    final_results: finalResults,
    rewards: {
      [p1.userId]: { kp: rewards.p1.kp, eloChange: newElo1 - oldElo1 },
      [p2.userId]: { kp: rewards.p2.kp, eloChange: newElo2 - oldElo2 }
    }
  });

  // Cleanup socket mapping
  socketToBattle.forEach((val, key) => {
    if (val.battleId === battleId) socketToBattle.delete(key);
  });

  return battleDoc;
}

io.on('connection', (socket) => {
  const userId = socket.user.id;
  const username = socket.user.username;

  // If the user had a disconnect timer in an existing battle, rebind
  for (const [battleId, state] of battles.entries()) {
    const isP1 = state.playerOne.userId.toString() === userId.toString();
    const isP2 = state.playerTwo.userId.toString() === userId.toString();
    if (isP1 || isP2) {
      const player = isP1 ? state.playerOne : state.playerTwo;
      const other = isP1 ? state.playerTwo : state.playerOne;
      player.socketId = socket.id;
      player.disconnected = false;
      if (player.disconnectTimer) {
        clearTimeout(player.disconnectTimer);
        player.disconnectTimer = null;
      }
      socket.join(state.room);
      socketToBattle.set(socket.id, { battleId, side: isP1 ? 'one' : 'two' });
      // Optional: notify reconnected client of current state
      socket.emit('battle_start', { first_question: player.currentQuestion });
      // Also share opponent score for sync
      socket.emit('opponent_score_update', { score: other.correctAnswers });
      break;
    }
  }

  socket.on('enter_matchmaking', async ({ topic, test = false, strictApi = false }) => {
    try {
      topic = topic || 'matematica';
      // Prevent double-enqueue or enqueue while in battle
      for (const [battleId, state] of battles.entries()) {
        if (
          state.playerOne.userId.toString() === userId.toString() ||
          state.playerTwo.userId.toString() === userId.toString()
        ) {
          return; // already in battle
        }
      }
      if (test) {
        const p1 = { userId, username, socketId: socket.id };
        const p2 = { userId: 'BOT', username: 'TestBot', socketId: null, isBot: true };
        await startBattle(topic, p1, p2, { strictApi, isTestBattle: true });
      } else {
        const queue = getQueue(topic);
        // Remove any stale entries for this user
        for (let i = queue.length - 1; i >= 0; i--) {
          if (queue[i].userId === userId) queue.splice(i, 1);
        }
        queue.push({ userId, username, socketId: socket.id });
        if (queue.length >= 2) {
          const p1 = queue.shift();
          const p2 = queue.shift();
          await startBattle(topic, p1, p2, { strictApi });
        }
      }
    } catch (err) {
      console.error('enter_matchmaking error', err);
    }
  });

  socket.on('submit_answer', async ({ answer }) => {
    const ref = socketToBattle.get(socket.id);
    if (!ref) return;
    const { battleId, side } = ref;
    const state = battles.get(battleId);
    if (!state) return;
    const player = side === 'one' ? state.playerOne : state.playerTwo;
    const opponent = side === 'one' ? state.playerTwo : state.playerOne;
    const q = player.currentQuestion;
    if (!q) return; // should not happen
    const detail = getAnswerDetail(q.id);
    const correctLetter = detail?.correctLetter || null;
    const correctText = detail?.correctText || null;
    const isLetterMatch = correctLetter && String(answer).trim().toUpperCase() === String(correctLetter).trim().toUpperCase();
    const isTextMatch = correctText && String(answer).trim() === String(correctText).trim();
    const isCorrect = Boolean(isLetterMatch || isTextMatch);
    player.totalAnswers += 1;
    if (isCorrect) {
      player.correctAnswers += 1;
      player.score = player.correctAnswers; // score equals number of correct answers
      player.lastCorrectAt = nowMs() - state.startTime;
      const oppSocket = io.sockets.sockets.get(opponent.socketId);
      if (oppSocket) oppSocket.emit('opponent_score_update', { score: player.score });
    }
    try {
      const nextQ = await fetchQuestion(state.topic, { strictApi: state.strictApi });
      player.currentQuestion = nextQ;
      socket.emit('answer_result', { result: isCorrect ? 'correct' : 'incorrect', next_question: nextQ });
    } catch (err) {
      completeBattle(battleId, 'api_unavailable');
    }
  });

  socket.on('disconnect', () => {
    const ref = socketToBattle.get(socket.id);
    if (!ref) return; // not in battle
    const { battleId, side } = ref;
    const state = battles.get(battleId);
    if (!state) return;
    const player = side === 'one' ? state.playerOne : state.playerTwo;
    const opponent = side === 'one' ? state.playerTwo : state.playerOne;
    player.disconnected = true;
    player.disconnectTimer = setTimeout(() => {
      // Forfeit if still disconnected
      completeBattle(battleId, 'disconnect_forfeit', side);
    }, DISCONNECT_GRACE_MS);
  });
});

// Simple bot behavior for test mode battles
async function scheduleBot(state) {
  const act = async () => {
    if (!battles.has(state.battleId)) return; // ended
    const humanSocket = io.sockets.sockets.get(state.playerOne.socketId);
    const bot = state.playerTwo;
    const q = bot.currentQuestion;
    if (!q) {
      try {
        bot.currentQuestion = await fetchQuestion(state.topic, { strictApi: state.strictApi });
      } catch (err) {
        completeBattle(state.battleId, 'api_unavailable');
        return;
      }
    } else {
      const detail = getAnswerDetail(q.id);
      const letters = (detail?.options || []).map((o) => o.letter).filter(Boolean);
      let answerLetter = null;
      const correctChance = 0.4;
      if (Math.random() < correctChance && detail?.correctLetter) answerLetter = detail.correctLetter;
      else if (letters.length) answerLetter = letters[Math.floor(Math.random() * letters.length)];
      // Update bot stats
      bot.totalAnswers += 1;
      if (answerLetter && detail?.correctLetter && answerLetter === detail.correctLetter) {
        bot.correctAnswers += 1;
        bot.score = bot.correctAnswers;
        bot.lastCorrectAt = nowMs() - state.startTime;
        // Notify human of opponent score
        humanSocket?.emit('opponent_score_update', { score: bot.score });
      }
      try {
        bot.currentQuestion = await fetchQuestion(state.topic, { strictApi: state.strictApi });
      } catch (err) {
        completeBattle(state.battleId, 'api_unavailable');
        return;
      }
    }
    const delay = 3000 + Math.floor(Math.random() * 4000); // 3-7s
    if (battles.has(state.battleId)) setTimeout(act, delay);
  };
  setTimeout(act, 3500);
}

async function bootstrap() {
  const mode = await connectWithFallback();
  server.listen(PORT, () => {
    console.log(`ENEM Arena server listening on :${PORT} (${mode})`);
  });
}

bootstrap();

process.on('SIGINT', async () => {
  try { await mongoose.disconnect(); } catch {}
  if (memoryServer) { try { await memoryServer.stop(); } catch {} }
  process.exit(0);
});
