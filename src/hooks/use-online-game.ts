import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { GameState, PieceColor, Position, PieceType, Move, createInitialGameState } from '@/lib/chess-models';
import { makeMove, dropPiece, isKingInCheck } from '@/lib/chess-logic';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

// Define a type that extends Json to include GameState
type Json = string | number | boolean | null | { [key: string]: Json } | Json[];
type GameStateJson = GameState & { [key: string]: Json };

interface UseOnlineGameProps {
    gameId?: string;
}

interface GameMessage {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    username?: string;
    avatar_url?: string;
}

export const useOnlineGame = ({ gameId }: UseOnlineGameProps) => {
    // Auth and Game State
    const { user, profile } = useAuth();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [opponent, setOpponent] = useState<any>(null);
    const [playerColor, setPlayerColor] = useState<PieceColor | null>(null);
    const [isMyTurn, setIsMyTurn] = useState<boolean>(false);
    const [gameResult, setGameResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [gameDetails, setGameDetails] = useState<any>(null);

    // Time control
    const [whiteTime, setWhiteTime] = useState<number>(600); // 10 min default
    const [blackTime, setBlackTime] = useState<number>(600);
    const [activeTimer, setActiveTimer] = useState<NodeJS.Timeout | null>(null);

    // Messages
    const [messages, setMessages] = useState<GameMessage[]>([]);
    const [messageChannel, setMessageChannel] = useState<RealtimeChannel | null>(null);
    const [gameChannel, setGameChannel] = useState<RealtimeChannel | null>(null);

    // Disconnect from channels when component unmounts
    useEffect(() => {
        return () => {
            messageChannel?.unsubscribe();
            gameChannel?.unsubscribe();
            if (activeTimer) clearInterval(activeTimer);
        };
    }, [messageChannel, gameChannel, activeTimer]);

    // Fetch game data when gameId changes
    useEffect(() => {
        if (!gameId || !user) return;

        const fetchGameData = async () => {
            setIsLoading(true);

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

                if (gameError) throw gameError;

                // Set up game data
                setGameDetails(gameData);
                setGameState(gameData.game_state as unknown as GameState);
                setWhiteTime(gameData.white_time_remaining);
                setBlackTime(gameData.black_time_remaining);

                // Determine player color
                if (gameData.white_player_id === user.id) {
                    setPlayerColor(PieceColor.WHITE);
                    setOpponent(gameData.black_player);
                } else if (gameData.black_player_id === user.id) {
                    setPlayerColor(PieceColor.BLACK);
                    setOpponent(gameData.white_player);
                } else {
                    // If user is not a player, they are a spectator
                    setPlayerColor(null);
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

                if (messagesError) throw messagesError;

                setMessages(messagesData.map(msg => ({
                    ...msg,
                    username: msg.sender?.display_name || msg.sender?.username,
                    avatar_url: msg.sender?.avatar_url
                })));

                // Set up realtime subscriptions
                subscribeToGameUpdates(gameId);
                subscribeToMessages(gameId);

                // Set up timer if game is active
                if (gameData.status === 'active') {
                    startTimer(gameData.game_state as unknown as GameState);
                }
            } catch (error) {
                console.error('Error fetching game data:', error);
                toast.error('Không thể tải dữ liệu trò chơi');
            } finally {
                setIsLoading(false);
            }
        };

        fetchGameData();
    }, [gameId, user]);

    // Subscribe to game updates
    const subscribeToGameUpdates = (gameId: string) => {
        const channel = supabase
            .channel(`game-${gameId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'games',
                filter: `id=eq.${gameId}`
            }, (payload) => {
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
                    if (activeTimer) clearInterval(activeTimer);

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
                        toast.success('Bạn đã thắng!');
                    } else if (isDraw) {
                        toast.info('Ván đấu kết thúc với kết quả hòa!');
                    } else if (updatedGame.winner_id) {
                        toast.error('Bạn đã thua!');
                    }
                }
            })
            .subscribe();

        setGameChannel(channel);
    };

    // Subscribe to message updates
    const subscribeToMessages = (gameId: string) => {
        const channel = supabase
            .channel(`messages-${gameId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `game_id=eq.${gameId}`
            }, async (payload) => {
                const newMessage = payload.new as GameMessage;

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

        setMessageChannel(channel);
    };

    // Start game timer
    const startTimer = (state: GameState) => {
        if (activeTimer) clearInterval(activeTimer);

        const timer = setInterval(() => {
            setWhiteTime(prev => state.currentPlayer === PieceColor.WHITE ? Math.max(0, prev - 1) : prev);
            setBlackTime(prev => state.currentPlayer === PieceColor.BLACK ? Math.max(0, prev - 1) : prev);

            // Auto-check for time expiration
            checkTimeExpiration();
        }, 1000);

        setActiveTimer(timer);
        return () => clearInterval(timer);
    };

    // Check if either player's time has expired
    const checkTimeExpiration = useCallback(async () => {
        if (!gameDetails || gameDetails.status !== 'active' || !gameState) return;

        const currentColor = gameState.currentPlayer;
        const currentTime = currentColor === PieceColor.WHITE ? whiteTime : blackTime;

        if (currentTime <= 0) {
            // Time expired
            if (activeTimer) clearInterval(activeTimer);

            const winner = currentColor === PieceColor.WHITE ? gameDetails.black_player_id : gameDetails.white_player_id;

            // Update game with time expiration
            await supabase
                .from('games')
                .update({
                    status: 'completed',
                    winner_id: winner,
                    end_time: new Date().toISOString()
                })
                .eq('id', gameId);

            // Show notification
            if (winner === user?.id) {
                toast.success('Đối thủ đã hết thời gian. Bạn thắng!');
            } else {
                toast.error('Bạn đã hết thời gian. Bạn thua!');
            }
        }
    }, [gameDetails, gameState, whiteTime, blackTime, user, activeTimer]);

    // Make a move
    const makeGameMove = useCallback(async (from: Position, to: Position, promoteTo?: PieceType) => {
        if (!gameId || !user || !gameState || !isMyTurn || !playerColor) {
            return false;
        }

        try {
            // Create new game state
            const newState = makeMove(gameState, from, to, promoteTo);

            // Calculate time increment
            const whiteTotalTime = playerColor === PieceColor.WHITE ?
                whiteTime + gameDetails.increment_time : whiteTime;
            const blackTotalTime = playerColor === PieceColor.BLACK ?
                blackTime + gameDetails.increment_time : blackTime;

            // Submit move to database
            const { error } = await supabase
                .from('games')
                .update({
                    game_state: newState as unknown as Json,
                    move_history: [...gameDetails.move_history, { from, to, promoteTo }],
                    white_time_remaining: whiteTotalTime,
                    black_time_remaining: blackTotalTime,
                    last_move_time: new Date().toISOString(),
                    status: newState.isCheckmate || newState.isStalemate ? 'completed' : 'active',
                    winner_id: newState.isCheckmate ?
                        (newState.currentPlayer === PieceColor.WHITE ? gameDetails.black_player_id : gameDetails.white_player_id) : null,
                    end_time: newState.isCheckmate || newState.isStalemate ? new Date().toISOString() : null
                })
                .eq('id', gameId);

            if (error) throw error;

            // Update local state
            setGameState(newState);
            setIsMyTurn(false);

            return true;
        } catch (error) {
            console.error('Error making move:', error);
            toast.error('Không thể thực hiện nước đi');
            return false;
        }
    }, [gameId, user, gameState, isMyTurn, playerColor, gameDetails, whiteTime, blackTime]);

    // Drop a piece from piece bank
    const dropGamePiece = useCallback(async (pieceType: PieceType, position: Position) => {
        if (!gameId || !user || !gameState || !isMyTurn || !playerColor) {
            return false;
        }

        try {
            // Create a proper ChessPiece object from the PieceType
            const piece = {
                id: Math.random().toString(36).substring(2, 10), // Generate a random id
                type: pieceType,
                color: playerColor,
                hasMoved: false
            };

            // Create new game state
            const newState = dropPiece(gameState, piece, position);

            // Calculate time increment
            const whiteTotalTime = playerColor === PieceColor.WHITE ?
                whiteTime + gameDetails.increment_time : whiteTime;
            const blackTotalTime = playerColor === PieceColor.BLACK ?
                blackTime + gameDetails.increment_time : blackTime;

            // Submit move to database
            const { error } = await supabase
                .from('games')
                .update({
                    game_state: newState as unknown as Json,
                    move_history: [...gameDetails.move_history, { isDropped: true, piece: { type: pieceType, color: playerColor }, to: position }],
                    white_time_remaining: whiteTotalTime,
                    black_time_remaining: blackTotalTime,
                    last_move_time: new Date().toISOString(),
                    status: newState.isCheckmate || newState.isStalemate ? 'completed' : 'active',
                    winner_id: newState.isCheckmate ?
                        (newState.currentPlayer === PieceColor.WHITE ? gameDetails.black_player_id : gameDetails.white_player_id) : null,
                    end_time: newState.isCheckmate || newState.isStalemate ? new Date().toISOString() : null
                })
                .eq('id', gameId);

            if (error) throw error;

            // Update local state
            setGameState(newState);
            setIsMyTurn(false);

            return true;
        } catch (error) {
            console.error('Error dropping piece:', error);
            toast.error('Không thể thả quân');
            return false;
        }
    }, [gameId, user, gameState, isMyTurn, playerColor, gameDetails, whiteTime, blackTime]);

    // Send a chat message
    const sendMessage = useCallback(async (content: string) => {
        if (!gameId || !user || !content.trim()) {
            return false;
        }

        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    game_id: gameId,
                    user_id: user.id,
                    content: content.trim()
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Không thể gửi tin nhắn');
            return false;
        }
    }, [gameId, user]);

    // Resign from the game
    const resignGame = useCallback(async () => {
        if (!gameId || !user || !playerColor || gameDetails?.status !== 'active') {
            return false;
        }

        try {
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

            if (error) throw error;

            // Update local state
            setGameResult({
                status: 'completed',
                winner: winner,
                reason: 'resignation'
            });

            toast.info('Bạn đã đầu hàng');
            return true;
        } catch (error) {
            console.error('Error resigning:', error);
            toast.error('Không thể đầu hàng');
            return false;
        }
    }, [gameId, user, playerColor, gameDetails]);

    // Offer or accept a draw
    const handleDraw = useCallback(async (accept?: boolean) => {
        if (!gameId || !user || gameDetails?.status !== 'active') {
            return false;
        }

        try {
            if (gameDetails.draw_offered_by && gameDetails.draw_offered_by !== user.id) {
                // Accepting a draw offer
                if (accept) {
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

                    if (error) throw error;

                    toast.info('Ván đấu kết thúc với kết quả hòa');
                } else {
                    // Declining a draw offer
                    const { error } = await supabase
                        .from('games')
                        .update({
                            draw_offered_by: null
                        })
                        .eq('id', gameId);

                    if (error) throw error;

                    toast.info('Bạn đã từ chối đề nghị hòa');
                }
            } else if (!gameDetails.draw_offered_by) {
                // Offering a draw
                const { error } = await supabase
                    .from('games')
                    .update({
                        draw_offered_by: user.id
                    })
                    .eq('id', gameId);

                if (error) throw error;

                toast.info('Bạn đã đề nghị hòa');

                // Also send a system message
                await supabase
                    .from('messages')
                    .insert({
                        game_id: gameId,
                        user_id: user.id,
                        content: '📝 Đã đề nghị hòa'
                    });
            }

            return true;
        } catch (error) {
            console.error('Error handling draw:', error);
            toast.error('Không thể xử lý đề nghị hòa');
            return false;
        }
    }, [gameId, user, gameDetails]);

    // Create a new game and invite an opponent
    const createGame = useCallback(async () => {
        if (!user) {
            toast.error('Vui lòng đăng nhập để tạo trận đấu');
            return null;
        }

        try {
            // Create initial game state
            const initialState = createInitialGameState();

            // Create game in database
            const { data, error } = await supabase
                .from('games')
                .insert({
                    white_player_id: user.id,
                    game_state: initialState as unknown as Json,
                    move_history: [],
                    initial_time: 600, // 10 minutes
                    increment_time: 5,  // 5 seconds
                    white_time_remaining: 600,
                    black_time_remaining: 600
                })
                .select()
                .single();

            if (error) throw error;

            toast.success('Trận đấu đã được tạo. Đang chờ đối thủ...');
            return data.id;
        } catch (error) {
            console.error('Error creating game:', error);
            toast.error('Không thể tạo trận đấu mới');
            return null;
        }
    }, [user]);

    // Join an existing game
    const joinGame = useCallback(async (gameId: string) => {
        if (!user) {
            toast.error('Vui lòng đăng nhập để tham gia trận đấu');
            return false;
        }

        try {
            // Check if game exists and is waiting for players
            const { data: game, error: fetchError } = await supabase
                .from('games')
                .select('*')
                .eq('id', gameId)
                .single();

            if (fetchError) throw fetchError;

            if (game.status !== 'waiting') {
                toast.error('Trận đấu này không sẵn sàng để tham gia');
                return false;
            }

            if (game.white_player_id === user.id) {
                toast.error('Bạn không thể chơi với chính mình');
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

            if (joinError) throw joinError;

            toast.success('Đã tham gia trận đấu!');
            return true;
        } catch (error) {
            console.error('Error joining game:', error);
            toast.error('Không thể tham gia trận đấu');
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