import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { availableParallelism } from 'node:os';
import Cluster from 'node:cluster';
import { createAdapter, setupPrimary } from '@socket.io/cluster-adapter';

const db = await open({
  filename: 'chat.db',
  driver: sqlite3.Database
});

await db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_offset TEXT UNIQUE,
    content TEXT
  );
`);

if (Cluster.isPrimary) {
  const cpuCount = availableParallelism();

  for (let i = 0; i < cpuCount; i++) {
    Cluster.fork({
      PORT: 3000 + i
    });
  }

  setupPrimary();
} else {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    connectionStateRecovery: {},
    adapter: createAdapter(),
  });

  const __dirname = dirname(fileURLToPath(import.meta.url));

  app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
  });

  io.on('connection', async (socket) => {
    console.log('a user connected', socket.id);
    socket.on('disconnect', () => {
      console.log('user disconnected');
    });

    socket.on('chat message', async (msg, clientOffset, callback) => {
      let result;
      try {
        result = await db.run('INSERT INTO messages (content, client_offset) VALUES (?, ?)', msg, clientOffset);
      } catch(e) {
        // duplication, msg already exists on db
        if (e.errno === 19) {
          callback();
        } else {

        }
      }
      io.emit('chat message', msg, result.lastID);
      callback();
    });

    if (!socket.recovered) {
      try {
        await db.each('SELECT id, content FROM messages WHERE id > ?',
        [socket.handshake.auth.serverOffset || 0], (_err, row) => {
          socket.emit('chat message', row.content, row.id);
        })
      } catch(e) {
        return;
      }
    }
  });

  server.listen(process.env.PORT, () => {
    console.log('server running at local:', process.env.PORT);
  });
}