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

const ADMIN_KEY = "ADMIN123";
const PROFESSOR_KEY = "PROF456";


const User = require("./models/user");
const File = require("./models/file");

const app = express();


app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));


mongoose
  .connect("mongodb://127.0.0.1:27017/pyqhub")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));


app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: "mongodb://127.0.0.1:27017/pyqhub" }),
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {

      const email = profile.emails[0].value;

      let user = await User.findOne({ username: email });

      if (!user) {
        user = await User.create({
          username: email,
          password: "google-auth",
          role: "student", // default
        });
      }

      return done(null, user);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads";
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    "application/pdf",
    // "image/jpeg",
    // "image/png",
    // "application/msword",
    // "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only PDF / Image / DOC allowed"));
};

const upload = multer({ storage, fileFilter });

app.use(async (req, res, next) => {
  res.locals.user = null;
  if (req.session.userId) {
    res.locals.user = await User.findById(req.session.userId);
  }
  next();
});

function isAuthenticated(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

function isAdmin(req, res, next) {
  if (!res.locals.user || res.locals.user.role !== "admin")
    return res.send("Access Denied");
  next();
}

function canUpload(req, res, next) {
  const role = res.locals.user?.role;

  if (role === "admin" || role === "professor") {
    return next();
  }

  // Better UX
  return res.redirect("/profile");
}

app.get("/", (req, res) => res.render("index"));

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    req.session.userId = req.user._id;
    res.redirect("/profile");
  }
);

app.get("/register", (req, res) => res.render("register"));

app.post("/register", async (req, res) => {
  const { username, password, role, key } = req.body;

  const existing = await User.findOne({ username });
  if (existing) return res.send("Username already exists");

  let assignedRole = "student";
  if (role === "admin" && key === ADMIN_KEY) assignedRole = "admin";
  else if (role === "professor" && key === PROFESSOR_KEY)
    assignedRole = "professor";

  const hashed = await bcrypt.hash(password, 10);

  await User.create({
    username,
    password: hashed,
    role: assignedRole,
  });

  res.redirect("/login");
});


app.get("/login", (req, res) => res.render("login"));

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (!user) return res.send("Invalid credentials");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.send("Invalid credentials");

  req.session.userId = user._id;
  res.redirect("/profile");
});


app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.get("/profile", isAuthenticated, async (req, res) => {
  const userFiles = await File.find({ uploadedBy: req.session.userId });
  res.render("profile", {
    userFiles,
    user: res.locals.user,
  });
});


app.post(
  "/upload",
  isAuthenticated,
  canUpload,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.send("No file uploaded");

    const { title, subject, examType, year } = req.body;

    await File.create({
      title,
      subject,
      examType,
      year,
      filename: req.file.filename,
      uploadedBy: req.session.userId,
      uploadedAt: new Date(),

      // 🔥 NEW
      status: res.locals.user.role === "admin" ? "approved" : "pending"
    });

    res.redirect("/profile");
  }
);


app.post(
  "/update/:id",
  isAuthenticated,
  canUpload,
  upload.single("file"),
  async (req, res) => {
    const fileDoc = await File.findById(req.params.id);
    if (!fileDoc) return res.send("File not found");

    if (
      fileDoc.uploadedBy.toString() !== req.session.userId &&
      res.locals.user.role !== "admin"
    ) {
      return res.send("Not allowed");
    }

  
    const oldPath = path.join(__dirname, "uploads", fileDoc.filename);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

    
    if (req.file) fileDoc.filename = req.file.filename;

    
    fileDoc.title = req.body.title || fileDoc.title;
    fileDoc.subject = req.body.subject || fileDoc.subject;
    fileDoc.year = req.body.year || fileDoc.year;
    fileDoc.examType = req.body.examType || fileDoc.examType;

    await fileDoc.save();

    res.redirect("/profile");
  }
);

app.get("/download/:id", isAuthenticated, async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file) return res.send("File not found");

  const filePath = path.join(__dirname, "uploads", file.filename);
  if (!fs.existsSync(filePath)) return res.send("File missing on server");

  res.download(filePath);
});

app.get("/delete/:id", isAuthenticated, async (req, res) => {
  try {
    const user = res.locals.user;

    
    if (!user || user.role !== "admin") {
      return res.send("View Only Mode: You cannot delete.");
    }

    const file = await File.findById(req.params.id);
    if (!file) return res.send("File not found");

    const filePath = path.join(__dirname, "uploads", file.filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await File.findByIdAndDelete(req.params.id);

    res.redirect("/explore");

  } catch (err) {
    console.error(err);
    res.send("Delete failed");
  }
});


app.get("/explore", async (req, res) => {
  try {
    const { q, examType, year } = req.query;
    const filter = {
      status: "approved" // 🔥 ONLY SHOW APPROVED
    };

    if (q && q.trim() !== "") {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { subject: { $regex: q, $options: "i" } },
      ];
    }

    if (examType && examType.trim() !== "") {
      filter.examType = examType;
    }

    if (year && !isNaN(year)) {
      filter.year = parseInt(year);
    }

    const papers = await File.find(filter)
      .sort({ uploadedAt: -1 })
      .lean();

    res.render("explore", {
      papers,
      user: res.locals.user,
      q: q || "",
      examType: examType || "",
      year: year || "",
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading explore page");
  }
});

app.get("/admin", isAuthenticated, isAdmin, async (req, res) => {
  const files = await File.find().sort({ uploadedAt: -1 });

  const total = files.length;
  const pending = files.filter(f => f.status === "pending").length;
  const approved = files.filter(f => f.status === "approved").length;

  res.render("admin", {
    files,
    total,
    pending,
    approved,
    user: res.locals.user
  });
});

app.post("/admin/approve/:id", isAuthenticated, isAdmin, async (req, res) => {
  await File.findByIdAndUpdate(req.params.id, { status: "approved" });
  res.redirect("/admin");
});

app.post("/admin/delete/:id", isAuthenticated, isAdmin, async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file) return res.send("File not found");

  const filePath = path.join(__dirname, "uploads", file.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await File.findByIdAndDelete(req.params.id);

  res.redirect("/admin");
});

File.updateMany({}, { status: "approved" })
  .then(() => console.log("All files updated"))
  .catch(err => console.log(err));

app.listen(3000, () =>
  console.log("Server running at http://localhost:3000")
);
