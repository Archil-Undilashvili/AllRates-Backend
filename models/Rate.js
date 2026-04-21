const mongoose = require('mongoose');

const rateSchema = new mongoose.Schema({
  company: { type: String, required: true },
  date: { type: Date },
  tbilisiDateString: { type: String },
  usdBuy: Number,
  usdSell: Number,
  eurBuy: Number,
  eurSell: Number,
  gbpBuy: Number,
  gbpSell: Number,
  rubBuy: Number,
  rubSell: Number,
  tryBuy: Number,
  trySell: Number
}, { 
  timestamps: true 
});

// ყოველ შენახვაზე ავტომატურად გაასწორებს დროს თბილისის დროზე
rateSchema.pre('save', function() {
  const d = new Date();
  
  // ვინახავთ ტექსტურ ფორმატსაც (ლოგებისთვის და მარტივად აღქმისთვის)
  this.tbilisiDateString = d.toLocaleString('ka-GE', { timeZone: 'Asia/Tbilisi' });
  
  // date ველში ვამატებთ +4 საათს რომ მონგომ (რომელიც UTC-ში ინახავს) ჩვენი დრო აჩვენოს
  d.setHours(d.getHours() + 4);
  this.date = d;
});

module.exports = mongoose.model('Rate', rateSchema);
