const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');  // For handling file uploads
const HistoryFile = require('./models/HistoryFile');  // Import history file model


dotenv.config();
const fileRoutes = require('./routes/fileRoutes');

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB Error:", err));
app.use('/api/files', fileRoutes);

// File upload setup using Multer
const upload = multer({ dest: 'uploads/' });

// User model
const User = mongoose.model('User', new mongoose.Schema({
  fullName: String,
  email: { type: String, unique: true },
  password: String,
}));

// Registration Route
app.post('/api/register', async (req, res) => {
  const { fullName, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: 'User already exists!' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ fullName, email, password: hashedPassword });
    await newUser.save();

    res.status(200).json({ msg: 'User registered successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'User not found!' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials!' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Route to upload file and store file details in MongoDB
app.post('/api/upload', upload.single('file'), async (req, res) => {
  const { filename } = req.file;
  const userId = req.body.userId; // Assume userId is passed from frontend (logged-in user)

  try {
    // Save file history to MongoDB
    const historyFile = new HistoryFile({
      filename,
      userId,
    });

    await historyFile.save();
    res.status(200).json({ msg: 'File uploaded and history saved!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error uploading file' });
  }
});

// Route to fetch the user's uploaded files
app.get('/api/history', async (req, res) => {
  const userId = req.query.userId; // Get the userId from the query

  try {
    const historyFiles = await HistoryFile.find({ userId }).sort({ uploadedAt: -1 });
    res.status(200).json(historyFiles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error fetching file history' });
  }
});

// Route to delete a file from history
app.delete('/api/history/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await HistoryFile.findByIdAndDelete(id);
    res.status(200).json({ msg: 'File deleted from history' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error deleting file' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
