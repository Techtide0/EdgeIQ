const { Schema, model } = require('mongoose');

const BetSchema = new Schema({
  userId:        { type: String, required: true },
  stake:         { type: Number, required: true },
  odds:          { type: Number, required: true },
  potentialWin:  { type: Number, required: true },
  bonusExpected: { type: Number, default: 0 },
  bonusActual:   { type: Number, default: null },
  status: {
    type:    String,
    enum:    ['pending', 'won', 'lost', 'cashout', 'void'],
    default: 'pending',
  },
  cashoutAmount: { type: Number, default: null },
  createdAt:  { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null },
});

module.exports = model('Bet', BetSchema);
