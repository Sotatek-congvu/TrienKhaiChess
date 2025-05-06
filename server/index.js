const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // In production, you should limit this to your application domain
        methods: ["GET", "POST"]
    }
});

// Game rooms and player tracking
const rooms = new Map();
const playersInRoom = new Map();
const connectedPlayers = new Map(); // Track all connected players
const playerChallenges = new Map(); // Track active challenges
const playersLookingForGame = []; // Queue of players looking for a game

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Get user information from auth
    const userId = socket.handshake.auth.userId || socket.id;
    const username = socket.handshake.auth.username || 'Anonymous';
    const displayName = socket.handshake.auth.displayName || username;
    const avatarUrl = socket.handshake.auth.avatarUrl;

    // Create a player object
    const player = {
        id: userId,
        username,
        displayName,
        avatarUrl,
        socketId: socket.id
    };

    // Track this connected player
    connectedPlayers.set(userId, {
        ...player,
        online: true,
        lastSeen: new Date()
    });

    // Broadcast updated player list to all clients
    broadcastPlayerList();

    // Create a new game room
    socket.on('createRoom', (gameOptions = {}) => {
        const roomId = uuidv4().substring(0, 8);

        // Initialize game state
        const gameRoom = {
            roomId,
            gameState: {
                board: initializeBoard(),
                currentPlayer: 'white',
                moveHistory: [],
                capturedPieces: { white: [], black: [] }
            },
            whitePlayer: null,
            blackPlayer: null,
            spectators: [],
            whiteTime: gameOptions.timeLimit || 600, // 10 minutes default
            blackTime: gameOptions.timeLimit || 600,
            isGameActive: false,
            winner: null,
            moveHistory: []
        };

        // Assign creator as white player by default
        gameRoom.whitePlayer = { ...player, color: 'white' };

        // Store room and track player
        rooms.set(roomId, gameRoom);
        playersInRoom.set(userId, roomId);

        // Join socket room
        socket.join(roomId);

        // Check if this player was waiting for a game
        const playerIndex = playersLookingForGame.findIndex(p => p.id === userId);
        if (playerIndex !== -1) {
            // Remove from waiting queue
            playersLookingForGame.splice(playerIndex, 1);
        }

        // Try to match with someone else looking for a game
        findOpponentMatch(roomId);

        // Notify about successful room creation
        socket.emit('roomCreated', roomId);

        // Update room list for all users
        updateRoomList();
    });

    // Join an existing room
    socket.on('joinRoom', ({ roomId, asSpectator = false }) => {
        // Check if room exists
        if (!rooms.has(roomId)) {
            socket.emit('error', 'Room does not exist');
            return;
        }

        const room = rooms.get(roomId);

        // Handle joining as spectator or player
        if (asSpectator || (room.whitePlayer && room.blackPlayer)) {
            // Join as spectator
            room.spectators.push({ ...player });
            socket.join(roomId);
            playersInRoom.set(userId, roomId);

            socket.emit('roomJoined', room);
            socket.to(roomId).emit('playerJoined', { ...player, role: 'spectator' });
            return;
        }

        // Join as player (white or black)
        if (!room.whitePlayer) {
            room.whitePlayer = { ...player, color: 'white' };
            socket.join(roomId);
            playersInRoom.set(userId, roomId);

            socket.emit('roomJoined', room);
            socket.to(roomId).emit('playerJoined', { ...player, color: 'white' });
        } else if (!room.blackPlayer) {
            room.blackPlayer = { ...player, color: 'black' };
            socket.join(roomId);
            playersInRoom.set(userId, roomId);

            socket.emit('roomJoined', room);
            socket.to(roomId).emit('playerJoined', { ...player, color: 'black' });
        }

        // Update room list
        updateRoomList();
    });

    // Player ready status
    socket.on('playerReady', ({ roomId, ready }) => {
        if (!rooms.has(roomId)) return;

        const room = rooms.get(roomId);

        // Update player ready status
        if (room.whitePlayer && room.whitePlayer.id === userId) {
            room.whitePlayer.ready = ready;
        } else if (room.blackPlayer && room.blackPlayer.id === userId) {
            room.blackPlayer.ready = ready;
        } else {
            return; // Not a player
        }

        // Notify all users in the room
        io.to(roomId).emit('playerReadyUpdate', {
            playerId: userId,
            ready
        });

        // Check if both players are ready to start the game
        if (room.whitePlayer && room.blackPlayer &&
            room.whitePlayer.ready && room.blackPlayer.ready &&
            !room.isGameActive) {
            startGame(roomId);
        }
    });

    // Making a move
    socket.on('makeMove', ({ roomId, from, to, promoteTo }) => {
        if (!rooms.has(roomId)) return;

        const room = rooms.get(roomId);
        if (!room.isGameActive) return;

        // Validate it's the player's turn
        const isWhite = room.gameState.currentPlayer === 'white';
        if ((isWhite && room.whitePlayer.id !== userId) ||
            (!isWhite && room.blackPlayer.id !== userId)) {
            socket.emit('error', 'Not your turn');
            return;
        }

        // Process the move (in a real app, you'd validate the move here)
        const moveResult = processMove(room.gameState, from, to, promoteTo);
        if (!moveResult.valid) {
            socket.emit('error', moveResult.message || 'Invalid move');
            return;
        }

        // Update game state with the new move
        room.gameState = moveResult.gameState;
        room.moveHistory.push({
            from,
            to,
            piece: moveResult.piece,
            capturedPiece: moveResult.capturedPiece,
            isCheck: moveResult.isCheck,
            isCheckmate: moveResult.isCheckmate
        });

        // Handle game end conditions
        if (moveResult.isCheckmate) {
            room.isGameActive = false;
            room.winner = userId;
        } else if (moveResult.isDraw) {
            room.isGameActive = false;
            room.winner = 'draw';
        }

        // Broadcast game update to all players in the room
        io.to(roomId).emit('gameUpdate', {
            gameState: room.gameState,
            whiteTime: room.whiteTime,
            blackTime: room.blackTime,
            isGameActive: room.isGameActive,
            winner: room.winner,
            moveHistory: room.moveHistory
        });
    });

    // Dropping pieces from piece bank (for variants)
    socket.on('dropPiece', ({ roomId, pieceType, position, color }) => {
        if (!rooms.has(roomId)) return;

        const room = rooms.get(roomId);
        if (!room.isGameActive) return;

        // Validate it's the player's turn and they have this piece
        const isWhite = color === 'white';
        if ((isWhite && room.whitePlayer.id !== userId) ||
            (!isWhite && room.blackPlayer.id !== userId)) {
            socket.emit('error', 'Not your turn');
            return;
        }

        // Process dropping the piece (would need to validate in real implementation)
        const dropResult = processPieceDrop(room.gameState, pieceType, position, color);
        if (!dropResult.valid) {
            socket.emit('error', dropResult.message || 'Invalid drop');
            return;
        }

        // Update game state
        room.gameState = dropResult.gameState;
        room.moveHistory.push({
            type: 'drop',
            piece: pieceType,
            color: color,
            position: position
        });

        // Handle game end conditions if any
        if (dropResult.isCheckmate) {
            room.isGameActive = false;
            room.winner = userId;
        }

        // Broadcast game update
        io.to(roomId).emit('gameUpdate', {
            gameState: room.gameState,
            whiteTime: room.whiteTime,
            blackTime: room.blackTime,
            isGameActive: room.isGameActive,
            winner: room.winner,
            moveHistory: room.moveHistory
        });
    });

    // Look for a game match
    socket.on('lookForGame', () => {
        // Check if player is already in a room
        if (playersInRoom.has(userId)) {
            socket.emit('error', 'You are already in a game');
            return;
        }

        // Check if player is already in queue
        const existingIndex = playersLookingForGame.findIndex(p => p.id === userId);
        if (existingIndex !== -1) {
            socket.emit('error', 'You are already looking for a game');
            return;
        }

        // Add to queue of players looking for a game
        playersLookingForGame.push({ ...player, joinedAt: new Date() });

        // Notify the player they are in queue
        socket.emit('lookingForGame', { status: 'queued' });

        // Try to match with another player
        matchWaitingPlayers();
    });

    // Cancel looking for a game
    socket.on('cancelLookingForGame', () => {
        const index = playersLookingForGame.findIndex(p => p.id === userId);
        if (index !== -1) {
            playersLookingForGame.splice(index, 1);
            socket.emit('lookingForGame', { status: 'cancelled' });
        }
    });

    // Challenge another player
    socket.on('challengePlayer', ({ challengedPlayerId, gameOptions }) => {
        // Check if target player is connected
        if (!connectedPlayers.has(challengedPlayerId)) {
            socket.emit('error', 'Player is not online');
            return;
        }

        const challengedPlayer = connectedPlayers.get(challengedPlayerId);

        // Create a challenge
        const challengeId = uuidv4();
        const challenge = {
            id: challengeId,
            challenger: { ...player },
            challenged: { ...challengedPlayer },
            gameOptions,
            timestamp: new Date()
        };

        // Store the challenge
        playerChallenges.set(challengeId, challenge);

        // Notify the challenged player
        const challengedSocket = io.sockets.sockets.get(challengedPlayer.socketId);
        if (challengedSocket) {
            challengedSocket.emit('gameChallenge', {
                challengeId,
                challenger: {
                    id: player.id,
                    username: player.username,
                    displayName: player.displayName,
                    avatarUrl: player.avatarUrl
                },
                gameOptions
            });
        }

        // Notify the challenger that the challenge was sent
        socket.emit('challengeSent', {
            challengeId,
            challenged: {
                id: challengedPlayer.id,
                username: challengedPlayer.username,
                displayName: challengedPlayer.displayName
            }
        });
    });

    // Respond to a challenge
    socket.on('respondToChallenge', ({ challengeId, accept }) => {
        if (!playerChallenges.has(challengeId)) {
            socket.emit('error', 'Challenge not found or expired');
            return;
        }

        const challenge = playerChallenges.get(challengeId);

        // Validate the responding player is the challenged player
        if (challenge.challenged.id !== userId) {
            socket.emit('error', 'This challenge is not for you');
            return;
        }

        // Handle challenge response
        if (accept) {
            // Create a new game room
            const roomId = uuidv4().substring(0, 8);

            // Initialize game state
            const gameRoom = {
                roomId,
                gameState: {
                    board: initializeBoard(),
                    currentPlayer: 'white',
                    moveHistory: [],
                    capturedPieces: { white: [], black: [] }
                },
                whitePlayer: { ...challenge.challenger, color: 'white' },
                blackPlayer: { ...challenge.challenged, color: 'black' },
                spectators: [],
                whiteTime: challenge.gameOptions?.timeLimit || 600,
                blackTime: challenge.gameOptions?.timeLimit || 600,
                isGameActive: false,
                winner: null,
                moveHistory: []
            };

            // Store room and track players
            rooms.set(roomId, gameRoom);
            playersInRoom.set(challenge.challenger.id, roomId);
            playersInRoom.set(challenge.challenged.id, roomId);

            // Join socket room
            socket.join(roomId);

            // Get challenger socket and add them to the room
            const challengerSocket = io.sockets.sockets.get(challenge.challenger.socketId);
            if (challengerSocket) {
                challengerSocket.join(roomId);

                // Notify challenger their challenge was accepted
                challengerSocket.emit('challengeAccepted', {
                    challengeId,
                    roomId,
                    opponent: {
                        id: challenge.challenged.id,
                        username: challenge.challenged.username,
                        displayName: challenge.challenged.displayName,
                        avatarUrl: challenge.challenged.avatarUrl
                    }
                });
            }

            // Notify the challenged player (responder)
            socket.emit('roomJoined', gameRoom);

            // Update room list for all users
            updateRoomList();
        } else {
            // Challenge declined
            // Notify the challenger
            const challengerSocket = io.sockets.sockets.get(challenge.challenger.socketId);
            if (challengerSocket) {
                challengerSocket.emit('challengeDeclined', {
                    challengeId,
                    opponent: {
                        id: challenge.challenged.id,
                        username: challenge.challenged.username,
                        displayName: challenge.challenged.displayName
                    }
                });
            }

            // Notify the responder
            socket.emit('challengeResponseSent', { challengeId, accepted: false });
        }

        // Remove the challenge
        playerChallenges.delete(challengeId);
    });

    // Chat messages
    socket.on('sendMessage', ({ roomId, content }) => {
        if (!rooms.has(roomId)) return;

        // Create message object
        const message = {
            id: uuidv4(),
            userId: userId,
            username: username,
            avatarUrl: avatarUrl,
            content,
            timestamp: new Date().toISOString()
        };

        // Broadcast to everyone in the room
        io.to(roomId).emit('newMessage', message);
    });

    // Leave room
    socket.on('leaveRoom', ({ roomId }) => {
        handlePlayerLeaving(userId, roomId);
    });

    // Get available rooms
    socket.on('getRooms', () => {
        socket.emit('roomList', getRoomList());
    });

    // Get online players
    socket.on('getOnlinePlayers', () => {
        const players = [];
        connectedPlayers.forEach(player => {
            if (player.online) {
                players.push({
                    id: player.id,
                    username: player.username,
                    displayName: player.displayName,
                    avatarUrl: player.avatarUrl
                });
            }
        });
        socket.emit('onlinePlayers', players);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);

        // Update player's online status
        if (connectedPlayers.has(userId)) {
            const playerData = connectedPlayers.get(userId);
            playerData.online = false;
            playerData.lastSeen = new Date();
            connectedPlayers.set(userId, playerData);

            // Broadcast updated player list
            broadcastPlayerList();
        }

        // Remove from looking for game queue
        const queueIndex = playersLookingForGame.findIndex(p => p.id === userId);
        if (queueIndex !== -1) {
            playersLookingForGame.splice(queueIndex, 1);
        }

        // Find which room the user was in
        const roomId = playersInRoom.get(userId);
        if (roomId) {
            handlePlayerLeaving(userId, roomId);
        }

        // Clean up any pending challenges
        playerChallenges.forEach((challenge, id) => {
            if (challenge.challenger.id === userId || challenge.challenged.id === userId) {
                playerChallenges.delete(id);
            }
        });
    });
});

