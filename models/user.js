const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // 🔐 AUTH
    email: {
      type: String,
      unique: true,
      sparse: true, // allows null for normal login users
    },

    username: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      default: null, // null for Google users
    },

    // 🧠 GOOGLE AUTH
    googleId: {
      type: String,
      default: null,
    },

    // 🖼️ PROFILE
    avatar: {
      type: String,
      default: "/images/default.png",
    },

    bio: {
      type: String,
      default: "",
    },

    college: {
      type: String,
      default: "",
    },

    // 🎭 ROLE SYSTEM
    role: {
      type: String,
      enum: ["admin", "professor", "student"],
      default: "student",
    },

    // 📊 STATS (for dashboard)
    uploadsCount: {
      type: Number,
      default: 0,
    },

    downloadsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);