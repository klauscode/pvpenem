import express from 'express';
import User from '../models/User.js';
import Cosmetic from '../models/Cosmetic.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const GACHA_COST_SG = 100;

async function ensureSampleCosmetics() {
  const count = await Cosmetic.countDocuments();
  if (count > 0) return;
  const samples = [
    { itemId: 'frame_bronze', name: 'Bronze Frame', type: 'AVATAR_FRAME', rarity: 'COMMON' },
    { itemId: 'frame_silver', name: 'Silver Frame', type: 'AVATAR_FRAME', rarity: 'RARE' },
    { itemId: 'frame_gold', name: 'Gold Frame', type: 'AVATAR_FRAME', rarity: 'EPIC' },
    { itemId: 'bg_library', name: 'Library Background', type: 'PROFILE_BACKGROUND', rarity: 'RARE' },
    { itemId: 'bg_arena', name: 'Arena Background', type: 'PROFILE_BACKGROUND', rarity: 'LEGENDARY' }
  ];
  await Cosmetic.insertMany(samples);
}

router.post('/pull', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await ensureSampleCosmetics();

    if (user.sg < GACHA_COST_SG) return res.status(400).json({ error: 'Not enough SG' });

    const pool = await Cosmetic.find().lean();
    if (pool.length === 0) return res.status(500).json({ error: 'No cosmetics available' });

    // Very simple random selection; no rarity weighting for now
    let selected = pool[Math.floor(Math.random() * pool.length)];
    // Avoid duplicates with a few retries
    let attempts = 0;
    while (user.inventory.includes(selected.itemId) && attempts < 5) {
      selected = pool[Math.floor(Math.random() * pool.length)];
      attempts++;
    }

    user.sg -= GACHA_COST_SG;
    if (!user.inventory.includes(selected.itemId)) {
      user.inventory.push(selected.itemId);
    }
    await user.save();

    return res.json({ awarded: selected, sg: user.sg, inventory: user.inventory });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Gacha pull failed' });
  }
});

export default router;

