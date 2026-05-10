const mongoose = require('mongoose');

const verificationCodeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  code: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(+new Date() + 15 * 60 * 1000) // 15 წუთში ვადა გაუვა
  }
}, { timestamps: true });

// დოკუმენტი ავტომატურად წაიშლება ვადის გასვლის შემდეგ
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('VerificationCode', verificationCodeSchema);
