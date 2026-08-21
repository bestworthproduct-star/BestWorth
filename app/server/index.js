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
const User = require('./models/User');
const { corsOrigin, sameOriginWrites, rejectOperatorInjection, securityHeaders } = require('./middleware/security');
const { getRequestToken, verifyAuthToken } = require('./utils/auth-token');
const { hasPermission, getRole, serializeUser } = require('./utils/permissions');
const { rateLimit } = require('./utils/rate-limit');

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
  maxHttpBufferSize: 10_000,
  pingInterval: 25_000,
  pingTimeout: 20_000,
  cors: {
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

// Middleware
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(cors({ origin: corsOrigin, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '150kb', strict: true }));
app.use(sameOriginWrites);
app.use(rejectOperatorInjection);
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  fallthrough: false,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  }
}));

if (isProduction && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// Make io accessible to routes
app.set('io', io);

const generalApiLimit = rateLimit({ scope: 'api-general', limit: 300, windowMs: 5 * 60 * 1000 });
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/media/') || req.path === '/system/health') return next();
  return generalApiLimit(req, res, next);
});

io.use(async (socket, next) => {
  const request = socket.request;
  try {
    const token = getRequestToken(request);
    if (!token) return next();
    const decoded = verifyAuthToken(token);
    const user = await User.findById(decoded.id);
    if (!user || user.active === false || Number(decoded.sv || 0) !== Number(user.sessionVersion || 0)) return next();
    socket.data.user = serializeUser(user);
    return next();
  } catch {
    return next();
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  if (user) {
    socket.join('staff');
    if (getRole(user) === 'admin') socket.join('owners');
    for (const moduleName of ['overview', 'catalog', 'leadership', 'inquiries', 'media', 'cms']) {
      if (hasPermission(user, moduleName, 'view')) socket.join(`module:${moduleName}`);
    }
  }
  socket.on('disconnect', () => {
    // Socket.IO cleans up room membership automatically.
  });
});

// Routes
app.use('/api/auth', requireDb, require('./routes/auth'));
app.get('/api/system/health', (req, res) => {
  const databaseStatus = getDatabaseStatus();
  const statusCode = databaseStatus.available ? 200 : 503;
  res.status(statusCode).json({
    ok: databaseStatus.available,
    database: { available: databaseStatus.available }
  });
});
app.use('/api/products', requireDb, require('./routes/products'));
app.use('/api/team', requireDb, require('./routes/team'));
app.use('/api/inquiries', requireDb, require('./routes/inquiries'));
app.use('/api/content', requireDb, require('./routes/content'));
app.use('/api/upload', requireDb, require('./routes/upload'));
app.use('/api/media', requireDb, require('./routes/media'));
app.use('/api/workers', requireDb, require('./routes/workers'));
app.use('/api/news-media', requireDb, require('./routes/news-media'));
app.use('/api/newsletter', requireDb, require('./routes/newsletter'));

// Health check
app.get('/api/admin/check', requireDb, require('./middleware/auth'), (req, res) => {
  res.json({ authorized: true, user: req.user });
});

app.use('/api', (req, res) => res.status(404).json({ message: 'API endpoint not found.' }));

app.use((error, req, res, next) => {
  console.error('[server] request failed:', error.message);
  if (res.headersSent) return next(error);
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request body is too large.' });
  if (error.message === 'Origin not allowed') return res.status(403).json({ message: 'Request origin is not allowed.' });
  return res.status(500).json({ message: 'The request could not be completed.' });
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
  app.get('/{*path}', (req, res) => {
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
