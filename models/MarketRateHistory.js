const mongoose = require('mongoose');

const pairSnapshotSchema = new mongoose.Schema({
  buy: Number,
  sell: Number,
  spread: Number
}, { _id: false });

const marketRateHistorySchema = new mongoose.Schema({
  timestamp: { type: Date, required: true, unique: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  usdgel: { type: pairSnapshotSchema, default: () => ({}) },
  eurgel: { type: pairSnapshotSchema, default: () => ({}) },
  source: { type: String, default: 'google-sheet:M_DB' },
  sourceRow: Number,
  tbilisiDateString: String
}, {
  timestamps: true
});

module.exports = mongoose.model('MarketRateHistory', marketRateHistorySchema);
