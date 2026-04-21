const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: {
    type: String,
    enum: ["admin", "professor", "student"],
    default: "student",
  },
});

module.exports = mongoose.model("User", UserSchema);
