import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function main() {

  const db = await open(
    {
      filename: 'chat.db',
      driver: sqlite3.Database
    }
  );

  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        content TEXT
    );
  `);


  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    connectionStateRecovery: {}
  });

  const __dirname = dirname(fileURLToPath(import.meta.url));

  app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
  });

  io.on('connection', async (socket) => {
      const clientIp = socket.handshake.address;
      //console.log(socket.handshake.address);
      let userIP = clientIp.substr(7);
      if (userIP == '') {userIP = 'localhost'};

      socket.on('first connection', () => {
        console.log('New connection from IP: ' + userIP);
      });

    

      socket.on('sender sign', (nickname) => {
        io.emit('sender sign', nickname.nickname);
        console.log(userIP + ' changed to -> ' + nickname.nickname + ' @ ' + nickname.timestamp);
      });

      socket.on('chat message', async (msg) => {
        /*
        let result;
        try {
          // store the message in the database
          result = await db.run('INSERT INTO messages (content) VALUES (?)', msg);
        } catch (e) {
          // TODO handle the failure
          return;
        }
        */
        io.emit('chat message', msg/*, result.lastID*/);
        console.log('User ' + msg.nickname + ' sent message: ' + msg.msg + ' @ ' + msg.timestamp);
      });

      socket.on('user joined', (nickname) => {
        io.emit('user joined', {
          'msg':nickname.nickname + ' entrou no chat.',
          'nickname':'[SYSTEM] ',
          'timestamp':nickname.timestamp
        });
      });

      socket.on('end chat', (nickname) => {
        console.log('User ' + nickname.nickname + ' has left the chat @ ' + nickname.timestamp);
        io.emit('chat message', {
          'msg':nickname.nickname + ' saiu do chat.',
          'nickname':'[SYSTEM]',
          'timestamp':nickname.timestamp
        });
        socket.disconnect();
      });

      socket.on('close chat', (nickname) => {
        console.log('User ' + nickname.nickname + ' has completely left the chat @ ' + nickname.timestamp);
        io.emit('chat message', {
          'msg':nickname.nickname + ' fechou o chat.',
          'nickname':'[SYSTEM]',
          'timestamp':nickname.timestamp
        });
        socket.disconnect();
      });

      socket.on('reconnect', (nickname) => {
        console.log('User ' + nickname.nickname + ' has reconnected to the chat @ ' + nickname.timestamp);
        io.emit('chat message', {
          'msg':nickname.nickname + ' voltou ao chat.',
          'nickname':'[SYSTEM]',
          'timestamp':nickname.timestamp
        });
      });

      if (!socket.recovered) {
        // if the connection state recovery was not successful
        try {
          await db.each('SELECT id, content FROM messages WHERE id > ?',
            [socket.handshake.auth.serverOffset || 0],
            (_err, row) => {
              socket.emit('chat message', row.content, row.id);
            }
          )
        } catch (e) {
          // something went wrong
        }
      }

      socket.on('disconnect', () => {
          //console.log('A User has closed the chat.');
      });
    });

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});

}

main();