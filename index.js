import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { initializeBoard, applyMove, checkWinner, checkDraw } from "./games/tictactoe.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());

const PORT = process.env.PORT || 3000;

console.log("Starting Game Galaxy Server...");

// Health check endpoint for Render
app.get("/", (req, res) => {
  res.send("Game Galaxy Server Running");
});

// Matchmaking queue and game rooms
let waitingPlayer = null;
const gameRooms = new Map();
const rematchRequests = new Map();

io.on("connection", (socket) => {
  console.log("✅ NEW CONNECTION - Player connected:", socket.id);
  console.log("Total connections:", io.engine.clientsCount);

  // Handle matchmaking
  socket.on("find_match", () => {
    console.log("🎮 FIND_MATCH received from:", socket.id);
    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      console.log("🎲 Matching players:", waitingPlayer.id, "vs", socket.id);
      // Create a game room
      const roomId = `room_${Date.now()}`;
      const player1 = waitingPlayer;
      const player2 = socket;

      // Join both players to the room
      player1.join(roomId);
      player2.join(roomId);

      // Initialize game state
      const gameState = {
        board: initializeBoard(),
        players: {
          X: player1.id,
          O: player2.id
        },
        currentTurn: "X",
        roomId: roomId
      };

      gameRooms.set(roomId, gameState);

      // Store room info on sockets
      player1.roomId = roomId;
      player2.roomId = roomId;

      // Notify both players
      player1.emit("match_found", {
        roomId: roomId,
        symbol: "X",
        opponent: player2.id
      });

      player2.emit("match_found", {
        roomId: roomId,
        symbol: "O",
        opponent: player1.id
      });

      console.log(`✅ Match created: ${roomId}`);
      waitingPlayer = null;
    } else {
      waitingPlayer = socket;
      socket.emit("waiting", { message: "Waiting for opponent..." });
      console.log("⏳ Player waiting:", socket.id);
    }
  });

  // Handle game moves
  socket.on("make_move", ({ row, col }) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const gameState = gameRooms.get(roomId);
    if (!gameState) return;

    // Validate it's the player's turn
    const playerSymbol = gameState.players.X === socket.id ? "X" : "O";
    if (gameState.currentTurn !== playerSymbol) {
      socket.emit("error", { message: "Not your turn" });
      return;
    }

    // Apply the move
    const success = applyMove(gameState.board, row, col, playerSymbol);
    if (!success) {
      socket.emit("error", { message: "Invalid move" });
      return;
    }

    // Check for winner or draw
    const winner = checkWinner(gameState.board);
    const draw = checkDraw(gameState.board);

    // Switch turns BEFORE emitting (if game continues)
    if (!winner && !draw) {
      gameState.currentTurn = gameState.currentTurn === "X" ? "O" : "X";
    }

    // Update board for both players
    io.to(roomId).emit("update_board", {
      board: gameState.board,
      currentTurn: gameState.currentTurn
    });

    if (winner) {
      io.to(roomId).emit("game_over", {
        winner: winner,
        winnerSocketId: gameState.players[winner]
      });
      console.log(`Game over in ${roomId}: ${winner} wins`);
    } else if (draw) {
      io.to(roomId).emit("game_over", {
        winner: null,
        draw: true
      });
      console.log(`Game over in ${roomId}: Draw`);
    }
  });

  // Handle rematch requests
  socket.on("request_rematch", ({ roomId }) => {
    console.log(`Rematch requested in ${roomId} by ${socket.id}`);

    // Get opponent socket ID
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || room.size !== 2) {
      console.log("Room not valid for rematch");
      return;
    }

    const roomSockets = Array.from(room);
    const opponentId = roomSockets.find(id => id !== socket.id);

    if (!opponentId) {
      console.log("Opponent not found");
      return;
    }

    // Check if opponent already requested rematch
    const rematchKey = `${roomId}_${opponentId}`;
    if (rematchRequests.has(rematchKey)) {
      // Both players want rematch - start new game
      console.log(`Both players agreed to rematch in ${roomId}`);
      rematchRequests.delete(rematchKey);
      rematchRequests.delete(`${roomId}_${socket.id}`);

      // Initialize new game state
      const gameState = {
        board: initializeBoard(),
        players: {
          X: roomSockets[0],
          O: roomSockets[1]
        },
        currentTurn: "X",
        roomId: roomId
      };

      gameRooms.set(roomId, gameState);

      // Notify both players with their symbols
      io.to(roomSockets[0]).emit("rematch_accepted", { symbol: "X" });
      io.to(roomSockets[1]).emit("rematch_accepted", { symbol: "O" });

      io.to(roomId).emit("update_board", {
        board: gameState.board,
        currentTurn: gameState.currentTurn
      });
    } else {
      // First player to request - notify opponent
      rematchRequests.set(`${roomId}_${socket.id}`, true);
      io.to(opponentId).emit("rematch_requested");
      console.log(`Rematch request sent to ${opponentId}`);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);

    // Remove from waiting queue
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }

    // Handle game room disconnection
    if (socket.roomId) {
      const roomId = socket.roomId;
      io.to(roomId).emit("opponent_disconnected");
      gameRooms.delete(roomId);

      // Clean up rematch requests
      rematchRequests.delete(`${roomId}_${socket.id}`);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log("✅ Server running on port " + PORT);
  console.log("✅ Socket.IO server ready");
  console.log("Waiting for connections...");
});
