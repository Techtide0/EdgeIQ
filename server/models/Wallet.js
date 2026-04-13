const { Schema, model } = require('mongoose');

const WalletSchema = new Schema({
  userId:         { type: String, required: true, unique: true },
  totalDeposited: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },
  netBalance:     { type: Number, default: 0 },
});

module.exports = model('Wallet', WalletSchema);