// Match players who are looking for a game
function matchWaitingPlayers() {
    if (playersLookingForGame.length < 2) return;

    // Sort by join time (first in, first out)
    playersLookingForGame.sort((a, b) => a.joinedAt - b.joinedAt);

    // Get the two players who have been waiting longest
    const player1 = playersLookingForGame.shift();
    const player2 = playersLookingForGame.shift();

    // Create a new game room
    const roomId = uuidv4().substring(0, 8);

    // Initialize game state
    const gameRoom = {
        roomId,
        gameState: {
            board: initializeBoard(),
            currentPlayer: 'white',
            moveHistory: [],
            capturedPieces: { white: [], black: [] }
        },
        whitePlayer: { ...player1, color: 'white' },
        blackPlayer: { ...player2, color: 'black' },
        spectators: [],
        whiteTime: 600, // Default 10 minutes
        blackTime: 600,
        isGameActive: false,
        winner: null,
        moveHistory: []
    };

    // Store room and track players
    rooms.set(roomId, gameRoom);
    playersInRoom.set(player1.id, roomId);
    playersInRoom.set(player2.id, roomId);

    // Get player sockets
    const player1Socket = io.sockets.sockets.get(player1.socketId);
    const player2Socket = io.sockets.sockets.get(player2.socketId);

    // Join sockets to the room
    if (player1Socket) {
        player1Socket.join(roomId);
        player1Socket.emit('gameMatched', {
            roomId,
            opponent: {
                id: player2.id,
                username: player2.username,
                displayName: player2.displayName,
                avatarUrl: player2.avatarUrl
            },
            color: 'white'
        });
    }

    if (player2Socket) {
        player2Socket.join(roomId);
        player2Socket.emit('gameMatched', {
            roomId,
            opponent: {
                id: player1.id,
                username: player1.username,
                displayName: player1.displayName,
                avatarUrl: player1.avatarUrl
            },
            color: 'black'
        });
    }

    // Update room list for all users
    updateRoomList();
}

