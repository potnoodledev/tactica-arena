import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Debug logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Configure proper MIME types for ES6 modules
app.use((req, res, next) => {
  if (req.url.endsWith('.js')) {
    res.type('application/javascript');
  }
  next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the combat system modules with proper MIME type
app.use('/src/combat', express.static(path.join(__dirname, 'src/combat'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript');
    }
  }
}));

// Main route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to check file structure
app.get('/debug/files', async (req, res) => {
  try {
    const fs = await import('fs');
    const srcPath = path.join(__dirname, 'src');
    const publicPath = path.join(__dirname, 'public');
    
    const srcExists = fs.existsSync(srcPath);
    const publicExists = fs.existsSync(publicPath);
    const combatExists = fs.existsSync(path.join(__dirname, 'src/combat/index.js'));
    
    res.json({
      srcExists,
      publicExists,
      combatExists,
      __dirname,
      paths: {
        src: srcPath,
        public: publicPath,
        combatIndex: path.join(__dirname, 'src/combat/index.js')
      }
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Error handling for missing files
app.use((req, res, next) => {
  if (req.url.startsWith('/src/combat/')) {
    console.log(`Combat file request: ${req.url}`);
  }
  res.status(404).json({ 
    error: 'Not found', 
    url: req.url, 
    method: req.method,
    timestamp: new Date().toISOString()
  });
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