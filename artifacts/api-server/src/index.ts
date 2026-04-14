import http from "http";
import { Server as SocketServer } from "socket.io";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { setIo } from "./lib/socket-io.js";
import { reconnectOnBoot } from "./lib/whatsapp-manager.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

// Socket.IO
const io = new SocketServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const ok =
        /\.replit\.dev$/.test(origin) ||
        /\.repl\.co$/.test(origin) ||
        origin.startsWith("http://localhost");
      callback(null, ok ? origin : false);
    },
    credentials: true,
  },
});

setIo(io);

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "Socket.IO client connected");
  socket.on("disconnect", () => {
    logger.info({ socketId: socket.id }, "Socket.IO client disconnected");
  });
});

server.listen(port, () => {
  logger.info({ port }, "Server listening");

  // Reconnect WhatsApp sessions that had autoReconnect enabled
  reconnectOnBoot(io).catch((err: unknown) => {
    logger.error({ err }, "Error during reconnectOnBoot");
  });
});
