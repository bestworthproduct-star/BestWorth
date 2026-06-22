const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const connectDB = require('./config/db');
const requireDb = require('./middleware/require-db');
const { getDatabaseStatus, setDatabaseAvailable, setLastDatabaseError } = require('./utils/db-state');
const mongoose = require('mongoose');

const http = require('http');
const { Server } = require('socket.io');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);
const frontendRoot = path.resolve(__dirname, '..');
const frontendDist = path.join(frontendRoot, 'dist');
const isProduction = process.env.NODE_ENV === 'production';
let frontendProcess = null;

function startFrontendDevServer() {
  if (isProduction || process.env.START_FRONTEND_DEV === 'false') {
    return;
  }

  if (frontendProcess) {
    return;
  }

  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'cmd.exe' : 'npm';
  const args = isWindows
    ? ['/c', 'npm', 'run', 'dev', '--', '--host', '0.0.0.0']
    : ['run', 'dev', '--', '--host', '0.0.0.0'];

  frontendProcess = spawn(command, args, {
    cwd: frontendRoot,
    stdio: 'inherit',
    shell: false
  });

  frontendProcess.on('error', (error) => {
    console.error('Failed to start frontend dev server:', error.message);
  });

  frontendProcess.on('exit', (code, signal) => {
    frontendProcess = null;

    if (signal) {
      console.log(`Frontend dev server stopped with signal ${signal}`);
      return;
    }

    if (code !== 0) {
      console.error(`Frontend dev server exited with code ${code}`);
    }
  });
}

function stopFrontendDevServer() {
  if (frontendProcess && !frontendProcess.killed) {
    frontendProcess.kill('SIGTERM');
  }
}

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

// Middleware
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (isProduction && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// Make io accessible to routes
app.set('io', io);

io.on('connection', (socket) => {
  console.log('Client connected to real-time sync:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected from real-time sync');
  });
});

// Routes
app.use('/api/auth', requireDb, require('./routes/auth'));
app.get('/api/system/health', (req, res) => {
  const databaseStatus = getDatabaseStatus();
  const statusCode = databaseStatus.available ? 200 : 503;
  res.status(statusCode).json({
    ok: databaseStatus.available,
    database: databaseStatus
  });
});
app.use('/api/products', requireDb, require('./routes/products'));
app.use('/api/team', requireDb, require('./routes/team'));
app.use('/api/inquiries', requireDb, require('./routes/inquiries'));
app.use('/api/content', requireDb, require('./routes/content'));
app.use('/api/upload', requireDb, require('./routes/upload'));
app.use('/api/media', requireDb, require('./routes/media'));

// Health check
app.get('/api/admin/check', requireDb, require('./middleware/auth'), (req, res) => {
  res.json({ authorized: true });
});

mongoose.connection.on('connected', () => {
  setDatabaseAvailable(true);
});

mongoose.connection.on('disconnected', () => {
  setDatabaseAvailable(false);
  setLastDatabaseError(new Error('MongoDB connection lost'));
});

mongoose.connection.on('error', (error) => {
  setDatabaseAvailable(false);
  setLastDatabaseError(error);
});

if (isProduction && fs.existsSync(frontendDist)) {
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  startFrontendDevServer();
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

process.on('SIGINT', () => {
  stopFrontendDevServer();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopFrontendDevServer();
  process.exit(0);
});
