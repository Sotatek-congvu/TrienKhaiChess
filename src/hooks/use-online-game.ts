import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { PieceColor, Position, GameState, PieceType } from '@/lib/chess-models';
import { makeMove, dropPiece } from '@/lib/chess-logic';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface UseOnlineGameProps {
    gameId?: string;
}

export const useOnlineGame = ({ gameId }: UseOnlineGameProps) => {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
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

    // Fetch game data when gameId changes
    useEffect(() => {
        if (!gameId || !user) return;

        const fetchGameData = async () => {
            setIsLoading(true);
            console.log("Fetching game data for ID:", gameId);

            try {
                // Fetch game data
                const { data: gameData, error: gameError } = await supabase
                    .from('games')
                    .select(`
                        *,
                        white_player:white_player_id(id, username, display_name, avatar_url, rating),
                        black_player:black_player_id(id, username, display_name, avatar_url, rating)
                    `)
                    .eq('id', gameId)
                    .single();

                if (gameError) {
                    console.error('Error fetching game data:', gameError);
                    toast.error('Could not load game data');
                    throw gameError;
                }

                console.log("Game data received:", gameData);

                // Set up game data
                setGameDetails(gameData);
                setGameState(gameData.game_state as unknown as GameState);
                setWhiteTime(gameData.white_time_remaining);
                setBlackTime(gameData.black_time_remaining);

                // Determine player color
                if (gameData.white_player_id === user.id) {
                    setPlayerColor(PieceColor.WHITE);
                    setOpponent(gameData.black_player);
                    console.log("You are playing as WHITE");
                } else if (gameData.black_player_id === user.id) {
                    setPlayerColor(PieceColor.BLACK);
                    setOpponent(gameData.white_player);
                    console.log("You are playing as BLACK");
                } else {
                    // If user is not a player, they are a spectator
                    setPlayerColor(null);
                    console.log("You are a SPECTATOR");
                }

                // Set whose turn it is
                setIsMyTurn(
                    (gameData.game_state as unknown as GameState).currentPlayer ===
                    (gameData.white_player_id === user.id ? PieceColor.WHITE : PieceColor.BLACK)
                );

                // Check if game is already over
                if (gameData.status === 'completed') {
                    setGameResult({
                        status: gameData.status,
                        winner: gameData.winner_id,
                        reason: (gameData.game_state as unknown as GameState).isCheckmate ? 'checkmate' :
                            (gameData.game_state as unknown as GameState).isStalemate ? 'stalemate' : 'other'
                    });
                }

                // Fetch chat messages
                const { data: messagesData, error: messagesError } = await supabase
                    .from('messages')
                    .select(`
                        *,
                        sender:user_id(username, display_name, avatar_url)
                    `)
                    .eq('game_id', gameId)
                    .order('created_at', { ascending: true });

                if (messagesError) {
                    console.error('Error fetching messages:', messagesError);
                } else {
                    setMessages(messagesData.map(msg => ({
                        ...msg,
                        username: msg.sender?.display_name || msg.sender?.username,
                        avatar_url: msg.sender?.avatar_url
                    })));
                }

                // Set up realtime subscriptions
                subscribeToGameUpdates(gameId);
                subscribeToMessages(gameId);

                // Set up timer if game is active
                if (gameData.status === 'active') {
                    startTimer(gameData.game_state as unknown as GameState);
                }
            } catch (error) {
                console.error('Error during game data retrieval:', error);
                toast.error('Failed to load game data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchGameData();

        // Cleanup function
        return () => {
            if (activeTimerRef.current) clearInterval(activeTimerRef.current);
            if (messageChannelRef.current) messageChannelRef.current.unsubscribe();
            if (gameChannelRef.current) gameChannelRef.current.unsubscribe();
        };
    }, [gameId, user]);

    // Subscribe to game updates
    const subscribeToGameUpdates = useCallback((gameId: string) => {
        console.log("Setting up game updates subscription for game:", gameId);

        const channel = supabase
            .channel(`game-${gameId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'games',
                filter: `id=eq.${gameId}`
            }, (payload) => {
                console.log("Game update received:", payload);
                const updatedGame = payload.new as any;

                // Update game state
                setGameState(updatedGame.game_state as GameState);
                setGameDetails(prev => ({ ...prev, ...updatedGame }));

                // Update whose turn it is
                if (playerColor) {
                    setIsMyTurn((updatedGame.game_state as GameState).currentPlayer === playerColor);
                }

                // Update time
                setWhiteTime(updatedGame.white_time_remaining);
                setBlackTime(updatedGame.black_time_remaining);

                // Check if game has ended
                if (updatedGame.status === 'completed' && gameDetails?.status !== 'completed') {
                    if (activeTimerRef.current) clearInterval(activeTimerRef.current);

                    setGameResult({
                        status: updatedGame.status,
                        winner: updatedGame.winner_id,
                        reason: (updatedGame.game_state as GameState).isCheckmate ? 'checkmate' :
                            (updatedGame.game_state as GameState).isStalemate ? 'stalemate' : 'other'
                    });

                    // Show toast notification
                    const isWinner = updatedGame.winner_id === user?.id;
                    const isDraw = !updatedGame.winner_id && updatedGame.status === 'completed';

                    if (isWinner) {
                        toast.success('You won!');
                    } else if (isDraw) {
                        toast.info('The game ended in a draw!');
                    } else if (updatedGame.winner_id) {
                        toast.error('You lost!');
                    }
                }
            })
            .subscribe();

        gameChannelRef.current = channel;
        console.log("Game updates subscription established");
    }, [user, playerColor, gameDetails]);

    // Subscribe to message updates
    const subscribeToMessages = useCallback((gameId: string) => {
        console.log("Setting up messages subscription for game:", gameId);

        const channel = supabase
            .channel(`messages-${gameId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `game_id=eq.${gameId}`
            }, async (payload) => {
                console.log("New message received:", payload);
                const newMessage = payload.new as any;

                // Fetch user details
                const { data: userData } = await supabase
                    .from('profiles')
                    .select('username, display_name, avatar_url')
                    .eq('id', newMessage.user_id)
                    .single();

                setMessages(prev => [...prev, {
                    ...newMessage,
                    username: userData?.display_name || userData?.username,
                    avatar_url: userData?.avatar_url
                }]);
            })
            .subscribe();

        messageChannelRef.current = channel;
        console.log("Messages subscription established");
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
                playerColorExists: !!playerColor
            });
            return false;
        }

        try {
            console.log("Making move from", from, "to", to);

            // Create new game state
            const newState = makeMove(gameState, from, to, promoteTo);

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
                    move_history: [...(gameDetails?.move_history || []), { from, to, promoteTo }],
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
                console.error('Error making move:', error);
                toast.error('Failed to make move');
                return false;
            }

            console.log("Move successfully submitted");
            return true;
        } catch (error) {
            console.error('Error making move:', error);
            toast.error('Failed to make move');
            return false;
        }
    }, [gameId, user, gameState, isMyTurn, playerColor, gameDetails, whiteTime, blackTime]);

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

            // Create initial game state
            const initialState = createInitialGameState();

            // Create game in database
            const { data, error } = await supabase
                .from('games')
                .insert({
                    white_player_id: user.id,
                    game_state: initialState as unknown as any,
                    move_history: [],
                    initial_time: 600, // 10 minutes
                    increment_time: 5,  // 5 seconds
                    white_time_remaining: 600,
                    black_time_remaining: 600
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