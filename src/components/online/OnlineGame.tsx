import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOnlineGame } from '@/hooks/use-online-game';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { PieceColor, PieceType, Position, GameState, createInitialGameState } from '@/lib/chess-models';
import { getValidMoves } from '@/lib/chess-logic';
import { convertGameState } from '@/lib/convert-game-state';
import ChessBoard from '@/components/ChessBoard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Clock, MessageSquare, Flag, X, CopyIcon, HandshakeIcon, Loader2, Download, Maximize2, Minimize2, Users } from 'lucide-react';
import GameAnalysis from '@/components/GameAnalysis';
import GameInfo from '../GameInfo';
import MoveHistory from '../MoveHistory';
import GameControls from '../GameControls';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface Player {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    color: 'white' | 'black';
}

interface GameData {
    gameId: string;
    whitePlayer: {
        id: string;
        email: string;
        username: string;
        color: 'white';
    };
    blackPlayer: {
        id: string;
        email: string;
        username: string;
        color: 'black';
    };
    isGameActive: boolean;
    winner: string | null;
    moveHistory: any[];
    playerColor: 'white' | 'black';
    opponent: {
        id: string;
        email: string;
        username: string;
        color: 'white' | 'black';
    };
}

interface GameRoom {
    roomId: string;
    gameState: any; // Sử dụng any để tránh lỗi khi server trả về định dạng khác
    whitePlayer: Player;
    blackPlayer: Player;
    spectators: any[];
    whiteTime: number;
    blackTime: number;
    isGameActive: boolean;
    winner: string | null;
    moveHistory: any[];
    messages?: Array<{
        senderId: string;
        message: string;
        timestamp: number;
    }>;
}

interface LoadingState {
    status: 'idle' | 'connecting' | 'loading' | 'ready' | 'error';
    error: string | null;
}

