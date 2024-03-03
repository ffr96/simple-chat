import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join} from 'node:path';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { availableParallelism } from 'node:os';
import Cluster from 'node:cluster';
import { createAdapter, setupPrimary } from '@socket.io/cluster-adapter';

import messages from "./messages.json" assert { type: "json" };

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

  const users = {};
  const __dirname = dirname(fileURLToPath(import.meta.url));

  app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
  });

  app.get('/client/app.js', (req, res) => {
    res.sendFile(join(`${__dirname}/client`, 'app.js'));
  })

  app.get('/client/app.css', (req, res) => {
    res.sendFile(join(`${__dirname}/client`, 'app.css'));
  })

  io.on('connection', async (socket) => {
    const joinedBy = socket.handshake.auth.username;
    users[socket.id] = joinedBy;
    console.log('a user connected', socket.id);

    // A user joined the chat
    io.emit('user join', `${joinedBy}${messages.user.join}`, socket.id);

    // A user left the chat
    socket.on('disconnect', () => {
      io.emit('user leave', `${joinedBy}${messages.user.leave}`);
      delete users[socket.id];
      console.log('user disconnected');
    });

    socket.on('chat message', async (msg, clientOffset, callback) => {
      let result;
      const _msg = `${users[socket.id]}: ${msg}`;
      try {
        result = await db.run('INSERT INTO messages (content, client_offset) VALUES (?, ?)', _msg, clientOffset);
      } catch(e) {
        // duplication, msg already exists on db
        if (e.errno === 19) {
          callback();
        } else {

        }
      }
      io.emit('chat message', _msg, result.lastID);
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

