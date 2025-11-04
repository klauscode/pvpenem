import express from 'express';
import User from '../models/User.js';
import Cosmetic from '../models/Cosmetic.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    delete user.password;
    return res.json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.post('/equip', authMiddleware, async (req, res) => {
  try {
    const { slot, itemId } = req.body; // e.g., slot: 'avatarFrame'
    if (!slot || !itemId) return res.status(400).json({ error: 'Missing fields' });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.inventory.includes(itemId)) return res.status(400).json({ error: 'Item not in inventory' });
    const cosmetic = await Cosmetic.findOne({ itemId });
    if (!cosmetic) return res.status(404).json({ error: 'Cosmetic not found' });
    user.equippedCosmetics = { ...(user.equippedCosmetics || {}), [slot]: itemId };
    await user.save();
    return res.json({ equippedCosmetics: user.equippedCosmetics });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to equip item' });
  }
});

export default router;