export default function OnlineGame() {
    const { gameId } = useParams<{ gameId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { socket } = useSocket();
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Array<{
        senderId: string;
        message: string;
        timestamp: number;
    }>>([]);
    const [showResignDialog, setShowResignDialog] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [fullscreenAnalysis, setFullscreenAnalysis] = useState(false);
    const [gameResult, setGameResult] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [gameDetails, setGameDetails] = useState<GameRoom | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
    const [validMoves, setValidMoves] = useState<Position[]>([]);

    // Tạo gameState mẫu và state để quản lý nó
    const [gameState, setGameState] = useState(createInitialGameState());
    // Thêm state để quản lý việc đảo ngược góc nhìn
    const [invertBoardView, setInvertBoardView] = useState(false);

    // Kết nối socket khi component mount
    useEffect(() => {
        if (!socket || !gameId) return;

        // Kết nối vào phòng game với callback
        socket.emit('joinGame', { gameId }, (response: { success: boolean; error?: string }) => {
            if (response.success) {
                setIsConnected(true);
                setError(null);
            } else {
                setError(response.error || 'Không thể tham gia game');
                setIsConnected(false);
            }
        });

        // Lắng nghe khi tham gia game thành công
        socket.on('gameJoined', (data: GameRoom) => {
            console.log('Game joined, received data:', data);
            setIsConnected(true);
            setError(null);
            setGameDetails(data);

            // Nếu server gửi trạng thái game, sử dụng nó
            if (data.gameState) {
                console.log('Using server-provided game state');

                // Sử dụng hàm chuyển đổi từ thư viện
                const convertedGameState = convertGameState(data.gameState);

                if (convertedGameState) {
                    console.log('Game state converted successfully');
                    setGameState(convertedGameState);
                } else {
                    console.error('Failed to convert game state from server');
                    setGameState(createInitialGameState());
                }

                // Tự động xác định góc nhìn dựa trên vai trò người chơi
                // Nếu người chơi là quân đen, mặc định đảo ngược góc nhìn để luôn có quân mình ở dưới
                if (data.blackPlayer.id === user?.id) {
                    console.log('User is playing as black, setting invertBoardView = false');
                    setInvertBoardView(false);
                } else if (data.whitePlayer.id === user?.id) {
                    console.log('User is playing as white, setting invertBoardView = false');
                    setInvertBoardView(false);
                } else {
                    // Nếu là người xem (spectator), mặc định góc nhìn là quân trắng ở dưới
                    console.log('User is spectating, setting default view');
                    setInvertBoardView(false);
                }
            } else {
                // Nếu không, tạo trạng thái mặc định
                console.log('Creating default game state');
                setGameState(createInitialGameState());
            }

            if (data.messages) {
                setMessages(data.messages);
            }
        });

        // Lắng nghe sự kiện lỗi
        socket.on('gameError', (error: string) => {
            console.error('Game error:', error);
            setError(error);
            setIsConnected(false);
        });

        // Lắng nghe sự kiện cập nhật game
        socket.on('gameUpdate', (update: {
            move?: { from: Position; to: Position };
            gameState?: any;
            isGameActive?: boolean;
            winner?: string;
        }) => {
            console.log('Game update received:', update);

            // Nếu server trả về gameState đầy đủ, sử dụng nó thay vì tự cập nhật cục bộ
            if (update.gameState) {
                console.log('Cập nhật toàn bộ game state từ server');

                // Sử dụng hàm chuyển đổi từ thư viện
                const convertedState = convertGameState(update.gameState);

                if (convertedState) {
                    console.log('Game state converted successfully');
                    setGameState(convertedState);
                } else {
                    console.error('Failed to convert game state from server');
                }
            }
            // Nếu chỉ có thông tin về nước đi, tự cập nhật gameState cục bộ
            else if (update.move) {
                console.log('Cập nhật nước đi từ server:', update.move);
                // Cập nhật game state với nước đi mới
                const newState = { ...gameState };
                const { from, to } = update.move;

                // Di chuyển quân cờ
                const piece = newState.board[from.row][from.col];
                newState.board[from.row][from.col] = null;
                newState.board[to.row][to.col] = piece;

                // Cập nhật lượt chơi
                newState.currentPlayer = newState.currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;

                // Cập nhật lastMove
                newState.lastMove = { from, to, piece };

                // Thêm vào lịch sử
                newState.moveHistory.push({ from, to, piece });

                setGameState(newState);
                toast.success('Nước đi đã được thực hiện');
            }

            if (update.isGameActive !== undefined) {
                setGameDetails(prev => prev ? { ...prev, isGameActive: update.isGameActive! } : null);
            }

            if (update.winner) {
                setGameDetails(prev => prev ? { ...prev, winner: update.winner! } : null);
                toast.info(`Người chơi ${update.winner === gameDetails?.whitePlayer.id ? 'Trắng' : 'Đen'} đã thắng!`);
            }
        });

        // Lắng nghe tin nhắn mới
        socket.on('newMessage', (message: { senderId: string; message: string; timestamp: number }) => {
            setMessages(prev => [...prev, message]);
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        // Cleanup khi component unmount
        return () => {
            socket.off('gameJoined');
            socket.off('gameError');
            socket.off('gameUpdate');
            socket.off('newMessage');
            socket.emit('leaveGame', { gameId });
        };
    }, [socket, gameId, gameState, gameDetails, user]);

    // Xử lý di chuyển quân cờ
    const handleMove = (newState: GameState) => {
        if (!socket || !gameId || !isConnected || !gameDetails) {
            console.log("Không thể di chuyển quân cờ: socket, gameId, kết nối hoặc gameDetails không tồn tại", {
                socketExists: !!socket,
                gameIdExists: !!gameId,
                isConnected,
                gameDetailsExists: !!gameDetails
            });
            return;
        }

        // Lấy nước đi cuối cùng từ lịch sử
        const lastMove = newState.lastMove;
        if (!lastMove) {
            console.log("Không thể di chuyển quân cờ: không có lastMove");
            return;
        }

        // Kiểm tra lượt chơi
        const isPlayerTurn = (gameDetails.whitePlayer.id === user?.id && gameState.currentPlayer === PieceColor.WHITE) ||
            (gameDetails.blackPlayer.id === user?.id && gameState.currentPlayer === PieceColor.BLACK);

        if (!isPlayerTurn) {
            console.log("Không phải lượt của bạn", {
                playerId: user?.id,
                whitePlayerId: gameDetails.whitePlayer.id,
                blackPlayerId: gameDetails.blackPlayer.id,
                currentPlayer: gameState.currentPlayer,
                playerColor: gameDetails.whitePlayer.id === user?.id ? "WHITE" : "BLACK"
            });
            toast.error('Chưa đến lượt của bạn');
            return;
        }

        console.log("Gửi nước đi lên server:", {
            gameId,
            from: lastMove.from,
            to: lastMove.to,
            piece: lastMove.piece
        });

        // Gửi nước đi lên server với callback
        socket.emit('makeMove', {
            gameId,
            move: {
                from: lastMove.from,
                to: lastMove.to
            }
        }, (response: { success: boolean; error?: string }) => {
            if (!response.success) {
                console.log("Lỗi khi thực hiện nước đi:", response.error);
                toast.error(response.error || 'Không thể thực hiện nước đi');
                // Khôi phục lại game state cũ
                setGameState(gameState);
            } else {
                console.log("Nước đi đã được server chấp nhận");
                // Đối với người di chuyển, không cần cập nhật game state ngay lập tức
                // Thay vào đó, chờ server gửi lại gameUpdate để đồng bộ
            }
        });
    };    // Hàm xử lý khi chọn quân cờ
    const handlePieceSelect = (position: Position) => {
        console.log("OnlineGame - handlePieceSelect được gọi với position:", position);

        if (!gameDetails?.isGameActive || !gameDetails) {
            console.log("Không thể chọn quân cờ: game không hoạt động hoặc không có gameDetails");
            return;
        }

        const piece = gameState.board[position.row][position.col];
        if (!piece) {
            console.log("Không có quân cờ tại vị trí", position);
            return;
        }

        // Kiểm tra xem quân cờ có thuộc về người chơi hiện tại không
        const isPlayerPiece = (gameDetails.whitePlayer.id === user?.id && piece.color === PieceColor.WHITE) ||
            (gameDetails.blackPlayer.id === user?.id && piece.color === PieceColor.BLACK);

        if (!isPlayerPiece) {
            console.log("Không thể di chuyển quân của đối thủ", {
                playerId: user?.id,
                pieceColor: piece.color,
                whitePlayerId: gameDetails.whitePlayer.id,
                blackPlayerId: gameDetails.blackPlayer.id
            });
            toast.error('Không thể di chuyển quân của đối thủ');
            return;
        }

        // Kiểm tra lượt chơi
        const isPlayerTurn = (gameDetails.whitePlayer.id === user?.id && gameState.currentPlayer === PieceColor.WHITE) ||
            (gameDetails.blackPlayer.id === user?.id && gameState.currentPlayer === PieceColor.BLACK);

        if (!isPlayerTurn) {
            console.log("Chưa đến lượt của bạn", {
                currentPlayer: gameState.currentPlayer,
                playerColor: gameDetails.whitePlayer.id === user?.id ? "WHITE" : "BLACK"
            });
            toast.error('Chưa đến lượt của bạn');
            return;
        }

        // Nếu mọi điều kiện đều thỏa mãn, thiết lập vị trí quân cờ đã chọn và tính toán các nước đi hợp lệ
        setSelectedPosition(position);
        const moves = getValidMoves(gameState, position);
        setValidMoves(moves);
        console.log('Valid moves:', moves);
    };    // Hàm xử lý khi chọn ô đích
    const handleSquareClick = (position: Position) => {
        console.log("OnlineGame - handleSquareClick được gọi với position:", position);

        // Nếu không có quân cờ được chọn, không làm gì cả
        if (!selectedPosition) {
            console.log("Không có quân cờ nào được chọn");

            // Kiểm tra xem ô có quân cờ không và có phải là quân của người chơi hiện tại không
            const piece = gameState.board[position.row][position.col];
            if (piece) {
                console.log("Có quân cờ tại vị trí này, cố gắng chọn quân:", piece);
                // Thử chọn quân cờ này nếu có
                handlePieceSelect(position);
            }
            return;
        }

        // Kiểm tra xem ô đích có nằm trong danh sách nước đi hợp lệ không
        const isValidMove = validMoves.some(move =>
            move.row === position.row && move.col === position.col
        );

        if (!isValidMove) {
            console.log("Nước đi không hợp lệ, bỏ chọn quân cờ");
            // Nếu không phải nước đi hợp lệ, bỏ chọn quân cờ
            setSelectedPosition(null);
            setValidMoves([]);
            return;
        }

        // Kiểm tra lại lượt chơi trước khi di chuyển
        if (!gameDetails) {
            console.log("Không thể di chuyển: không có gameDetails");
            return;
        }

        const isPlayerTurn = (gameDetails.whitePlayer.id === user?.id && gameState.currentPlayer === PieceColor.WHITE) ||
            (gameDetails.blackPlayer.id === user?.id && gameState.currentPlayer === PieceColor.BLACK);

        if (!isPlayerTurn) {
            console.log("Không thể di chuyển: không phải lượt của bạn");
            toast.error('Chưa đến lượt của bạn');
            return;
        }

        console.log("Tạo gameState mới với nước đi từ", selectedPosition, "đến", position);

        // Tạo game state mới với nước đi mới
        const newState = { ...gameState };
        const piece = newState.board[selectedPosition.row][selectedPosition.col];

        // Di chuyển quân cờ
        newState.board[selectedPosition.row][selectedPosition.col] = null;
        newState.board[position.row][position.col] = piece;

        // Cập nhật lastMove
        newState.lastMove = {
            from: selectedPosition,
            to: position,
            piece
        };

        // Cập nhật lượt chơi
        newState.currentPlayer = newState.currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;

        // Thêm vào lịch sử
        newState.moveHistory.push({
            from: selectedPosition,
            to: position,
            piece
        });

        // Reset selected piece và valid moves
        setSelectedPosition(null);
        setValidMoves([]);

        // Gửi nước đi lên server
        handleMove(newState);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !socket || !gameId || !isConnected) return;

        const newMessage = {
            senderId: user?.id || '1',
            message: message.trim(),
            timestamp: Date.now()
        };

        socket.emit('sendMessage', { gameId, message: newMessage });
        setMessage('');
    };

    const handleResign = () => {
        if (!socket || !gameId || !isConnected) return;
        socket.emit('resignGame', { gameId });
        setShowResignDialog(false);
    };

    // Hiển thị thông báo lỗi nếu có
    if (error) {
        return (
            <div className="min-h-screen bg-[#312e2b] text-white p-4">
                <div className="max-w-5xl mx-auto">
                    <Card className="bg-red-50 border-red-200">
                        <CardHeader>
                            <CardTitle className="text-red-900">Lỗi kết nối</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-red-700">{error}</p>
                            <div className="mt-4 flex gap-2">
                                <Button onClick={() => window.location.reload()}>
                                    Thử lại
                                </Button>
                                <Button variant="outline" onClick={() => navigate('/lobby')}>
                                    Quay lại Lobby
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // Hiển thị loading khi đang kết nối
    if (!isConnected) {
        return (
            <div className="min-h-screen bg-[#312e2b] text-white p-4">
                <div className="max-w-5xl mx-auto">
                    <Card className="bg-[#272522] border-gray-700">
                        <CardHeader>
                            <CardTitle>Đang kết nối...</CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#312e2b] text-white p-4">
            <div className="max-w-5xl mx-auto">
                <motion.header
                    className="mb-6 relative flex flex-wrap items-center justify-between gap-4"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="flex flex-col items-start">
                        <h1 className="text-2xl md:text-3xl font-bold text-white">
                            Chessmihouse 6×6
                        </h1>
                        <p className="text-gray-400 text-sm">
                            Cờ vua 6x6 với luật Crazyhouse - thả quân đã bắt
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {user && (
                            <div className="text-sm mr-1 hidden md:flex items-center gap-1">
                                <span className="text-gray-400">Xin chào,</span>
                                <span className="font-medium text-white">{user.user_metadata?.username || user.email}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-1">
                            <Button
                                variant="secondary"
                                size="sm"
                                className="flex items-center gap-1"
                                onClick={() => navigate('/lobby')}
                            >
                                <Users size={16} />
                                <span className="hidden sm:inline">Quay lại Lobby</span>
                            </Button>

                            <Button
                                variant="destructive"
                                size="sm"
                                className="flex items-center gap-1"
                                onClick={() => setShowResignDialog(true)}
                            >
                                <Flag size={16} />
                                <span className="hidden sm:inline">Đầu hàng</span>
                            </Button>
                        </div>
                    </div>
                </motion.header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">                    <motion.div
                    className="lg:col-span-2"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                >
                    {/* Player thông tin phía trên - hiển thị đối thủ */}
                    <div className="mb-4 flex items-center justify-between bg-[#272522] p-4 rounded-lg border border-gray-700">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-gray-600">
                                <AvatarImage
                                    src={gameDetails?.whitePlayer.id === user?.id
                                        ? gameDetails?.blackPlayer.avatarUrl
                                        : gameDetails?.whitePlayer.avatarUrl}
                                    alt={gameDetails?.whitePlayer.id === user?.id
                                        ? gameDetails?.blackPlayer.displayName
                                        : gameDetails?.whitePlayer.displayName}
                                />
                                <AvatarFallback>
                                    {(gameDetails?.whitePlayer.id === user?.id
                                        ? gameDetails?.blackPlayer.displayName
                                        : gameDetails?.whitePlayer.displayName)?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-medium">
                                    {gameDetails?.whitePlayer.id === user?.id
                                        ? gameDetails?.blackPlayer.displayName
                                        : gameDetails?.whitePlayer.displayName}
                                </div>
                                <div className="text-sm text-gray-400">
                                    {gameDetails?.whitePlayer.id === user?.id ? "Quân đen" : "Quân trắng"}
                                </div>
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-gray-300">
                            {gameDetails?.whitePlayer.id === user?.id ? gameDetails?.blackTime : gameDetails?.whiteTime}
                        </div>                    </div><ChessBoard
                        gameState={gameState}
                        onMove={(newState) => handleMove(newState)}
                        // Đặt góc nhìn để người chơi luôn thấy quân của mình ở dưới
                        // Nếu người chơi là quân trắng, góc nhìn là WHITE (quân trắng ở dưới)
                        // Nếu người chơi là quân đen, góc nhìn là BLACK (quân đen ở dưới)
                        perspective={gameDetails?.whitePlayer.id === user?.id ? PieceColor.WHITE : PieceColor.BLACK}
                        disabled={!isConnected || !gameDetails?.isGameActive ||
                            // Kiểm tra lượt chơi - chỉ cho phép di chuyển khi đến lượt người chơi
                            !((gameDetails?.whitePlayer.id === user?.id && gameState.currentPlayer === PieceColor.WHITE) ||
                                (gameDetails?.blackPlayer.id === user?.id && gameState.currentPlayer === PieceColor.BLACK))}
                        showCoordinates={true}
                        onPieceSelect={handlePieceSelect}
                        onSquareClick={handleSquareClick}
                    />{/* Player thông tin phía dưới - hiển thị người chơi hiện tại */}
                    <div className="mt-4 flex items-center justify-between bg-[#272522] p-4 rounded-lg border border-gray-700">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-gray-600">
                                <AvatarImage
                                    src={gameDetails?.whitePlayer.id === user?.id
                                        ? gameDetails?.whitePlayer.avatarUrl
                                        : gameDetails?.blackPlayer.avatarUrl}
                                    alt={gameDetails?.whitePlayer.id === user?.id
                                        ? gameDetails?.whitePlayer.displayName
                                        : gameDetails?.blackPlayer.displayName}
                                />
                                <AvatarFallback>
                                    {(gameDetails?.whitePlayer.id === user?.id
                                        ? gameDetails?.whitePlayer.displayName
                                        : gameDetails?.blackPlayer.displayName)?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-medium">
                                    {gameDetails?.whitePlayer.id === user?.id
                                        ? gameDetails?.whitePlayer.displayName
                                        : gameDetails?.blackPlayer.displayName}
                                </div>                                <div className="text-sm text-gray-400">
                                    {gameDetails?.whitePlayer.id === user?.id ? "Quân trắng" : "Quân đen"}
                                </div>
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-gray-300">
                            {gameDetails?.whitePlayer.id === user?.id ? gameDetails?.whiteTime : gameDetails?.blackTime}
                        </div>
                    </div>
                </motion.div>

                    <motion.div
                        className="space-y-4"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        <GameControls
                            gameState={gameState}
                            onNewGame={() => setGameState(createInitialGameState())}
                            onUndo={() => { }}
                            onReset={() => setGameState(createInitialGameState())}
                            onDrawOffer={async () => true}
                            onResign={async () => { }}
                            isGameActive={true}
                            isPlayerTurn={true}
                            canUndo={false}
                            isAIEnabled={false}
                            onToggleAI={() => { }}
                            isThinking={false}
                        />

                        <GameInfo
                            whitePlayer={gameDetails?.whitePlayer}
                            blackPlayer={gameDetails?.blackPlayer}
                            currentPlayer={gameState.currentPlayer}
                            whiteTime={gameDetails?.whiteTime}
                            blackTime={gameDetails?.blackTime}
                            isGameActive={gameDetails?.isGameActive}
                            winner={null}
                        />

                        <MoveHistory gameState={gameState} />

                        {/* Chat Section */}
                        <Card className="bg-white border-gray-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-gray-900">Game Chat</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[200px] mb-4">
                                    <div className="space-y-4 pr-4">
                                        {messages.map((msg, index) => (
                                            <div key={index} className={`flex ${msg.senderId === user?.id ? 'justify-end' : ''}`}>
                                                <div className={`max-w-[80%] p-3 rounded-lg ${msg.senderId === user?.id
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-100 text-gray-900'
                                                    }`}>
                                                    <div className="text-xs font-medium mb-1">
                                                        {msg.senderId === user?.id ? 'Bạn' : 'Đối thủ'}
                                                    </div>
                                                    <p className="break-words">{msg.message}</p>
                                                    <div className="text-xs opacity-70 mt-1">
                                                        {new Date(msg.timestamp).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>
                                </ScrollArea>
                                <form onSubmit={handleSendMessage} className="flex gap-2">
                                    <Textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Nhập tin nhắn..."
                                        onKeyDown={handleKeyPress}
                                        className="min-h-[80px] bg-gray-50 border-gray-200 text-gray-900"
                                    />
                                    <Button
                                        type="submit"
                                        disabled={!message.trim()}
                                        className="self-end"
                                    >
                                        Gửi
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>

            {/* Resign confirmation dialog */}
            <Dialog open={showResignDialog} onOpenChange={setShowResignDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Đầu hàng</DialogTitle>
                        <DialogDescription>
                            Bạn có chắc chắn muốn đầu hàng? Hành động này không thể hoàn tác.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowResignDialog(false)}>
                            Hủy
                        </Button>
                        <Button variant="destructive" onClick={handleResign}>
                            Đầu hàng
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
