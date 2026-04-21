const mongoose = require("mongoose");

const paperSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subject: { type: String },
    year: { type: Number },
    examType: { type: String },
    file: { type: String },
    username: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Paper", paperSchema);
