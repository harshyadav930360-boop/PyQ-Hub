const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  title: String,
  subject: String,
  examType: String,
  year: Number,
  filename: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  status: {
    type: String,
    enum: ["pending", "approved"],
    default: "pending"
  },

  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("File", fileSchema);