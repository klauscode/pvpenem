import mongoose from 'mongoose';

const BattleSchema = new mongoose.Schema(
  {
    playerOneId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    playerTwoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    playerOneScore: { type: Number, default: 0 },
    playerTwoScore: { type: Number, default: 0 },
    playerOneTotalAnswers: { type: Number, default: 0 },
    playerTwoTotalAnswers: { type: Number, default: 0 },
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    topic: { type: String, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model('Battle', BattleSchema);

