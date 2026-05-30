const mongoose = require('mongoose');

const rateAlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  alertType: {
    type: String,
    enum: ['company', 'forex', 'crypto', 'asset'],
    default: 'company',
    index: true
  },
  companyKey: { type: String, default: '' },
  companyName: { type: String, default: '' },
  pair: {
    type: String,
    required: true
  },
  side: {
    type: String,
    required: true,
    enum: ['buy', 'sell', 'rate'],
    default: 'sell'
  },
  operator: {
    type: String,
    required: true,
    enum: ['lt', 'gt']
  },
  targetRate: { type: Number, required: true },
  status: {
    type: String,
    enum: ['active', 'triggered'],
    default: 'active',
    index: true
  },
  triggeredAt: Date,
  triggeredRate: Number,
  sentTo: String
}, { timestamps: true });

module.exports = mongoose.model('RateAlert', rateAlertSchema);
