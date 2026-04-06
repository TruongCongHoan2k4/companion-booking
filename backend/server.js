import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import app from './src/app.js';
import connectDB from './src/config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { initRealtime } from './src/realtime/realtimeBroadcastService.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

await connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const httpServer = http.createServer(app);
initRealtime(httpServer);

const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
