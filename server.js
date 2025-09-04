import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the combat system modules
app.use('/src/combat', express.static(path.join(__dirname, 'src/combat')));

// Main route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log('🎮 Tactica Arena Server Starting...');
  console.log(`📡 Server running at http://localhost:${PORT}`);
  console.log('🚀 Ready for hotseat battles!');
  console.log('\n📋 Available routes:');
  console.log(`   • Game: http://localhost:${PORT}`);
  console.log(`   • Health: http://localhost:${PORT}/health`);
  console.log('\n⚡ Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Tactica Arena server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Tactica Arena server...');
  process.exit(0);
});