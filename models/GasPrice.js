const mongoose = require('mongoose');

const gasPriceItemSchema = new mongoose.Schema({
  product: { type: String, required: true },
  productEng: String,
  code: String,
  type: String,
  price: Number,
  standardPrice: Number,
  selfServicePrice: Number,
  onlinePrice: Number,
  currency: { type: String, default: 'GEL' },
  actionDate: String,
  details: mongoose.Schema.Types.Mixed
}, { _id: false });

const gasPriceSchema = new mongoose.Schema({
  company: { type: String, required: true },
  source: { type: String, required: true },
  prices: { type: [gasPriceItemSchema], default: [] },
  latestDate: String,
  fetchedAt: Date,
  tbilisiDateString: String
}, {
  timestamps: true
});

gasPriceSchema.index({ company: 1, createdAt: -1 });

gasPriceSchema.pre('save', function() {
  const now = new Date();
  this.fetchedAt = now;
  this.tbilisiDateString = now.toLocaleString('ka-GE', { timeZone: 'Asia/Tbilisi' });
});

module.exports = mongoose.model('GasPrice', gasPriceSchema);
