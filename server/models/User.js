const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
  firebaseUid: { type: String, required: true, unique: true },
  createdAt:   { type: Date, default: Date.now },
});

module.exports = model('User', UserSchema);
