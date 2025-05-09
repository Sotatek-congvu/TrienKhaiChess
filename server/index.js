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

const PORT = process.env.PORT || 3005;

// Game state management
const rooms = new Map();
const players = new Map();
const waitingPlayers = new Map();

// Challenge related data structures
const challenges = new Map(); // Map<challengeId, Challenge>
const userChallenges = new Map(); // Map<userId, Set<challengeId>>

// Timeouts
const CHALLENGE_TIMEOUT = 5 * 60 * 1000; // 5 minutes for challenge timeout
const RECONNECT_TIMEOUT = 30000; // 30 seconds for reconnect timeout

// Game rooms and player tracking
const connectedPlayers = new Map(); // Track all connected players
const playersLookingForGame = []; // Queue of players looking for a game
const disconnectedPlayers = new Map(); // Track disconnected players for reconnection
const gameStates = new Map(); // Track game states for reconnection

// WebSocket connection handling
io.on('connection', (socket) => {
    // Validate required connection information
    const userId = socket.handshake.auth.userId;
    const username = socket.handshake.auth.username;

    if (!userId || !username) {
        socket.emit('error', 'Missing required connection information: userId and username are required');
        socket.disconnect(true);
        return;
    }

    console.log(`User connected: ${username} (${userId})`);

    // Get additional user information
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

    // Send current challenges to the player
    const playerChallenges = getPlayerChallenges(userId);
    socket.emit('challenges:sync', playerChallenges);

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
        players.set(userId, roomId);

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
    socket.on('joinRoom', ({ roomId, asSpectator = false }, callback) => {
        // Check if room exists
        if (!rooms.has(roomId)) {
            if (callback) callback({ success: false, error: 'Room does not exist' });
            return;
        }

        const room = rooms.get(roomId);

        // Handle joining as spectator or player
        if (asSpectator || (room.whitePlayer && room.blackPlayer)) {
            // Join as spectator
            room.spectators.push({ ...player });
            socket.join(roomId);
            players.set(userId, roomId);

            socket.emit('roomJoined', room);
            socket.to(roomId).emit('playerJoined', { ...player, role: 'spectator' });
            if (callback) callback({ success: true });
            return;
        }

        // Join as player (white or black)
        if (!room.whitePlayer) {
            room.whitePlayer = { ...player, color: 'white' };
            socket.join(roomId);
            players.set(userId, roomId);

            socket.emit('roomJoined', room);
            socket.to(roomId).emit('playerJoined', { ...player, color: 'white' });
            if (callback) callback({ success: true });
        } else if (!room.blackPlayer) {
            room.blackPlayer = { ...player, color: 'black' };
            socket.join(roomId);
            players.set(userId, roomId);

            socket.emit('roomJoined', room);
            socket.to(roomId).emit('playerJoined', { ...player, color: 'black' });
            if (callback) callback({ success: true });
        } else {
            if (callback) callback({ success: false, error: 'Room is full' });
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

        // Parse move coordinates
        const fromPos = from === 'bank' ? from : JSON.parse(from);
        const toPos = JSON.parse(to);

        // Process the move
        const moveResult = processMove(room.gameState, fromPos, toPos, promoteTo);
        if (!moveResult.valid) {
            socket.emit('error', moveResult.message || 'Invalid move');
            return;
        }

        // Update game state with the new move
        room.gameState = moveResult.gameState;
        room.moveHistory.push({
            from: fromPos,
            to: toPos,
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
        if (players.has(userId)) {
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

    // Handle reconnection
    socket.on('reconnect', ({ userId, roomId }) => {
        if (disconnectedPlayers.has(userId)) {
            const disconnectData = disconnectedPlayers.get(userId);
            if (Date.now() - disconnectData.timestamp <= RECONNECT_TIMEOUT) {
                // Restore game state
                if (gameStates.has(roomId)) {
                    const gameState = gameStates.get(roomId);
                    socket.join(roomId);
                    socket.emit('gameStateRestored', gameState);
                    io.to(roomId).emit('playerReconnected', { userId });
                }
                disconnectedPlayers.delete(userId);
            }
        }
    });

    // Challenge another player
    socket.on('challenge:send', ({ challengedUserId }) => {
        // Check if target player is connected and not in a game
        if (!connectedPlayers.has(challengedUserId)) {
            socket.emit('error', 'Player is not online');
            return;
        }

        const challengedPlayer = connectedPlayers.get(challengedUserId);
        if (players.has(challengedUserId)) {
            socket.emit('error', 'Player is already in a game');
            return;
        }

        // Create a challenge
        const challenge = createChallenge(player, challengedPlayer);

        // Notify the challenged player
        const challengedSocket = io.sockets.sockets.get(challengedPlayer.socketId);
        if (challengedSocket) {
            challengedSocket.emit('challenge:received', challenge);
        }

        // Notify the challenger
        socket.emit('challenge:sent', challenge);
    });

    // Accept a challenge
    socket.on('challenge:accept', ({ challengeId }) => {
        const challenge = challenges.get(challengeId);
        if (!challenge) {
            socket.emit('error', 'Challenge not found or expired');
            return;
        }

        // Validate the responding player is the challenged player
        if (challenge.challenged.id !== userId) {
            socket.emit('error', 'This challenge is not for you');
            return;
        }

        // Create a new game room
        const roomId = uuidv4().substring(0, 8);
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
            whiteTime: 600, // Default 10 minutes
            blackTime: 600,
            isGameActive: true, // Set game as active immediately
            winner: null,
            moveHistory: []
        };

        // Store room and track players
        rooms.set(roomId, gameRoom);
        players.set(challenge.challenger.id, roomId);
        players.set(challenge.challenged.id, roomId);

        // Join socket rooms
        socket.join(roomId);
        const challengerSocket = io.sockets.sockets.get(challenge.challenger.socketId);
        if (challengerSocket) {
            challengerSocket.join(roomId);
        }

        // Prepare game data for both players
        const gameData = {
            roomId,
            whitePlayer: gameRoom.whitePlayer,
            blackPlayer: gameRoom.blackPlayer,
            gameState: gameRoom.gameState,
            isGameActive: true
        };

        // Emit game:directStart to both players to trigger immediate navigation
        socket.emit('game:directStart', gameData);
        if (challengerSocket) {
            challengerSocket.emit('game:directStart', gameData);
        }

        // Also emit roomJoined to ensure both players are properly connected
        socket.emit('roomJoined', gameRoom);
        if (challengerSocket) {
            challengerSocket.emit('roomJoined', gameRoom);
        }

        // Remove the challenge
        challenges.delete(challengeId);

        // Remove from player challenges
        const challengerChallenges = userChallenges.get(challenge.challenger.id);
        const challengedChallenges = userChallenges.get(challenge.challenged.id);

        if (challengerChallenges) {
            challengerChallenges.delete(challengeId);
        }
        if (challengedChallenges) {
            challengedChallenges.delete(challengeId);
        }

        // Update room list
        updateRoomList();
    });

    // Decline a challenge
    socket.on('challenge:decline', ({ challengeId }) => {
        const challenge = challenges.get(challengeId);
        if (!challenge) {
            socket.emit('error', 'Challenge not found or expired');
            return;
        }

        // Validate the responding player is the challenged player
        if (challenge.challenged.id !== userId) {
            socket.emit('error', 'This challenge is not for you');
            return;
        }

        // Notify the challenger
        const challengerSocket = io.sockets.sockets.get(challenge.challenger.socketId);
        if (challengerSocket) {
            challengerSocket.emit('challenge:declined', challenge);
        }

        // Remove the challenge
        challenges.delete(challengeId);
        userChallenges.get(challenge.challenger.id)?.delete(challengeId);
        userChallenges.get(challenge.challenged.id)?.delete(challengeId);
    });

    // Cancel a challenge
    socket.on('challenge:cancel', ({ challengeId }) => {
        const challenge = challenges.get(challengeId);
        if (!challenge) {
            socket.emit('error', 'Challenge not found or expired');
            return;
        }

        // Validate the cancelling player is the challenger
        if (challenge.challenger.id !== userId) {
            socket.emit('error', 'Only the challenger can cancel the challenge');
            return;
        }

        // Notify the challenged player
        const challengedSocket = io.sockets.sockets.get(challenge.challenged.socketId);
        if (challengedSocket) {
            challengedSocket.emit('challenge:cancelled', challenge);
        }

        // Remove the challenge
        challenges.delete(challengeId);
        userChallenges.get(challenge.challenger.id)?.delete(challengeId);
        userChallenges.get(challenge.challenged.id)?.delete(challengeId);
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
        console.log(`User disconnected: ${username} (${userId})`);

        // Update player status
        const playerData = connectedPlayers.get(userId);
        if (playerData) {
            playerData.online = false;
            playerData.lastSeen = new Date();
        }

        // Handle player leaving their room
        const roomId = players.get(userId);
        if (roomId) {
            handlePlayerLeaving(userId, roomId);
        }

        // Broadcast updated player list
        broadcastPlayerList();
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
    players.set(player1.id, roomId);
    players.set(player2.id, roomId);

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
    players.set(opponent.id, roomId);

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
    const isDisconnected = disconnectedPlayers.has(userId);

    // If player is disconnected temporarily, don't remove them completely
    if (!isDisconnected) {
        if (room.whitePlayer && room.whitePlayer.id === userId) {
            room.whitePlayer = null;
            io.to(roomId).emit('playerLeft', { userId, color: 'white' });
        } else if (room.blackPlayer && room.blackPlayer.id === userId) {
            room.blackPlayer = null;
            io.to(roomId).emit('playerLeft', { userId, color: 'black' });
        } else {
            room.spectators = room.spectators.filter(s => s.id !== userId);
        }

        players.delete(userId);

        // Only remove room if both players are gone and not disconnected
        if (!room.whitePlayer && !room.blackPlayer &&
            !disconnectedPlayers.has(room.whitePlayer?.id) &&
            !disconnectedPlayers.has(room.blackPlayer?.id)) {
            rooms.delete(roomId);
            gameStates.delete(roomId);
        }

        updateRoomList();
    }
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

// Initialize chess board
function initializeBoard() {
    // Create an 8x8 board
    const board = Array(8).fill(null).map(() => Array(8).fill(null));

    // Set up pawns
    for (let i = 0; i < 8; i++) {
        board[1][i] = { type: 'pawn', color: 'black' };
        board[6][i] = { type: 'pawn', color: 'white' };
    }

    // Set up other pieces
    const pieceOrder = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    for (let i = 0; i < 8; i++) {
        board[0][i] = { type: pieceOrder[i], color: 'black' };
        board[7][i] = { type: pieceOrder[i], color: 'white' };
    }

    return {
        board,
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
    userChallenges.forEach((challenge, id) => {
        // Expire challenges after 5 minutes
        if (now - challenge.timestamp > 5 * 60 * 1000) {
            userChallenges.delete(id);
        }
    });
}, 60000);

// Add cleanup interval for inactive rooms
setInterval(() => {
    rooms.forEach((room, roomId) => {
        const now = Date.now();
        const lastActivity = room.lastActivity || now;

        // Remove rooms inactive for more than 1 hour
        if (now - lastActivity > 3600000 && !room.isGameActive) {
            rooms.delete(roomId);
            gameStates.delete(roomId);
            updateRoomList();
        }
    });
}, 300000); // Check every 5 minutes

// Helper function to get player challenges
function getPlayerChallenges(userId) {
    const challengeIds = userChallenges.get(userId);
    if (!challengeIds) return [];

    return Array.from(challengeIds)
        .map(id => challenges.get(id))
        .filter(Boolean);
}

// Helper function to create a challenge
function createChallenge(challenger, challenged) {
    const challengeId = uuidv4();
    const challenge = {
        id: challengeId,
        challenger: {
            id: challenger.id,
            username: challenger.username,
            displayName: challenger.displayName,
            avatarUrl: challenger.avatarUrl,
            socketId: challenger.socketId
        },
        challenged: {
            id: challenged.id,
            username: challenged.username,
            displayName: challenged.displayName,
            avatarUrl: challenged.avatarUrl,
            socketId: challenged.socketId
        },
        status: 'pending',
        timestamp: Date.now()
    };

    // Store challenge
    challenges.set(challengeId, challenge);

    // Initialize Sets for both players if they don't exist
    if (!userChallenges.has(challenger.id)) {
        userChallenges.set(challenger.id, new Set());
    }
    if (!userChallenges.has(challenged.id)) {
        userChallenges.set(challenged.id, new Set());
    }

    // Add challenge to both players' sets
    userChallenges.get(challenger.id).add(challengeId);
    userChallenges.get(challenged.id).add(challengeId);

    // Set timeout for challenge expiration
    setTimeout(() => {
        if (challenges.has(challengeId) && challenges.get(challengeId).status === 'pending') {
            handleChallengeExpired(challengeId);
        }
    }, CHALLENGE_TIMEOUT);

    return challenge;
}

// Helper function to handle challenge expiration
function handleChallengeExpired(challengeId) {
    const challenge = challenges.get(challengeId);
    if (!challenge) return;

    // Remove challenge
    challenges.delete(challengeId);

    // Remove from player challenges
    const challengerChallenges = userChallenges.get(challenge.challenger.id);
    const challengedChallenges = userChallenges.get(challenge.challenged.id);

    if (challengerChallenges) {
        challengerChallenges.delete(challengeId);
    }
    if (challengedChallenges) {
        challengedChallenges.delete(challengeId);
    }

    // Notify both players
    const challengerSocket = io.sockets.sockets.get(challenge.challenger.socketId);
    const challengedSocket = io.sockets.sockets.get(challenge.challenged.socketId);

    if (challengerSocket) {
        challengerSocket.emit('challenge:expired', challenge);
    }
    if (challengedSocket) {
        challengedSocket.emit('challenge:expired', challenge);
    }
}

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});