// Find an opponent match for a newly created room
function findOpponentMatch(roomId) {
    if (playersLookingForGame.length === 0) return;

    // Get the room
    const room = rooms.get(roomId);
    if (!room || room.blackPlayer) return; // Room already has two players

    // Get the player who has been waiting longest
    const opponent = playersLookingForGame.shift();

    // Add opponent as black player
    room.blackPlayer = { ...opponent, color: 'black' };
    playersInRoom.set(opponent.id, roomId);

    // Get opponent socket
    const opponentSocket = io.sockets.sockets.get(opponent.socketId);
    if (opponentSocket) {
        opponentSocket.join(roomId);
        opponentSocket.emit('gameMatched', {
            roomId,
            opponent: {
                id: room.whitePlayer.id,
                username: room.whitePlayer.username,
                displayName: room.whitePlayer.displayName,
                avatarUrl: room.whitePlayer.avatarUrl
            },
            color: 'black'
        });
    }

    // Notify creator that an opponent was found
    const creatorSocket = io.sockets.sockets.get(room.whitePlayer.socketId);
    if (creatorSocket) {
        creatorSocket.emit('opponentFound', {
            opponent: {
                id: opponent.id,
                username: opponent.username,
                displayName: opponent.displayName,
                avatarUrl: opponent.avatarUrl
            }
        });
    }

    // Update room list
    updateRoomList();
}

