/* eslint-disable no-undef */
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

//
// ─── SETUP ─────────────────────────────────────────────────────────────────────
//
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const app       = express();
const port      = process.env.PORT || 3000;

// Ensure env vars
if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET not set');
if (!process.env.MONGO_URI)     throw new Error('MONGO_URI not set');

// Connect MongoDB
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log(`MongoDB connected: ${mongoose.connection.db.databaseName}`))
    .catch(err => {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    });

// View engine & static
app.set('view engine', 'ejs');
app.set('views',      path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session (use secure only in prod!)
const store = MongoStore.create({
  mongoUrl:       process.env.MONGO_URI,
  collectionName: 'sessions'
});
store.on('error', err => console.error('Session store error:', err));

app.use(session({
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  store,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   1000 * 60 * 60,        // 1h
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

//
// ─── MODELS & MIDDLEWARE ────────────────────────────────────────────────────────
//
const userSchema = new mongoose.Schema({
  user_name: { type: String, required: true, unique: true },
  email:     { type: String, required: true, unique: true },
  password:  { type: String, required: true },
  user_type: { type: String, enum: ['user','admin'], default: 'user' }
});
const User = mongoose.model('User', userSchema);

function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

//
// ─── ROUTES ─────────────────────────────────────────────────────────────────────
//

// Home → Admin Login form
app.get('/', (req, res) => {
  res.render('index', { error: null });
});

// ――― User Signup ―――
app.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});
app.post('/signup', async (req, res, next) => {
  const { username, email, password } = req.body;
  if (!username||!email||!password) {
    return res.render('signup', { error: 'All fields are required.' });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ user_name: username, email, password: hash });
    req.session.user = {
      _id:       user._id,
      user_name: user.user_name,
      user_type: user.user_type
    };
    return res.redirect('/members');
  } catch(err) {
    if (err.code === 11000) {
      const dupField = err.keyValue.user_name ? 'Username' : 'Email';
      return res.render('signup', { error: `${dupField} already exists.` });
    }
    next(err);
  }
});

// ――― User Login ―――
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});
app.post('/login', async (req, res, next) => {
  const { email, password } = req.body;
  if (!email||!password) {
    return res.render('login', { error: 'Email and password are required.' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password,user.password)) {
      return res.render('login', { error: 'Invalid credentials.' });
    }
    req.session.user = {
      _id:       user._id,
      user_name: user.user_name,
      user_type: user.user_type
    };
    return res.redirect('/members');
  } catch(err) {
    next(err);
  }
});

// ――― Admin Login (from home "/") ―――
app.post('/admin-login', async (req, res, next) => {
  const { email, password } = req.body;
  if (!email||!password) {
    return res.render('index', { error: 'Email and password required.' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password,user.password)) {
      return res.render('index', { error: 'Invalid credentials.' });
    }
    if (user.user_type !== 'admin') {
      return res.render('index', { error: 'You are not an admin.' });
    }
    req.session.user = {
      _id:       user._id,
      user_name: user.user_name,
      user_type: user.user_type
    };
    return res.redirect('/admin');
  } catch(err) {
    next(err);
  }
});

// ――― Members Dashboard ―――
app.get('/members', isAuthenticated, (req, res) => {
  const images = ['img1.jpg','img2.jpg','img3.jpg'];
  res.render('members', { user: req.session.user, images });
});

// ――― Log out ―――
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/admin', (req, res, next) => {
  const user = req.session.user;
  if (!user) {
    // not logged in
    return res.redirect('/login');
  }
  if (user.user_type !== 'admin') {
    // logged in but not admin
    return res.status(403).render('error', { message: 'You are not authorized.' });
  }
  // fetch all users
  User.find({})
      .then(users => res.render('admin', { users }))
      .catch(next);
});

// GET /admin/promote/:id — make a user an admin
app.get('/admin/promote/:id', (req, res, next) => {
  if (!req.session.user || req.session.user.user_type !== 'admin') {
    return res.status(403).render('error', { message: 'Forbidden' });
  }
  User.updateOne({ _id: req.params.id }, { $set: { user_type: 'admin' } })
      .then(() => res.redirect('/admin'))
      .catch(next);
});

// GET /admin/demote/:id — remove admin privileges
app.get('/admin/demote/:id', (req, res, next) => {
  if (!req.session.user || req.session.user.user_type !== 'admin') {
    return res.status(403).render('error', { message: 'Forbidden' });
  }
  User.updateOne({ _id: req.params.id }, { $set: { user_type: 'user' } })
      .then(() => res.redirect('/admin'))
      .catch(next);
});

// ─── MEMBERS GRID ───────────────────────────────────────────────────────────────
// GET /members — show Bootstrap grid of all 3 images
app.get('/members', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }
  // your three images must live in /public/images/
  const images = ['img1.jpg', 'img2.jpg', 'img3.jpg'];
  res.render('members', { user: req.session.user, images });
});



// ――― 404 & Error Handlers ―――
app.use((req, res) => {
  res.status(404).render('404');
});
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).render('error', { message: err.message });
});

//
// ─── START ───────────────────────────────────────────────────────────────────────
//
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
