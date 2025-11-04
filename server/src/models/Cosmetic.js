import mongoose from 'mongoose';

const CosmeticSchema = new mongoose.Schema(
  {
    itemId: { type: String, unique: true, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, required: true }, // e.g., "AVATAR_FRAME", "PROFILE_BACKGROUND"
    rarity: { type: String, required: true } // e.g., "RARE", "LEGENDARY"
  },
  { timestamps: true }
);

export default mongoose.model('Cosmetic', CosmeticSchema);

