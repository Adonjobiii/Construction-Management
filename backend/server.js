const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initializeDatabase } = require('./database');

const app = express();
const server = http.createServer(app);

// Configure CORS to allow frontend connections
const io = socketIo(server, {
  cors: {
    origin: '*', // For local dev, allow any origin. In production, lock down
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Uploads Directory Statics
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Middleware to inject socket.io into requests so routes can emit events
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Import API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join_site_room', (siteId) => {
    socket.join(`site_${siteId}`);
    console.log(`Socket ${socket.id} joined room site_${siteId}`);
  });

  socket.on('leave_site_room', (siteId) => {
    socket.leave(`site_${siteId}`);
    console.log(`Socket ${socket.id} left room site_${siteId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start Server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initializeDatabase();
    server.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(` BuildSync Pro Backend running on port ${PORT}`);
      console.log(` Socket.IO Server integrated successfully.`);
      console.log(`=========================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
