const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    
    email: {
      type: String,
      unique: true,
      sparse: true, 
    },

    username: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      default: null, 
    },

    
    googleId: {
      type: String,
      default: null,
    },

   
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

    
    role: {
      type: String,
      enum: ["admin", "professor", "student"],
      default: "student",
    },

    
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