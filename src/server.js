/**
 * Express Server Entry Point
 * [Category A]: Node.js and Express runtime execution (STQA §3)
 * [Category B]: Automatic local database initialization and seed rehydration
 */

const { initDatabase } = require('./database/db');
const { seedDatabase } = require('./database/seed');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    console.log('[Server] Initializing persistent sql.js database...');
    const dbClient = await initDatabase({ forceNew: false });

    console.log('[Server] Checking and seeding demonstration data...');
    await seedDatabase(dbClient);

    const app = createApp({ dbClient });

    const server = app.listen(PORT, () => {
      console.log(`[Server] Digital Quiz Portal server running on http://localhost:${PORT}`);
    });

    // Graceful shutdown
    const handleShutdown = () => {
      console.log('\n[Server] Shutting down gracefully...');
      server.close(() => {
        dbClient.close();
        console.log('[Server] Database closed. Process terminated.');
        process.exit(0);
      });
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);

    return server;
  } catch (err) {
    console.error('[Server Error] Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer
};

