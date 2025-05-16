import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { PieceColor, Position, GameState, PieceType } from '@/lib/chess-models';
import { makeMove, dropPiece } from '@/lib/chess-logic';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useSocket } from '@/context/SocketContext';

interface Player {
    id: string;
    email: string;
    username: string;
    color: 'white' | 'black';
}

interface GameData {
    id: string;
    white_player: Player;
    black_player: Player;
    game_state: GameState;
    white_time_remaining: number;
    black_time_remaining: number;
    status: string;
    winner_id: string | null;
}

interface SupabaseGameData {
    id: string;
    white_player: {
        id: string;
        email: string;
        username: string;
    };
    black_player: {
        id: string;
        email: string;
        username: string;
    };
    game_state: GameState;
    white_time_remaining: number;
    black_time_remaining: number;
    status: string;
    winner_id: string | null;
}

export interface UseOnlineGameProps {
    gameId?: string;
}

export const useOnlineGame = ({ gameId }: UseOnlineGameProps) => {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const { socket, isConnected } = useSocket();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [playerColor, setPlayerColor] = useState<PieceColor | null>(null);
    const [opponent, setOpponent] = useState<any>(null);
    const [isMyTurn, setIsMyTurn] = useState<boolean>(false);
    const [whiteTime, setWhiteTime] = useState<number>(600); // 10 min default
    const [blackTime, setBlackTime] = useState<number>(600);
    const [messages, setMessages] = useState<any[]>([]);
    const [gameResult, setGameResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [gameDetails, setGameDetails] = useState<any>(null);

    // Refs for timers and channels
    const activeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const messageChannelRef = useRef<any>(null);
    const gameChannelRef = useRef<any>(null);
    const mountedRef = useRef(true);

    // Initialize game when socket connects and gameId is available
    useEffect(() => {
        if (!socket || !isConnected || !gameId || !user) {
            console.log('Missing required data:', {
                hasSocket: !!socket,
                isConnected,
                hasGameId: !!gameId,
                hasUser: !!user
            });
            return;
        }

        console.log('Initializing game:', gameId);
        setIsLoading(true);

        // Join game room
        socket.emit('joinGame', { gameId }, (response: any) => {
            console.log('Join game response:', response);
            if (response.success) {
                console.log('Successfully joined game room');
                // Get initial game state
                socket.emit('getGameState', { gameId }, (gameData: any) => {
                    console.log('Received initial game state:', gameData);
                    if (gameData) {
                        setGameState(gameData.game_state);
                        setGameDetails(gameData);

                        // Set player color
                        const playerColor = gameData.white_player.id === user.id ? 'white' : 'black';
                        setPlayerColor(playerColor as PieceColor);
                        console.log('Player color set to:', playerColor);

                        // Set opponent
                        const opponent = playerColor === 'white' ? gameData.black_player : gameData.white_player;
                        setOpponent({
                            ...opponent,
                            color: playerColor === 'white' ? 'black' : 'white'
                        });

                        // Set turn
                        const isMyTurn = gameData.game_state.currentPlayer === playerColor;
                        setIsMyTurn(isMyTurn);
                        console.log('Turn set to:', isMyTurn);

                        // Set time
                        setWhiteTime(gameData.white_time_remaining);
                        setBlackTime(gameData.black_time_remaining);
                    }
                    setIsLoading(false);
                });
            } else {
                console.error('Failed to join game room:', response.error);
                toast.error('Failed to join game');
                setIsLoading(false);
            }
        });

        // Handle reconnection
        socket.on('reconnect', () => {
            console.log('Socket reconnected, rejoining game');
            socket.emit('reconnectGame', { gameId });
        });

        // Set up game state update listener
        socket.on('gameUpdate', (data: any) => {
            console.log('Game update received:', data);
            if (data.move) {
                // Update turn
                if (playerColor) {
                    setIsMyTurn(data.move.nextPlayer === playerColor);
                }
            }
        });

        // Handle player disconnection
        socket.on('playerDisconnected', (data: { playerId: string; username: string }) => {
            console.log('Player disconnected:', data);
            toast.warning(`${data.username} has disconnected`);
        });

        // Set up error handler
        socket.on('gameError', (error: any) => {
            console.error('Game error:', error);
            toast.error(error.message || 'Game error occurred');
        });

        return () => {
            console.log('Cleaning up game listeners');
            socket.off('gameUpdate');
            socket.off('gameError');
            socket.off('playerDisconnected');
            socket.off('reconnect');
            socket.emit('leaveGame', { gameId });
        };
    }, [socket, isConnected, gameId, user, playerColor]);

    // Subscribe to message updates
    const subscribeToMessages = useCallback((gameId: string) => {
        console.log("Setting up messages subscription for game:", gameId);

        try {
            const channel = supabase
                .channel(`messages-${gameId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `game_id=eq.${gameId}`
                }, async (payload) => {
                    console.log("New message received:", payload);
                    if (!payload.new) {
                        console.error("Invalid message payload received:", payload);
                        return;
                    }
                    const newMessage = payload.new as any;

                    // Fetch user details
                    const { data: userData, error: userError } = await supabase
                        .from('profiles')
                        .select('username, display_name, avatar_url')
                        .eq('id', newMessage.user_id)
                        .single();

                    if (userError) {
                        console.error("Error fetching user details:", userError);
                        return;
                    }

                    setMessages(prev => [...prev, {
                        ...newMessage,
                        username: userData?.display_name || userData?.username,
                        avatar_url: userData?.avatar_url
                    }]);
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log("Successfully subscribed to messages");
                    } else {
                        console.error("Failed to subscribe to messages:", status);
                        toast.error("Failed to connect to chat server");
                    }
                });

            messageChannelRef.current = channel;
            console.log("Messages subscription established");
        } catch (error) {
            console.error("Error setting up message subscription:", error);
            toast.error("Failed to connect to chat server");
        }
    }, []);

    // Start game timer
    const startTimer = useCallback((state: GameState) => {
        if (activeTimerRef.current) clearInterval(activeTimerRef.current);

        const timer = setInterval(() => {
            setWhiteTime(prev => state.currentPlayer === PieceColor.WHITE ? Math.max(0, prev - 1) : prev);
            setBlackTime(prev => state.currentPlayer === PieceColor.BLACK ? Math.max(0, prev - 1) : prev);

            // Auto-check for time expiration
            checkTimeExpiration();
        }, 1000);

        activeTimerRef.current = timer;
    }, []);

    // Check if either player's time has expired
    const checkTimeExpiration = useCallback(async () => {
        if (!gameDetails || gameDetails.status !== 'active' || !gameState) return;

        const currentColor = gameState.currentPlayer;
        const currentTime = currentColor === PieceColor.WHITE ? whiteTime : blackTime;

        if (currentTime <= 0) {
            // Time expired
            if (activeTimerRef.current) clearInterval(activeTimerRef.current);

            const winner = currentColor === PieceColor.WHITE ? gameDetails.black_player_id : gameDetails.white_player_id;

            try {
                // Update game with time expiration
                const { error } = await supabase
                    .from('games')
                    .update({
                        status: 'completed',
                        winner_id: winner,
                        end_time: new Date().toISOString()
                    })
                    .eq('id', gameId);

                if (error) {
                    console.error('Error updating game after time expiration:', error);
                    return;
                }

                // Show notification
                if (winner === user?.id) {
                    toast.success('Your opponent ran out of time. You win!');
                } else {
                    toast.error('You ran out of time. You lose!');
                }
            } catch (error) {
                console.error('Error handling time expiration:', error);
            }
        }
    }, [gameDetails, gameState, whiteTime, blackTime, user, gameId]);

    // Make a move
    const makeGameMove = useCallback(async (from: Position, to: Position, promoteTo?: PieceType) => {
        if (!gameId || !user || !gameState || !isMyTurn || !playerColor) {
            console.warn("Cannot make move - prerequisites not met:", {
                gameIdExists: !!gameId,
                userExists: !!user,
                gameStateExists: !!gameState,
                isMyTurn,
                playerColorExists: !!playerColor,
                socketExists: !!socket,
                isConnected
            });
            return false;
        }

        try {
            console.log("Attempting to make move:", {
                from,
                to,
                gameId,
                userId: user.id,
                playerColor,
                isMyTurn
            });

            // Emit move to server
            socket?.emit('makeMove', {
                gameId,
                move: { from, to }
            }, (response: { success: boolean; error?: string }) => {
                console.log("Move response from server:", response);
                if (!response.success) {
                    console.error('Move failed:', response.error);
                    toast.error(response.error || 'Failed to make move');
                    return false;
                }
                console.log('Move successful');
                return true;
            });

            return true;
        } catch (error) {
            console.error('Error making move:', error);
            toast.error('Failed to make move');
            return false;
        }
    }, [gameId, user, gameState, isMyTurn, playerColor, socket, isConnected]);

    // Drop a piece from piece bank
    const dropGamePiece = useCallback(async (pieceType: any, position: Position) => {
        if (!gameId || !user || !gameState || !isMyTurn || !playerColor) {
            console.warn("Cannot drop piece - prerequisites not met");
            return false;
        }

        try {
            console.log("Dropping piece type", pieceType, "at position", position);

            // Find piece in pieceBank
            const pieceToDrop = gameState.pieceBank[playerColor].find(p => p.type === pieceType);

            if (!pieceToDrop) {
                console.error("Piece not found in bank");
                return false;
            }

            // Create new game state with dropped piece
            const newState = dropPiece(gameState, pieceToDrop, position);

            // Calculate time increment
            const whiteTotalTime = playerColor === PieceColor.WHITE ?
                whiteTime + (gameDetails?.increment_time || 0) : whiteTime;
            const blackTotalTime = playerColor === PieceColor.BLACK ?
                blackTime + (gameDetails?.increment_time || 0) : blackTime;

            // Submit move to database
            const { error } = await supabase
                .from('games')
                .update({
                    game_state: newState as unknown as any,
                    move_history: [...(gameDetails?.move_history || []), {
                        isDropped: true,
                        piece: { type: pieceType, color: playerColor },
                        to: position
                    }],
                    white_time_remaining: whiteTotalTime,
                    black_time_remaining: blackTotalTime,
                    last_move_time: new Date().toISOString(),
                    status: newState.isCheckmate || newState.isStalemate ? 'completed' : 'active',
                    winner_id: newState.isCheckmate ?
                        (newState.currentPlayer === PieceColor.WHITE ? gameDetails?.black_player_id : gameDetails?.white_player_id) : null,
                    end_time: newState.isCheckmate || newState.isStalemate ? new Date().toISOString() : null
                })
                .eq('id', gameId);

            if (error) {
                console.error('Error dropping piece:', error);
                toast.error('Failed to drop piece');
                return false;
            }

            console.log("Piece successfully dropped");
            return true;
        } catch (error) {
            console.error('Error dropping piece:', error);
            toast.error('Failed to drop piece');
            return false;
        }
    }, [gameId, user, gameState, isMyTurn, playerColor, gameDetails, whiteTime, blackTime]);

    // Send a chat message
    const sendMessage = useCallback(async (content: string) => {
        if (!gameId || !user || !content.trim()) {
            return false;
        }

        try {
            console.log("Sending message:", content);

            const { error } = await supabase
                .from('messages')
                .insert({
                    game_id: gameId,
                    user_id: user.id,
                    content: content.trim()
                });

            if (error) {
                console.error('Error sending message:', error);
                toast.error('Failed to send message');
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send message');
            return false;
        }
    }, [gameId, user]);

    // Resign from the game
    const resignGame = useCallback(async () => {
        if (!gameId || !user || !playerColor || gameDetails?.status !== 'active') {
            console.warn("Cannot resign - prerequisites not met");
            return false;
        }

        try {
            console.log("Resigning from game");

            // Determine the winner (the opponent)
            const winner = playerColor === PieceColor.WHITE ? gameDetails.black_player_id : gameDetails.white_player_id;

            // Update game
            const { error } = await supabase
                .from('games')
                .update({
                    status: 'completed',
                    winner_id: winner,
                    end_time: new Date().toISOString()
                })
                .eq('id', gameId);

            if (error) {
                console.error('Error resigning game:', error);
                toast.error('Failed to resign');
                return false;
            }

            // Send a message about resignation
            await sendMessage('📢 I resigned from the game');

            // Update local state
            setGameResult({
                status: 'completed',
                winner: winner,
                reason: 'resignation'
            });

            toast.info('You have resigned');
            return true;
        } catch (error) {
            console.error('Error resigning:', error);
            toast.error('Failed to resign');
            return false;
        }
    }, [gameId, user, playerColor, gameDetails, sendMessage]);

    // Offer or accept a draw
    const handleDraw = useCallback(async () => {
        if (!gameId || !user || gameDetails?.status !== 'active') {
            console.warn("Cannot handle draw - prerequisites not met");
            return false;
        }

        try {
            console.log("Processing draw action");

            if (gameDetails.draw_offered_by && gameDetails.draw_offered_by !== user.id) {
                // Accepting a draw offer
                console.log("Accepting draw offer");

                // Update game
                const { error } = await supabase
                    .from('games')
                    .update({
                        status: 'completed',
                        winner_id: null, // no winner in a draw
                        draw_offered_by: null,
                        end_time: new Date().toISOString()
                    })
                    .eq('id', gameId);

                if (error) {
                    console.error('Error accepting draw:', error);
                    toast.error('Failed to accept draw');
                    return false;
                }

                // Send a message about accepting draw
                await sendMessage('📢 I accepted the draw offer');

                toast.info('Game ended in a draw');
                return true;
            } else if (!gameDetails.draw_offered_by) {
                // Offering a draw
                console.log("Offering draw");

                const { error } = await supabase
                    .from('games')
                    .update({
                        draw_offered_by: user.id
                    })
                    .eq('id', gameId);

                if (error) {
                    console.error('Error offering draw:', error);
                    toast.error('Failed to offer draw');
                    return false;
                }

                // Send a message about draw offer
                await sendMessage('📢 I offered a draw');

                toast.info('Draw offered');
                return true;
            } else {
                // Canceling own draw offer
                console.log("Canceling own draw offer");

                const { error } = await supabase
                    .from('games')
                    .update({
                        draw_offered_by: null
                    })
                    .eq('id', gameId);

                if (error) {
                    console.error('Error canceling draw offer:', error);
                    toast.error('Failed to cancel draw offer');
                    return false;
                }

                // Send a message about canceling draw offer
                await sendMessage('📢 I canceled my draw offer');

                toast.info('Draw offer canceled');
                return true;
            }
        } catch (error) {
            console.error('Error handling draw:', error);
            toast.error('Failed to process draw action');
            return false;
        }
    }, [gameId, user, gameDetails, sendMessage]);

    // Create a new game
    const createGame = useCallback(async () => {
        if (!user) {
            toast.error('You must be logged in to create a game');
            return null;
        }

        try {
            console.log("Creating new game");

            // Import the createInitialGameState function
            const { createInitialGameState } = await import('@/lib/chess-models');

            // Create initial game state with white player first
            const initialState = createInitialGameState();
            initialState.currentPlayer = PieceColor.WHITE; // Ensure white moves first

            // Create game in database
            const { data, error } = await supabase
                .from('games')
                .insert({
                    white_player_id: user.id, // Challenger is always white
                    game_state: initialState as unknown as any,
                    move_history: [],
                    initial_time: 600, // 10 minutes
                    increment_time: 5,  // 5 seconds
                    white_time_remaining: 600,
                    black_time_remaining: 600,
                    status: 'waiting' // Game starts in waiting state
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating game:', error);
                toast.error('Failed to create new game');
                return null;
            }

            console.log("Game created successfully:", data.id);
            toast.success('Game created. Waiting for opponent...');
            return data.id;
        } catch (error) {
            console.error('Error creating game:', error);
            toast.error('Failed to create new game');
            return null;
        }
    }, [user]);

    // Join an existing game
    const joinGame = useCallback(async (gameId: string) => {
        if (!user) {
            toast.error('You must be logged in to join a game');
            return false;
        }

        try {
            console.log("Joining game:", gameId);

            // Check if game exists and is waiting for players
            const { data: game, error: fetchError } = await supabase
                .from('games')
                .select('*')
                .eq('id', gameId)
                .single();

            if (fetchError) {
                console.error('Error fetching game:', fetchError);
                toast.error('Game not found');
                return false;
            }

            if (game.status !== 'waiting') {
                toast.error('This game is not available to join');
                return false;
            }

            if (game.white_player_id === user.id) {
                toast.error('You cannot play against yourself');
                return false;
            }

            // Join as black player
            const { error: joinError } = await supabase
                .from('games')
                .update({
                    black_player_id: user.id,
                    status: 'active',
                    start_time: new Date().toISOString()
                })
                .eq('id', gameId);

            if (joinError) {
                console.error('Error joining game:', joinError);
                toast.error('Failed to join game');
                return false;
            }

            console.log("Successfully joined game");
            toast.success('Joined game!');
            return true;
        } catch (error) {
            console.error('Error joining game:', error);
            toast.error('Failed to join game');
            return false;
        }
    }, [user]);

    return {
        gameState,
        playerColor,
        opponent,
        isMyTurn,
        whiteTime,
        blackTime,
        messages,
        gameResult,
        isLoading,
        gameDetails,
        makeMove: makeGameMove,
        dropPiece: dropGamePiece,
        sendMessage,
        resignGame,
        handleDraw,
        createGame,
        joinGame
    };
};