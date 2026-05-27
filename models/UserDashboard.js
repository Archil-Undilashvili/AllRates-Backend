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
    type: mongoose.Schema.Types.Mixed,
    default: () => ({ 'company-usd': true })
  },
  items: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  order: {
    type: [String],
    default: () => []
  }
}, { timestamps: true });

module.exports = mongoose.model('UserDashboard', dashboardSchema);
