// startServer.js
import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
import { Server } from "socket.io";
import { publisher, subscriber } from "./utils/redisClient.js";

import app from "./app.js";
import prisma from "./config/prismaClient.js";
import updateStock from "./worker/updateStocks.js";

// Handle BigInt serialization for JSON
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    // Test DB connection
    await prisma.$connect();
    console.log(" Connected to PostgreSQL via Prisma");

    // Create HTTP server from Express app
    const server = createServer(app);

    // Attach Socket.IO to the server
    const io = new Server(server, {
      cors: { origin: "*" },
    });

    // symbol -> Set of socket ids
    const symbolSubscriptions = new Map();

    // Reset active connections in Redis
    await publisher.set("ws:active_clients", 0);

    io.on("connection", (socket) => {
      console.log(` client connected: ${socket.id}`);
      publisher.incr("ws:active_clients");

      socket.on("register", (userId) => {
        socket.userId = userId;
        console.log(`Registered socket ${socket.id} to user ${userId}`);
      });

      socket.on("subscribe", (symbols) => {
        // remove old subscriptions
        for (const subs of symbolSubscriptions.values()) {
          subs.delete(socket.id);
        }

        // add new subscriptions
        for (const sym of symbols) {
          if (!symbolSubscriptions.has(sym)) {
            symbolSubscriptions.set(sym, new Set());
          }
          symbolSubscriptions.get(sym).add(socket.id);
        }
        console.log(`${socket.id} subscribed to`, symbols);
      });

      socket.on("disconnect", () => {
        for (const subs of symbolSubscriptions.values()) {
          subs.delete(socket.id);
        }
        publisher.decr("ws:active_clients");
        console.log(` client disconnected: ${socket.id}`);
      });
    });

    // Redis consumer
    await subscriber.subscribe("stock-prices");
    await subscriber.subscribe("price-alerts");
    
    subscriber.on("message", (channel, message) => {
      if (channel === "stock-prices") {
        const updates = JSON.parse(message);

        for (const update of updates) {
          const subs = symbolSubscriptions.get(update.symbol);
          if (!subs) continue;

          for (const socketId of subs) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit("price-update", [update]);
            }
          }
        }
      } else if (channel === "price-alerts") {
        const alertData = JSON.parse(message);
        const activeSockets = Array.from(io.sockets.sockets.values());
        
        for (const s of activeSockets) {
          if (s.userId === alertData.userId) {
            s.emit("alert-triggered", alertData);
          }
        }
      }
    });

    server.listen(PORT, () => {
      console.log(` Server running on http://localhost:${PORT}`);
      updateStock(); // start updating prices automatically
    });
  } catch (error) {
    console.error(" Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
