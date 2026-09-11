import 'dotenv/config';
import app from './app';
import prisma from './shared/config/prisma';
import { initEmailWorker } from './jobs/emailWorker';
import { closeRedis } from './shared/config/redis';

const PORT = process.env.PORT || 5001;

async function main() {
  app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
  });

  try {
    await prisma.$connect();
    console.log('✅ Database terhubung');
    initEmailWorker();
  } catch (error) {
    console.error('⚠️ Warning: Gagal menghubungkan ke database saat startup:', error);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM diterima, menutup server...');
  await prisma.$disconnect();
  await closeRedis();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT diterima, menutup server...');
  await prisma.$disconnect();
  await closeRedis();
  process.exit(0);
});

main();
