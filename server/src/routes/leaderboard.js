import express from 'express';
import User from '../models/User.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const top = await User.find({}, { username: 1, elo: 1, kp: 1 })
      .sort({ elo: -1 })
      .limit(100)
      .lean();
    return res.json({ leaderboard: top });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;

