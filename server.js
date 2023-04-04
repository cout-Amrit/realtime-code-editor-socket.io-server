const http = require("http");

const express = require("express");
const { Server } = require("socket.io");
const cors = require("cors");

const actions = require("./actions");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server);

app.use((req, res, next) => {
  res.send('<h2>This is socket.io server.</h2>');
});


const usernameSocketMap = {};

function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: usernameSocketMap[socketId],
      };
    }
  );
}

io.on("connection", (socket) => {
  console.log("socket connected: ", socket.id);

  // listening "join" event
  socket.on(actions.JOIN, ({ roomId, username }) => {
    usernameSocketMap[socket.id] = username;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);
    clients.forEach(({ socketId }) => {
      // emitting "joined" event to every user in that room
      io.to(socketId).emit(actions.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });
  });

  // listening to "code-change" event
  socket.on(actions.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(actions.CODE_CHANGE, { code });
  });

  // listening to "code-sync" event
  socket.on(actions.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(actions.CODE_CHANGE, { code });
  });

  // listening "disconnecting" event
  socket.on(actions.DISCONNECTING, () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(actions.DISCONNECTED, {
        socketId: socket.id,
        username: usernameSocketMap[socket.id],
      });
    });
    delete usernameSocketMap[socket.id];
    socket.leave();
  });
});

server.listen(process.env.PORT, () => {
  console.log(`Server listening on PORT: ${process.env.PORT}`);
});
