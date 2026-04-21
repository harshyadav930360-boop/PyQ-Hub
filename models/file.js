const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },

  subject: {
    type: String,
    required: true,
    trim: true
  },

  examType: {
    type: String,
    default: "Exam"
  },

  year: {
    type: Number
  },

  filename: {
    type: String,
    required: true
  },

  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  // 🔥 NEW (for future features)
  downloads: {
    type: Number,
    default: 0
  },

  views: {
    type: Number,
    default: 0
  },

  status: {
    type: String,
    enum: ["pending", "approved"],
    default: "approved"   // change to "pending" if you want admin approval
  },

  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("File", fileSchema);