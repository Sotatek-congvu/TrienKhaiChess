import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { PieceColor, Position, GameState, PieceType } from '@/lib/chess-models';
import { toast } from 'sonner';

// Define the server URL - adjust based on your deployment
const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3005';

interface Player {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    rating?: number;
}

interface GameRoom {
    roomId: string;
    gameState: GameState;
    whitePlayer: Player | null;
    blackPlayer: Player | null;
    spectators: Player[];
    whiteTime: number;
    blackTime: number;
    isGameActive: boolean;
    winner: string | null;
    moveHistory: any[];
}

interface ChatMessage {
    id: string;
    userId: string;
    username: string;
    avatarUrl?: string;
    content: string;
    timestamp: string;
}

export interface UseWebSocketGameProps {
    roomId?: string;
}

export const useWebSocketGame = ({ roomId }: UseWebSocketGameProps = {}) => {
    const { user, profile } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState<boolean>(false);
    const [room, setRoom] = useState<GameRoom | null>(null);
    const [playerColor, setPlayerColor] = useState<PieceColor | null>(null);
    const [opponent, setOpponent] = useState<Player | null>(null);
    const [isMyTurn, setIsMyTurn] = useState<boolean>(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [availableRooms, setAvailableRooms] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Initialize socket connection
    useEffect(() => {
        if (!user) return;

        const newSocket = io(SOCKET_SERVER_URL, {
            auth: {
                userId: user.id,
                username: profile?.username || user.email,
                displayName: profile?.display_name,
                avatarUrl: profile?.avatar_url
            },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        setSocket(newSocket);

        // Connection event handlers
        newSocket.on('connect', () => {
            console.log('Connected to WebSocket server');
            setConnected(true);
            setError(null);

            // If a room ID was provided, join that room
            if (roomId) {
                newSocket.emit('joinRoom', { roomId });
            } else {
                // Otherwise, get the list of available rooms
                newSocket.emit('getRooms');
            }
        });

        newSocket.on('connect_error', (err) => {
            console.error('WebSocket connection error:', err);
            setConnected(false);
            setError('Failed to connect to game server');
            toast.error('Failed to connect to game server');
        });

        newSocket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server');
            setConnected(false);
        });

        // Cleanup on unmount
        return () => {
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, [user, profile, roomId]);

    // Set up game-related event listeners
    useEffect(() => {
        if (!socket) return;

        // Room list updates
        socket.on('roomList', (rooms) => {
            setAvailableRooms(rooms);
        });

        // Room joined event
        socket.on('roomJoined', (gameRoom) => {
            console.log('Joined room:', gameRoom);
            setRoom(gameRoom);
            setIsLoading(false);

            // Determine player color and opponent
            if (gameRoom.whitePlayer && gameRoom.whitePlayer.id === user?.id) {
                setPlayerColor(PieceColor.WHITE);
                setOpponent(gameRoom.blackPlayer);
            } else if (gameRoom.blackPlayer && gameRoom.blackPlayer.id === user?.id) {
                setPlayerColor(PieceColor.BLACK);
                setOpponent(gameRoom.whitePlayer);
            } else {
                // User is a spectator
                setPlayerColor(null);
                setOpponent(null);
            }

            // Set initial turn state
            setIsMyTurn(
                playerColor !== null &&
                gameRoom.gameState.currentPlayer === playerColor
            );
        });

        // Room creation success
        socket.on('roomCreated', (roomId) => {
            console.log('Created room:', roomId);
            // Automatically join the room you created
            socket.emit('joinRoom', { roomId });
        });

        // Game state updates
        socket.on('gameUpdate', (gameData) => {
            console.log('Game update received:', gameData);
            setRoom(prevRoom => ({
                ...prevRoom!,
                gameState: gameData.gameState,
                whiteTime: gameData.whiteTime,
                blackTime: gameData.blackTime,
                isGameActive: gameData.isGameActive,
                winner: gameData.winner,
                moveHistory: gameData.moveHistory
            }));

            // Update whose turn it is
            if (playerColor) {
                setIsMyTurn(gameData.gameState.currentPlayer === playerColor);
            }

            // Handle game end
            if (gameData.winner !== null && !gameData.isGameActive) {
                const isWinner = gameData.winner === user?.id;
                const isDraw = gameData.winner === 'draw';

                if (isWinner) {
                    toast.success('You won!');
                } else if (isDraw) {
                    toast.info('The game ended in a draw!');
                } else {
                    toast.error('You lost!');
                }
            }
        });

        // Player joined/left events
        socket.on('playerJoined', (player) => {
            console.log('Player joined:', player);
            setRoom(prevRoom => {
                if (!prevRoom) return null;

                // Update the appropriate player slot
                if (player.color === PieceColor.WHITE) {
                    setOpponent(playerColor === PieceColor.BLACK ? player : null);
                    return { ...prevRoom, whitePlayer: player };
                } else if (player.color === PieceColor.BLACK) {
                    setOpponent(playerColor === PieceColor.WHITE ? player : null);
                    return { ...prevRoom, blackPlayer: player };
                } else {
                    // Add spectator
                    return {
                        ...prevRoom,
                        spectators: [...prevRoom.spectators, player]
                    };
                }
            });

            toast.info(`${player.displayName || player.username} joined the game`);
        });

        socket.on('playerLeft', (playerId) => {
            console.log('Player left:', playerId);
            setRoom(prevRoom => {
                if (!prevRoom) return null;

                // Check which player left
                if (prevRoom.whitePlayer?.id === playerId) {
                    if (playerColor === PieceColor.BLACK) setOpponent(null);
                    return { ...prevRoom, whitePlayer: null };
                } else if (prevRoom.blackPlayer?.id === playerId) {
                    if (playerColor === PieceColor.WHITE) setOpponent(null);
                    return { ...prevRoom, blackPlayer: null };
                } else {
                    // Remove from spectators
                    return {
                        ...prevRoom,
                        spectators: prevRoom.spectators.filter(s => s.id !== playerId)
                    };
                }
            });
        });

        // Chat messages
        socket.on('newMessage', (message) => {
            console.log('New message received:', message);
            setMessages(prev => [...prev, message]);
        });

        // Error handling
        socket.on('error', (errorMessage) => {
            console.error('WebSocket error:', errorMessage);
            setError(errorMessage);
            toast.error(errorMessage);
        });

        // Cleanup on unmount
        return () => {
            socket.off('roomList');
            socket.off('roomJoined');
            socket.off('roomCreated');
            socket.off('gameUpdate');
            socket.off('playerJoined');
            socket.off('playerLeft');
            socket.off('newMessage');
            socket.off('error');
        };
    }, [socket, user, playerColor]);

    // Create a new game room
    const createRoom = useCallback((gameOptions = {}) => {
        if (!socket || !connected) {
            toast.error('Not connected to game server');
            return;
        }

        setIsLoading(true);
        socket.emit('createRoom', gameOptions);
    }, [socket, connected]);

    // Join an existing game room
    const joinRoom = useCallback((roomId: string, asSpectator = false) => {
        if (!socket || !connected) {
            toast.error('Not connected to game server');
            return;
        }

        setIsLoading(true);
        socket.emit('joinRoom', { roomId, asSpectator });
    }, [socket, connected]);

    // Leave the current room
    const leaveRoom = useCallback(() => {
        if (!socket || !room?.roomId) return;
        socket.emit('leaveRoom', { roomId: room.roomId });
        setRoom(null);
        setPlayerColor(null);
        setOpponent(null);
        setMessages([]);
    }, [socket, room]);

    // Set ready state
    const setReady = useCallback((ready: boolean) => {
        if (!socket || !room?.roomId) return;
        socket.emit('playerReady', { roomId: room.roomId, ready });
    }, [socket, room]);

    // Make a move
    const makeMove = useCallback((from: Position, to: Position, promoteTo?: PieceType) => {
        if (!socket || !room || !playerColor) {
            console.error('Cannot make move: missing required data');
            return false;
        }

        const move = {
            from: {
                row: from.row,
                col: from.col
            },
            to: {
                row: to.row,
                col: to.col
            },
            piece: {
                type: room.gameState.board[from.row][from.col]?.type,
                color: room.gameState.board[from.row][from.col]?.color
            },
            promoteTo,
            timestamp: Date.now()
        };

        socket.emit('makeMove', {
            gameId: room.roomId,
            move,
            playerColor
        }, (response: any) => {
            if (response.success) {
                console.log('Move sent successfully');
                return true;
            } else {
                console.error('Failed to make move:', response.error);
                toast.error('Không thể thực hiện nước đi');
                return false;
            }
        });
    }, [socket, room, playerColor]);

    // Drop a piece from the piece bank
    const dropPiece = useCallback((pieceType: PieceType, position: Position) => {
        if (!socket || !room || !playerColor) {
            console.error('Cannot drop piece: missing required data');
            return false;
        }

        const move = {
            pieceType,
            position: {
                row: position.row,
                col: position.col
            },
            color: playerColor,
            isDropped: true,
            timestamp: Date.now()
        };

        socket.emit('dropPiece', {
            gameId: room.roomId,
            move
        }, (response: any) => {
            if (response.success) {
                console.log('Piece drop sent successfully');
                return true;
            } else {
                console.error('Failed to drop piece:', response.error);
                toast.error('Không thể thả quân cờ');
                return false;
            }
        });
    }, [socket, room, playerColor]);

    // Send a chat message
    const sendMessage = useCallback((content: string) => {
        if (!socket || !room || !user) {
            console.error('Cannot send message: missing required data');
            return false;
        }

        socket.emit('sendMessage', {
            gameId: room.roomId,
            message: content.trim(),
            senderId: user.id,
            timestamp: Date.now()
        }, (response: any) => {
            if (response.success) {
                console.log('Message sent successfully');
                return true;
            } else {
                console.error('Failed to send message:', response.error);
                toast.error('Không thể gửi tin nhắn');
                return false;
            }
        });
    }, [socket, room, user]);

    // Resign from the game
    const resignGame = useCallback(() => {
        if (!socket || !room || !user) {
            console.error('Cannot resign: missing required data');
            return false;
        }

        socket.emit('resignGame', {
            gameId: room.roomId,
            playerId: user.id,
            timestamp: Date.now()
        }, (response: any) => {
            if (response.success) {
                console.log('Resignation sent successfully');
                return true;
            } else {
                console.error('Failed to resign:', response.error);
                toast.error('Không thể từ bỏ game');
                return false;
            }
        });
    }, [socket, room, user]);

    // Offer or respond to a draw
    const handleDraw = useCallback((offer: boolean, accept?: boolean) => {
        if (!socket || !room?.roomId) {
            return false;
        }

        if (offer) {
            socket.emit('offerDraw', { roomId: room.roomId });
        } else if (accept !== undefined) {
            socket.emit('respondToDraw', { roomId: room.roomId, accept });
        }

        return true;
    }, [socket, room]);

    // Refresh list of available rooms
    const refreshRooms = useCallback(() => {
        if (!socket) return;
        socket.emit('getRooms');
    }, [socket]);

    return {
        connected,
        room,
        playerColor,
        opponent,
        isMyTurn,
        messages,
        isLoading,
        availableRooms,
        error,
        createRoom,
        joinRoom,
        leaveRoom,
        setReady,
        makeMove,
        dropPiece,
        sendMessage,
        resignGame,
        handleDraw,
        refreshRooms,
        // Expose game state from the room
        gameState: room?.gameState || null,
        whiteTime: room?.whiteTime || 0,
        blackTime: room?.blackTime || 0,
        isGameActive: room?.isGameActive || false,
        winner: room?.winner || null,
        moveHistory: room?.moveHistory || []
    };
};