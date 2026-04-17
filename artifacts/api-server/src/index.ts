import http from "http";
import { Server as SocketServer } from "socket.io";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { setIo } from "./lib/socket-io.js";
import { reconnectOnBoot } from "./lib/whatsapp-manager.js";
import { hashPassword } from "./lib/auth.js";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

async function seedDefaultAdmin(): Promise<void> {
  const admins = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));

  if (admins.length === 0) {
    const passwordHash = hashPassword("123456");
    await db.insert(usersTable).values({
      username: "admin",
      passwordHash,
      role: "admin",
      isActive: true,
      mustChangePassword: false,
    });
    logger.info("Default admin user created (username: admin)");
  }
}

server.listen(port, () => {
  logger.info({ port }, "Server listening");

  seedDefaultAdmin().catch((err: unknown) => {
    logger.error({ err }, "Error during seedDefaultAdmin");
  });

  // Reconnect WhatsApp sessions that had autoReconnect enabled
  reconnectOnBoot(io).catch((err: unknown) => {
    logger.error({ err }, "Error during reconnectOnBoot");
  });
});
