const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');

const http = require('http');
const { Server } = require('socket.io');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Make io accessible to routes
app.set('io', io);

io.on('connection', (socket) => {
  console.log('Client connected to real-time sync:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected from real-time sync');
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/team', require('./routes/team'));
app.use('/api/inquiries', require('./routes/inquiries'));
app.use('/api/content', require('./routes/content'));
app.use('/api/upload', require('./routes/upload'));

// Health check
app.get('/api/admin/check', require('./middleware/auth'), (req, res) => {
  res.json({ authorized: true });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