// Broadcast the list of online players to all connected clients
function broadcastPlayerList() {
    const players = [];
    connectedPlayers.forEach(player => {
        if (player.online) {
            players.push({
                id: player.id,
                username: player.username,
                displayName: player.displayName,
                avatarUrl: player.avatarUrl
            });
        }
    });
    io.emit('onlinePlayers', players);
}

// Handle player leaving logic
function handlePlayerLeaving(userId, roomId) {
    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);

    // Check if user is a player or spectator
    if (room.whitePlayer && room.whitePlayer.id === userId) {
        // White player left
        room.whitePlayer = null;
        io.to(roomId).emit('playerLeft', userId);
    } else if (room.blackPlayer && room.blackPlayer.id === userId) {
        // Black player left
        room.blackPlayer = null;
        io.to(roomId).emit('playerLeft', userId);
    } else {
        // Remove from spectators
        room.spectators = room.spectators.filter(s => s.id !== userId);
    }

    // Clean up tracking
    playersInRoom.delete(userId);

    // If no players left, remove the room
    if (!room.whitePlayer && !room.blackPlayer) {
        rooms.delete(roomId);
    }

    // Update room list
    updateRoomList();
}

// Start a game
function startGame(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    // Set game as active
    room.isGameActive = true;

    // Reset/initialize the game state if needed
    room.gameState = initializeBoard();
    room.moveHistory = [];

    // Notify all users in the room
    io.to(roomId).emit('gameUpdate', {
        gameState: room.gameState,
        whiteTime: room.whiteTime,
        blackTime: room.blackTime,
        isGameActive: room.isGameActive,
        winner: null,
        moveHistory: []
    });
}

