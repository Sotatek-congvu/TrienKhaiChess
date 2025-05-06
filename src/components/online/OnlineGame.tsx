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

    // Use useOnlineGame hook to connect to the game
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

    // Auto scroll messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Format time
    const formatTime = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    // Handle piece move
    const handleMove = (from: Position, to: Position) => {
        if (!isMyTurn || !playerColor) {
            toast.error('Not your turn');
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

    // Handle piece drop from bank
    const handlePieceDrop = (pieceType: any, position: Position) => {
        if (!isMyTurn || !playerColor) {
            toast.error('Not your turn');
            return;
        }

        dropPiece(pieceType, position);
    };

    // Handle sending message
    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        sendMessage(message);
        setMessage('');
    };

    // Handle copying game ID
    const handleCopyGameId = () => {
        if (gameId) {
            navigator.clipboard.writeText(gameId);
            toast.success('Game ID copied to clipboard');
        }
    };

    // Handle resignation
    const handleResign = async () => {
        setShowResignDialog(false);
        const success = await resignGame();
        if (success) {
            toast.info('You have resigned');
        }
    };

    // Show loading if not logged in
    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <p className="text-xl mb-4">Please log in to play online</p>
                <Button onClick={() => navigate('/auth')}>
                    Log In / Sign Up
                </Button>
            </div>
        );
    }

    // Show loading spinner
    if (isLoading) {
        return (
            <div className="container mx-auto py-8 max-w-6xl">
                <div className="flex justify-center items-center h-96">
                    <div className="text-center">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                        <p className="text-lg">Loading game...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-4 max-w-6xl">
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left column - Chess Board */}
                <div className="w-full lg:w-2/3">
                    {/* Game Header */}
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-2xl font-bold">Online Game</h2>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>ID: {gameId?.substring(0, 8)}...</span>
                                <button
                                    className="hover:text-primary"
                                    onClick={handleCopyGameId}
                                    title="Copy Game ID"
                                >
                                    <CopyIcon className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Game Actions */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="hidden md:flex"
                                onClick={() => handleDraw()}
                                disabled={!!gameResult || !gameDetails?.status || gameDetails.status !== 'active'}
                                title="Offer/Accept Draw"
                            >
                                <HandshakeIcon className="h-4 w-4 mr-2" />
                                {gameDetails?.draw_offered_by && gameDetails.draw_offered_by !== user?.id
                                    ? 'Accept Draw'
                                    : 'Offer Draw'}
                            </Button>

                            <Button
                                variant="destructive"
                                size="sm"
                                className="hidden md:flex"
                                onClick={() => setShowResignDialog(true)}
                                disabled={!!gameResult || !gameDetails?.status || gameDetails.status !== 'active'}
                            >
                                <Flag className="h-4 w-4 mr-2" />
                                Resign
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/lobby')}
                            >
                                Back to Lobby
                            </Button>
                        </div>
                    </div>

                    {/* Rest of the component remains the same... */}
                    {/* (keeping the rest of the existing implementation) */}
                </div>
            </div>
        </div>
    );
}