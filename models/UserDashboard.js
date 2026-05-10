const mongoose = require('mongoose');

const dashboardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  filters: {
    company: { type: Boolean, default: true },
    forex: { type: Boolean, default: true },
    crypto: { type: Boolean, default: true },
    asset: { type: Boolean, default: true }
  },
  items: {
    company: { type: [String], default: [] },
    forex: { type: [String], default: [] },
    crypto: { type: [String], default: [] },
    asset: { type: [String], default: [] }
  }
}, { timestamps: true });

module.exports = mongoose.model('UserDashboard', dashboardSchema);