// Get list of available rooms
function getRoomList() {
    const roomList = [];
    rooms.forEach((room, roomId) => {
        roomList.push({
            roomId,
            whiteName: room.whitePlayer ? room.whitePlayer.displayName : null,
            blackName: room.blackPlayer ? room.blackPlayer.displayName : null,
            spectatorCount: room.spectators.length,
            isActive: room.isGameActive
        });
    });
    return roomList;
}

// Update room list for all connected users
function updateRoomList() {
    io.emit('roomList', getRoomList());
}

// Initialize chess board (placeholder function)
function initializeBoard() {
    // Return a basic initial chess state
    // This would be replaced with your actual chess logic
    return {
        board: [
            // Standard 8x8 board setup would go here
            // This is just a placeholder
        ],
        currentPlayer: 'white',
        moveHistory: [],
        capturedPieces: { white: [], black: [] }
    };
}

// Process move (placeholder function)
function processMove(gameState, from, to, promoteTo) {
    // In a real implementation, this would validate and apply the move
    // For now, we'll just return a simple success response
    return {
        valid: true,
        gameState: {
            ...gameState,
            currentPlayer: gameState.currentPlayer === 'white' ? 'black' : 'white'
        },
        piece: { type: 'pawn', color: gameState.currentPlayer },
        capturedPiece: null,
        isCheck: false,
        isCheckmate: false,
        isDraw: false
    };
}

// Process piece drop (placeholder function)
function processPieceDrop(gameState, pieceType, position, color) {
    // In a real implementation, this would validate and apply the piece drop
    return {
        valid: true,
        gameState: {
            ...gameState,
            currentPlayer: gameState.currentPlayer === 'white' ? 'black' : 'white'
        },
        isCheckmate: false
    };
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('Server is running!');
});

// Clear expired challenges every minute
setInterval(() => {
    const now = new Date();
    playerChallenges.forEach((challenge, id) => {
        // Expire challenges after 5 minutes
        if (now - challenge.timestamp > 5 * 60 * 1000) {
            playerChallenges.delete(id);
        }
    });
}, 60000);

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});