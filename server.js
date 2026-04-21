require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const User = require("./models/user");
const File = require("./models/file");

const app = express();

// ================== CONFIG ==================
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ================== DB ==================
mongoose.connect("mongodb://127.0.0.1:27017/pyqhub")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

// ================== SESSION ==================
app.use(session({
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: "mongodb://127.0.0.1:27017/pyqhub"
  })
}));

// ================== PASSPORT ==================
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    const email = profile.emails[0].value;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        username: profile.displayName,
        email: email,
        googleId: profile.id,
        avatar: profile.photos[0].value,
        role: "student"
      });
    }

    return done(null, user);
  }
));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

// ================== MULTER ==================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "public/uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// ================== GLOBAL USER ==================
app.use(async (req, res, next) => {
  res.locals.user = null;

  if (req.session.userId) {
    res.locals.user = await User.findById(req.session.userId);
  }

  next();
});

// ================== MIDDLEWARE ==================
function isAuthenticated(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

function canUpload(req, res, next) {
  const role = res.locals.user?.role;
  if (role === "admin" || role === "professor") return next();
  return res.redirect("/profile");
}

// ================== ROUTES ==================

// HOME
app.get("/", (req, res) => {
  res.render("index", { user: res.locals.user });
});

// GOOGLE AUTH
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    req.session.userId = req.user._id;
    res.redirect("/profile");
  }
);

// AUTH
app.get("/login", (req, res) => res.render("login"));
app.get("/register", (req, res) => res.render("register"));

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  const existing = await User.findOne({ username });
  if (existing) return res.send("Username exists");

  const hashed = await bcrypt.hash(password, 10);

  await User.create({
    username,
    password: hashed
  });

  res.redirect("/login");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.send("Invalid credentials");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.send("Invalid credentials");

  req.session.userId = user._id;
  res.redirect("/profile");
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// PROFILE
app.get("/profile", isAuthenticated, async (req, res) => {
  const user = await User.findById(req.session.userId);

  const papers = await File.find({
    uploadedBy: req.session.userId
  });

  res.render("profile", { user, papers });
});

// UPLOAD PAPER
app.post("/upload",
  isAuthenticated,
  canUpload,
  upload.single("file"),
  async (req, res) => {

    if (!req.file) return res.send("No file");

    const { title, subject, examType, year } = req.body;

    await File.create({
      title,
      subject,
      examType,
      year,
      filename: req.file.filename,
      uploadedBy: req.session.userId,
      status: "approved"
    });

    // 🔥 update user stats
    await User.findByIdAndUpdate(req.session.userId, {
      $inc: { uploadsCount: 1 }
    });

    res.redirect("/profile");
  }
);

app.get("/upload", isAuthenticated, (req, res) => {
  res.render("upload");
});

// UPLOAD AVATAR
app.post("/upload-avatar",
  isAuthenticated,
  upload.single("avatar"),
  async (req, res) => {

    await User.findByIdAndUpdate(req.session.userId, {
      avatar: "/uploads/" + req.file.filename
    });

    res.redirect("/profile");
  }
);

// DOWNLOAD
app.get("/download/:id", async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file) return res.send("Not found");

  const filePath = path.join(__dirname, "public/uploads", file.filename);

  await File.findByIdAndUpdate(req.params.id, {
    $inc: { downloads: 1 }
  });

  res.download(filePath);
});

// EXPLORE
app.get("/explore", async (req, res) => {
  const papers = await File.find({ status: "approved" });
  res.render("explore", { papers, user: res.locals.user });
});

// ================== SERVER ==================
app.listen(3000, () =>
  console.log("Server running at http://localhost:3000")
);