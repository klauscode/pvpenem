import mongoose from 'mongoose';

const StatsSchema = new mongoose.Schema({}, { strict: false, _id: false });

const EquippedCosmeticsSchema = new mongoose.Schema({}, { strict: false, _id: false });

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true, index: true },
    password: { type: String, required: true },
    elo: { type: Number, default: 1200 },
    kp: { type: Number, default: 0 },
    sg: { type: Number, default: 0 },
    winStreak: { type: Number, default: 0 },
    stats: { type: StatsSchema, default: {} },
    inventory: { type: [String], default: [] },
    equippedCosmetics: { type: EquippedCosmeticsSchema, default: {} }
  },
  { timestamps: true }
);

export default mongoose.model('User', UserSchema);

