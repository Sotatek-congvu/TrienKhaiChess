import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOnlineGame } from '@/hooks/use-online-game';
import { useAuth } from '@/context/AuthContext';
import { PieceColor, Position, GameState } from '@/lib/chess-models';
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
import { Clock, MessageSquare, Flag, X, CopyIcon, HandshakeIcon, Loader2 } from 'lucide-react';

export default function OnlineGame() {
    const { gameId } = useParams<{ gameId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [message, setMessage] = useState('');
    const [showChatMobile, setShowChatMobile] = useState(false);
    const [showResignDialog, setShowResignDialog] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Sử dụng hook useOnlineGame để kết nối với trò chơi
    const {
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
        makeMove,
        dropPiece,
        sendMessage,
        resignGame,
        handleDraw
    } = useOnlineGame({ gameId });

    // Auto scroll tin nhắn
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Định dạng thời gian
    const formatTime = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    // Xử lý khi di chuyển quân cờ
    const handleMove = (from: Position, to: Position) => {
        if (!isMyTurn || !playerColor) {
            toast.error('Không phải lượt đi của bạn');
            return;
        }

        makeMove(from, to);
    };

    // Wrapper function to convert GameState-based moves to Position-based moves
    const handleGameStateMove = (newState: GameState) => {
        if (!newState.lastMove) return;

        if (newState.lastMove.isDropped) {
            // Handle piece drop
            if (newState.lastMove.piece && newState.lastMove.to) {
                handlePieceDrop(newState.lastMove.piece.type, newState.lastMove.to);
            }
        } else {
            // Handle regular move
            handleMove(newState.lastMove.from, newState.lastMove.to);
        }
    };

    // Xử lý khi thả quân từ bank 
    const handlePieceDrop = (pieceType: any, position: Position) => {
        if (!isMyTurn || !playerColor) {
            toast.error('Không phải lượt đi của bạn');
            return;
        }

        dropPiece(pieceType, position);
    };

    // Xử lý gửi tin nhắn
    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        sendMessage(message);
        setMessage('');
    };

    // Xử lý sao chép ID trò chơi
    const handleCopyGameId = () => {
        if (gameId) {
            navigator.clipboard.writeText(gameId);
            toast.success('Đã sao chép mã trận đấu vào clipboard');
        }
    };

    // Xử lý đầu hàng
    const handleResign = async () => {
        setShowResignDialog(false);
        const success = await resignGame();
        if (success) {
            toast.info('Bạn đã đầu hàng');
        }
    };

    // Hiển thị loading nếu đang tải
    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <p className="text-xl mb-4">Vui lòng đăng nhập để chơi trực tuyến</p>
                <Button onClick={() => navigate('/auth')}>
                    Đăng nhập / Đăng ký
                </Button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="container mx-auto py-8 max-w-6xl">
                <div className="flex justify-center items-center h-96">
                    <div className="text-center">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                        <p className="text-lg">Đang tải trận đấu...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-4 max-w-6xl">
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Cột bên trái - Bàn cờ */}
                <div className="w-full lg:w-2/3">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-2xl font-bold">Trận đấu trực tuyến</h2>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>ID: {gameId?.substring(0, 8)}...</span>
                                <button
                                    className="hover:text-primary"
                                    onClick={handleCopyGameId}
                                    title="Sao chép ID"
                                >
                                    <CopyIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="hidden md:flex"
                                onClick={() => handleDraw()}
                                disabled={!!gameResult || !gameDetails?.status || gameDetails.status !== 'active'}
                                title="Đề nghị/chấp nhận hòa"
                            >
                                <HandshakeIcon className="h-4 w-4 mr-2" />
                                {gameDetails?.draw_offered_by && gameDetails.draw_offered_by !== user?.id
                                    ? 'Chấp nhận hòa'
                                    : 'Đề nghị hòa'}
                            </Button>

                            <Button
                                variant="destructive"
                                size="sm"
                                className="hidden md:flex"
                                onClick={() => setShowResignDialog(true)}
                                disabled={!!gameResult || !gameDetails?.status || gameDetails.status !== 'active'}
                            >
                                <Flag className="h-4 w-4 mr-2" />
                                Đầu hàng
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/lobby')}
                            >
                                Quay lại sảnh
                            </Button>
                        </div>
                    </div>

                    {/* Thông tin người chơi phía trên */}
                    <div className="bg-muted rounded-t-lg p-3 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <Avatar>
                                <AvatarImage src={
                                    playerColor === PieceColor.BLACK
                                        ? opponent?.avatar_url
                                        : gameDetails?.black_player?.avatar_url
                                } />
                                <AvatarFallback>
                                    {playerColor === PieceColor.BLACK
                                        ? opponent?.display_name?.[0] || opponent?.username?.[0] || '?'
                                        : gameDetails?.black_player?.display_name?.[0] || gameDetails?.black_player?.username?.[0] || '?'}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium">
                                    {playerColor === PieceColor.BLACK
                                        ? opponent?.display_name || opponent?.username || 'Đối thủ'
                                        : gameDetails?.black_player?.display_name || gameDetails?.black_player?.username || 'Đang chờ...'}
                                </p>
                                {gameDetails?.status === 'waiting' && playerColor === PieceColor.WHITE && (
                                    <Badge variant="outline">Đang chờ đối thủ</Badge>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            <span className="text-xl font-mono">{formatTime(blackTime)}</span>
                        </div>
                    </div>

                    {/* Bàn cờ */}
                    <div className="w-full aspect-square">
                        <ChessBoard
                            gameState={gameState}
                            onMove={handleGameStateMove}
                            perspective={playerColor}
                            disabled={!isMyTurn || gameDetails?.status !== 'active'}
                            showCoordinates={true}
                        />
                    </div>

                    {/* Thông tin người chơi phía dưới */}
                    <div className="bg-muted rounded-b-lg p-3 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <Avatar>
                                <AvatarImage src={
                                    playerColor === PieceColor.WHITE
                                        ? gameDetails?.white_player?.avatar_url
                                        : gameDetails?.white_player?.avatar_url
                                } />
                                <AvatarFallback>
                                    {playerColor === PieceColor.WHITE
                                        ? gameDetails?.white_player?.display_name?.[0] || gameDetails?.white_player?.username?.[0] || '?'
                                        : gameDetails?.white_player?.display_name?.[0] || gameDetails?.white_player?.username?.[0] || '?'}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium">
                                    {playerColor === PieceColor.WHITE
                                        ? gameDetails?.white_player?.display_name || gameDetails?.white_player?.username || 'Bạn'
                                        : gameDetails?.white_player?.display_name || gameDetails?.white_player?.username || 'Đối thủ'}
                                </p>
                                {isMyTurn && gameDetails?.status === 'active' && (
                                    <Badge>Lượt của bạn</Badge>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            <span className="text-xl font-mono">{formatTime(whiteTime)}</span>
                        </div>
                    </div>

                    {/* Nút mobile */}
                    <div className="mt-4 flex gap-2 md:hidden">
                        <Button
                            variant="outline"
                            onClick={() => setShowChatMobile(!showChatMobile)}
                            className="flex-1"
                        >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Chat
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() => handleDraw()}
                            disabled={!!gameResult || !gameDetails?.status || gameDetails.status !== 'active'}
                            className="flex-1"
                        >
                            <HandshakeIcon className="h-4 w-4 mr-2" />
                            {gameDetails?.draw_offered_by && gameDetails.draw_offered_by !== user?.id
                                ? 'Chấp nhận'
                                : 'Hòa'}
                        </Button>

                        <Button
                            variant="destructive"
                            onClick={() => setShowResignDialog(true)}
                            disabled={!!gameResult || !gameDetails?.status || gameDetails.status !== 'active'}
                            className="flex-1"
                        >
                            <Flag className="h-4 w-4 mr-2" />
                            Đầu hàng
                        </Button>
                    </div>

                    {/* Hiển thị kết quả trận đấu */}
                    {gameResult && (
                        <Card className="mt-4">
                            <CardHeader>
                                <CardTitle className="text-center">
                                    {gameResult.winner === user?.id
                                        ? 'Bạn đã thắng!'
                                        : gameResult.winner
                                            ? 'Bạn đã thua!'
                                            : 'Trận đấu hòa!'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-center text-muted-foreground">
                                    {gameResult.reason === 'checkmate'
                                        ? 'Chiếu bí'
                                        : gameResult.reason === 'stalemate'
                                            ? 'Bế tắc'
                                            : gameResult.reason === 'resignation'
                                                ? 'Đầu hàng'
                                                : 'Hòa cờ'}
                                </p>
                                <div className="mt-4 flex justify-center gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => navigate('/lobby')}
                                    >
                                        Quay lại sảnh
                                    </Button>
                                    {/* Có thể thêm nút phân tích trận đấu sau này */}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Cột bên phải - Chat */}
                <div className={`w-full lg:w-1/3 ${showChatMobile ? '' : 'hidden lg:block'}`}>
                    <Card className="h-full">
                        <CardHeader className="flex flex-row items-center justify-between py-3">
                            <CardTitle className="text-xl">Chat</CardTitle>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowChatMobile(false)}
                                className="lg:hidden"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="flex flex-col h-[500px]">
                                {/* Tin nhắn */}
                                <ScrollArea className="flex-grow px-4 py-2">
                                    {messages.length > 0 ? (
                                        <div className="space-y-4">
                                            {messages.map((msg) => (
                                                <div key={msg.id} className={`flex ${msg.user_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`flex ${msg.user_id === user?.id ? 'flex-row-reverse' : 'flex-row'} items-start gap-2 max-w-[80%]`}>
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={msg.avatar_url} />
                                                            <AvatarFallback>{msg.username?.[0] || '?'}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className={`rounded-lg px-3 py-2 ${msg.user_id === user?.id
                                                                ? 'bg-primary text-primary-foreground'
                                                                : 'bg-muted'
                                                                }`}>
                                                                {msg.content}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {new Date(msg.created_at).toLocaleTimeString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <div ref={messagesEndRef} />
                                        </div>
                                    ) : (
                                        <div className="h-full flex items-center justify-center">
                                            <p className="text-muted-foreground text-center">
                                                Chưa có tin nhắn nào. <br />
                                                Hãy gửi lời chào đến đối thủ của bạn!
                                            </p>
                                        </div>
                                    )}
                                </ScrollArea>

                                {/* Nhập tin nhắn */}
                                <form onSubmit={handleSendMessage} className="p-3 border-t">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Nhập tin nhắn..."
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            disabled={!gameDetails || gameDetails.status === 'completed'}
                                        />
                                        <Button
                                            type="submit"
                                            disabled={!message.trim() || !gameDetails}
                                        >
                                            Gửi
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Dialog xác nhận đầu hàng */}
            <Dialog open={showResignDialog} onOpenChange={setShowResignDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Xác nhận đầu hàng</DialogTitle>
                        <DialogDescription>
                            Bạn có chắc chắn muốn đầu hàng? Đây là hành động không thể hoàn tác.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowResignDialog(false)}
                        >
                            Hủy
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleResign}
                        >
                            Đầu hàng
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}