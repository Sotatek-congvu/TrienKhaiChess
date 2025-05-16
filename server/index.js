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
const games = new Map(); // Map<gameId, Game>
const challenges = new Map(); // Map<challengeId, Challenge>
const userChallenges = new Map(); // Map<userId, Set<challengeId>>
const connectedPlayers = new Map(); // Map<userId, Player>

// Timeouts
const CHALLENGE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// WebSocket connection handling
io.on('connection', (socket) => {
    // Validate required connection information
    const userId = socket.handshake.auth.userId;
    const username = socket.handshake.auth.username;

    if (!userId || !username) {
        socket.emit('error', 'Missing required connection information');
        socket.disconnect(true);
        return;
    }

    console.log(`User connected: ${username} (${userId})`);

    // Create player object
    const player = {
        id: userId,
        email: socket.handshake.auth.email,
        username: socket.handshake.auth.username || socket.handshake.auth.email.split('@')[0],
        socketId: socket.id
    };

    // Track connected player
    connectedPlayers.set(userId, {
        ...player,
        online: true,
        lastSeen: new Date()
    });

    // Send current challenges to the player
    const playerChallenges = getPlayerChallenges(userId);
    socket.emit('challenges:sync', playerChallenges);

    // Challenge another player
    socket.on('challenge:send', ({ challengedUserId }) => {
        // Check if target player is connected and not in a game
        if (!connectedPlayers.has(challengedUserId)) {
            socket.emit('error', 'Player is not online');
            return;
        }

        const challengedPlayer = connectedPlayers.get(challengedUserId);
        if (games.has(challengedUserId)) {
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
    socket.on('challenge:accept', async (data) => {
        console.log('Received challenge:accept event:', data);

        const { challengeId } = data;
        if (!challengeId) {
            console.log('Missing challengeId');
            socket.emit('challenge:error', { message: 'Missing challenge ID' });
            return;
        }

        const challenge = challenges.get(challengeId);
        if (!challenge) {
            console.log('Challenge not found:', challengeId);
            socket.emit('challenge:error', { message: 'Challenge not found' });
            return;
        }

        // Validate the challenged player is the one accepting
        if (challenge.challenged.id !== userId) {
            console.log('Unauthorized accept attempt:', {
                challengedId: challenge.challenged.id,
                acceptingUserId: userId
            });
            socket.emit('challenge:error', { message: 'Not authorized to accept this challenge' });
            return;
        }

        // Validate both players are still connected
        const challenger = connectedPlayers.get(challenge.challenger.id);
        const challenged = connectedPlayers.get(challenge.challenged.id);

        if (!challenger || !challenged) {
            console.log('One or both players disconnected:', {
                challenger: challenger ? 'connected' : 'disconnected',
                challenged: challenged ? 'connected' : 'disconnected'
            });
            socket.emit('challenge:error', { message: 'One or both players are no longer connected' });
            return;
        }

        console.log('Creating new game between:', {
            challenger: challenger.username,
            challenged: challenged.username
        });        // Get simplified player information
        const challengerInfo = {
            id: challenger.id,
            email: challenger.email,
            username: challenger.username,
            color: 'white'
        };

        const challengedInfo = {
            id: challenged.id,
            email: challenged.email,
            username: challenged.username,
            color: 'black'
        };

        console.log('Assigning player colors:', {
            whitePlayer: `${challengerInfo.username} (${challengerInfo.id})`,
            blackPlayer: `${challengedInfo.username} (${challengedInfo.id})`,
            timestamp: new Date().toISOString()
        });

        // Create new game
        const gameId = uuidv4();
        const game = {
            gameId,
            whitePlayer: challengerInfo,
            blackPlayer: challengedInfo,
            isGameActive: true,
            winner: null,
            moveHistory: [],
            gameState: {
                board: createInitialBoard(),
                currentPlayer: 'white',
                lastMove: null,
                moveHistory: [],
                isCheckmate: false,
                isStalemate: false,
                isCheck: false,
                capturedPieces: { white: [], black: [] }
            }
        };
        games.set(gameId, game);

        // Send game start event to both players with complete information
        const gameData = {
            gameId,
            whitePlayer: challengerInfo,
            blackPlayer: challengedInfo,
            isGameActive: true,
            winner: null,
            moveHistory: []
        }; console.log('Sending game:start to players:', {
            gameId,
            whitePlayer: challenger.username,
            blackPlayer: challenged.username
        });

        // Chi tiết thông tin trạng thái ban đầu về quân trắng và quân đen
        console.log('Initial game state - player assignments:', {
            gameId,
            whitePlayerId: challengerInfo.id,
            whitePlayerName: challengerInfo.username,
            blackPlayerId: challengedInfo.id,
            blackPlayerName: challengedInfo.username,
            firstTurn: 'white', // Quân trắng đi trước theo quy tắc
            timestamp: new Date().toISOString()
        });

        // Send to challenger (white)
        io.to(challenger.socketId).emit('game:start', {
            ...gameData,
            playerColor: 'white',
            opponent: challengedInfo
        });

        // Send to challenged (black)
        io.to(challenged.socketId).emit('game:start', {
            ...gameData,
            playerColor: 'black',
            opponent: challengerInfo
        });

        // Clean up challenge
        challenges.delete(challengeId);
        userChallenges.get(challenge.challenger.id)?.delete(challengeId);
        userChallenges.get(challenge.challenged.id)?.delete(challengeId);

        console.log(`Game started successfully: ${gameId} between ${challenger.username} and ${challenged.username}`);
    });

    // Decline a challenge
    socket.on('challenge:decline', ({ challengeId }) => {
        const challenge = challenges.get(challengeId);
        if (!challenge) return;

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

    // Join a game
    socket.on('joinGame', ({ gameId }, callback) => {
        if (!games.has(gameId)) {
            console.log('Game not found:', gameId);
            if (typeof callback === 'function') {
                callback({ success: false, error: 'Game not found' });
            } else {
                socket.emit('gameError', 'Game not found');
            }
            return;
        }

        const game = games.get(gameId);

        // Đảm bảo game có gameState
        if (!game.gameState) {
            console.log('Creating initial game state for game:', gameId);
            game.gameState = {
                board: createInitialBoard(),
                currentPlayer: 'white',
                lastMove: null,
                moveHistory: game.moveHistory || [],
                isCheckmate: false,
                isStalemate: false,
                isCheck: false,
                capturedPieces: { white: [], black: [] }
            };
        }

        // Thêm thông tin về người chơi nếu thiếu
        let whitePlayer = game.whitePlayer;
        let blackPlayer = game.blackPlayer;

        if (!whitePlayer.displayName) {
            whitePlayer.displayName = whitePlayer.username;
        }

        if (!blackPlayer.displayName) {
            blackPlayer.displayName = blackPlayer.username;
        } console.log('Player joining game:', {
            player: username,
            gameId,
            gameState: !!game.gameState
        });        // Thêm log chi tiết về vai trò của người chơi (trắng/đen)
        const playerRole = game.whitePlayer.id === userId ? 'WHITE' : (game.blackPlayer.id === userId ? 'BLACK' : 'SPECTATOR');
        console.log('Player role in game:', {
            playerId: userId,
            playerName: username,
            role: playerRole,
            whitePlayerId: game.whitePlayer.id,
            whitePlayerName: game.whitePlayer.username,
            blackPlayerId: game.blackPlayer.id,
            blackPlayerName: game.blackPlayer.username,
            gameId,
            timestamp: new Date().toISOString()
        });

        // Thêm log về trạng thái hiện tại của bàn cờ
        console.log('Current game board state when player joined:', {
            gameId,
            currentPlayer: game.gameState.currentPlayer,
            moveHistoryLength: game.gameState.moveHistory.length,
            isGameActive: game.isGameActive
        });

        socket.join(gameId);

        // Thông báo kết quả cho client
        if (typeof callback === 'function') {
            callback({ success: true });
            // Gửi thông tin game sau khi callback
            socket.emit('gameJoined', game);
        } else {
            socket.emit('gameJoined', game);
        }

        console.log(`Player ${username} (${userId}) joined game ${gameId}`);
    });

    // Make a move
    socket.on('makeMove', ({ gameId, move }, callback) => {
        console.log('Received move request:', {
            gameId,
            move,
            userId,
            socketId: socket.id,
            timestamp: new Date().toISOString()
        });

        if (!games.has(gameId)) {
            console.log('Game not found:', gameId);
            if (typeof callback === 'function') {
                callback({ success: false, error: 'Game not found' });
            }
            return;
        }

        const game = games.get(gameId);
        console.log('Current game state:', {
            isGameActive: game.isGameActive,
            moveHistoryLength: game.moveHistory.length,
            whitePlayerId: game.whitePlayer.id,
            blackPlayerId: game.blackPlayer.id,
            currentUserId: userId
        });

        if (!game.isGameActive) {
            console.log('Game is not active');
            if (typeof callback === 'function') {
                callback({ success: false, error: 'Game is not active' });
            }
            return;
        }        // Validate it's the player's turn
        const isWhite = game.moveHistory.length % 2 === 0;
        console.log('Turn validation:', {
            isWhite,
            currentTurn: isWhite ? 'WHITE' : 'BLACK',
            whitePlayerId: game.whitePlayer.id,
            whitePlayerName: game.whitePlayer.username,
            blackPlayerId: game.blackPlayer.id,
            blackPlayerName: game.blackPlayer.username,
            currentUserId: userId,
            playerName: username,
            moveHistoryLength: game.moveHistory.length,
            timestamp: new Date().toISOString()
        });

        if ((isWhite && game.whitePlayer.id !== userId) ||
            (!isWhite && game.blackPlayer.id !== userId)) {
            console.log('Not player\'s turn:', {
                isWhite,
                whitePlayerId: game.whitePlayer.id,
                blackPlayerId: game.blackPlayer.id,
                currentUserId: userId
            });
            if (typeof callback === 'function') {
                callback({ success: false, error: 'Not your turn' });
            }
            return;
        }

        // Add move to history
        game.moveHistory.push({
            from: move.from,
            to: move.to,
            timestamp: Date.now()
        }); console.log('Forwarding move to opponent:', {
            from: move.from,
            to: move.to,
            nextPlayer: isWhite ? 'BLACK' : 'WHITE',
            currentPlayer: isWhite ? 'WHITE' : 'BLACK',
            opponentId: isWhite ? game.blackPlayer.id : game.whitePlayer.id,
            opponentName: isWhite ? game.blackPlayer.username : game.whitePlayer.username,
            timestamp: new Date().toISOString()
        });// Forward the move to the opponent
        const opponentId = isWhite ? game.blackPlayer.id : game.whitePlayer.id;
        const opponentSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.handshake.auth.userId === opponentId);

        // Tạo bản sao gameState để gửi về client
        const gameState = {
            board: game.gameState?.board || createInitialBoard(),
            currentPlayer: isWhite ? 'black' : 'white',
            lastMove: {
                from: move.from,
                to: move.to,
                piece: game.gameState?.board?.[move.from.row]?.[move.from.col] || null
            },
            moveHistory: game.moveHistory,
            isCheckmate: false,
            isStalemate: false,
            isCheck: false
        };

        // Cập nhật trạng thái game trên server
        if (!game.gameState) {
            game.gameState = gameState;
        } else {
            // Di chuyển quân cờ
            const piece = game.gameState.board[move.from.row][move.from.col];
            game.gameState.board[move.from.row][move.from.col] = null;
            game.gameState.board[move.to.row][move.to.col] = piece;
            game.gameState.currentPlayer = isWhite ? 'black' : 'white';
            game.gameState.lastMove = {
                from: move.from,
                to: move.to,
                piece: piece
            };
        }

        if (opponentSocket) {
            opponentSocket.emit('gameUpdate', {
                move: {
                    from: move.from,
                    to: move.to
                },
                gameState: game.gameState
            });
            console.log('Move and game state forwarded to opponent successfully');
        } else {
            console.log('Opponent socket not found:', opponentId);
        }        // Send success response to the player who made the move
        if (typeof callback === 'function') {
            callback({ success: true });
            console.log('Success response sent to player');

            // Cập nhật cho người chơi thực hiện nước đi
            socket.emit('gameUpdate', {
                gameState: game.gameState
            });
        }
    });

    // Send chat message
    socket.on('sendMessage', ({ gameId, message }) => {
        if (!games.has(gameId)) return;

        const game = games.get(gameId);
        const opponentId = game.whitePlayer.id === userId ? game.blackPlayer.id : game.whitePlayer.id;
        const opponentSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.handshake.auth.userId === opponentId);

        if (opponentSocket) {
            opponentSocket.emit('newMessage', {
                senderId: userId,
                message,
                timestamp: Date.now()
            });
        }
    });

    // Resign game
    socket.on('resignGame', ({ gameId }) => {
        if (!games.has(gameId)) return;

        const game = games.get(gameId);
        if (!game.isGameActive) return;

        // Set winner
        game.isGameActive = false;
        game.winner = game.whitePlayer.id === userId ? game.blackPlayer.id : game.whitePlayer.id;

        // Notify all players
        io.to(gameId).emit('gameUpdate', {
            isGameActive: false,
            winner: game.winner
        });
    });

    // Handle reconnection
    socket.on('reconnectGame', ({ gameId }) => {
        console.log('Player reconnecting to game:', { gameId, userId });

        if (!games.has(gameId)) {
            console.log('Game not found for reconnection:', gameId);
            socket.emit('error', 'Game not found');
            return;
        }

        const game = games.get(gameId);

        // Join the game room
        socket.join(gameId);

        // Send current game state
        socket.emit('gameJoined', {
            ...game,
            playerColor: game.whitePlayer.id === userId ? 'white' : 'black'
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${username} (${userId})`);

        // Update player status
        if (connectedPlayers.has(userId)) {
            connectedPlayers.set(userId, {
                ...connectedPlayers.get(userId),
                online: false,
                lastSeen: new Date()
            });
        }

        // Notify other players in the same games
        for (const [gameId, game] of games.entries()) {
            if (game.whitePlayer.id === userId || game.blackPlayer.id === userId) {
                io.to(gameId).emit('playerDisconnected', {
                    playerId: userId,
                    username: username
                });
            }
        }
    });
});

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
            email: challenger.email,
            username: challenger.username,
            socketId: challenger.socketId
        },
        challenged: {
            id: challenged.id,
            email: challenged.email,
            username: challenged.username,
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
    userChallenges.get(challenge.challenger.id)?.delete(challengeId);
    userChallenges.get(challenge.challenged.id)?.delete(challengeId);

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

// Helper function to create initial board
function createInitialBoard() {
    const board = Array(6).fill(null).map(() => Array(6).fill(null));

    // White pieces
    board[0][0] = { type: 'rook', color: 'white', hasMoved: false };
    board[0][1] = { type: 'knight', color: 'white', hasMoved: false };
    board[0][2] = { type: 'bishop', color: 'white', hasMoved: false };
    board[0][3] = { type: 'queen', color: 'white', hasMoved: false };
    board[0][4] = { type: 'king', color: 'white', hasMoved: false };
    board[0][5] = { type: 'bishop', color: 'white', hasMoved: false };

    board[1][0] = { type: 'pawn', color: 'white', hasMoved: false };
    board[1][1] = { type: 'pawn', color: 'white', hasMoved: false };
    board[1][2] = { type: 'pawn', color: 'white', hasMoved: false };
    board[1][3] = { type: 'pawn', color: 'white', hasMoved: false };
    board[1][4] = { type: 'pawn', color: 'white', hasMoved: false };
    board[1][5] = { type: 'pawn', color: 'white', hasMoved: false };

    // Black pieces
    board[5][0] = { type: 'rook', color: 'black', hasMoved: false };
    board[5][1] = { type: 'knight', color: 'black', hasMoved: false };
    board[5][2] = { type: 'bishop', color: 'black', hasMoved: false };
    board[5][3] = { type: 'queen', color: 'black', hasMoved: false };
    board[5][4] = { type: 'king', color: 'black', hasMoved: false };
    board[5][5] = { type: 'bishop', color: 'black', hasMoved: false };

    board[4][0] = { type: 'pawn', color: 'black', hasMoved: false };
    board[4][1] = { type: 'pawn', color: 'black', hasMoved: false };
    board[4][2] = { type: 'pawn', color: 'black', hasMoved: false };
    board[4][3] = { type: 'pawn', color: 'black', hasMoved: false };
    board[4][4] = { type: 'pawn', color: 'black', hasMoved: false };
    board[4][5] = { type: 'pawn', color: 'black', hasMoved: false };

    return board;
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('Server is running!');
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});