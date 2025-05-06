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
import { Clock, MessageSquare, Flag, X, CopyIcon, HandshakeIcon, Loader2, Download, Maximize2, Minimize2 } from 'lucide-react';
import GameAnalysis from '@/components/GameAnalysis';

export default function OnlineGame() {
    const { gameId } = useParams<{ gameId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [message, setMessage] = useState('');
    const [showChatMobile, setShowChatMobile] = useState(false);
    const [showResignDialog, setShowResignDialog] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [fullscreenAnalysis, setFullscreenAnalysis] = useState(false);
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

        const convertedFrom = { row: from.row, col: from.col };
        const convertedTo = { row: to.row, col: to.col };

        makeMove(convertedFrom, convertedTo);
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

    // Handle analysis view toggle
    const handleToggleAnalysis = () => {
        if (!showAnalysis) {
            setAnalysisLoading(true);
            // Simulate loading for analysis preparation
            setTimeout(() => {
                setAnalysisLoading(false);
            }, 1000);
        }
        setShowAnalysis(!showAnalysis);
    };

    // Download game PGN
    const handleDownloadPGN = () => {
        try {
            // Create a basic PGN format with game information
            const date = new Date().toISOString().split('T')[0].replace(/-/g, '.');
            const white = user?.user_metadata?.username || user?.email || 'White';
            const black = opponent?.username || 'Black';
            const result = gameResult ?
                gameResult.includes('White') ? '1-0' :
                    gameResult.includes('Black') ? '0-1' :
                        '1/2-1/2' : '*';

            // Create headers
            let pgn = `[Event "Online Chess Game"]\n`;
            pgn += `[Site "TinyChessVariant"]\n`;
            pgn += `[Date "${date}"]\n`;
            pgn += `[White "${playerColor === 'white' ? white : black}"]\n`;
            pgn += `[Black "${playerColor === 'white' ? black : white}"]\n`;
            pgn += `[Result "${result}"]\n`;
            if (gameDetails?.variant) {
                pgn += `[Variant "${gameDetails.variant}"]\n`;
            }
            pgn += `\n`;

            // Add moves (simplified approach - would need proper move notation conversion)
            const moveHistory = gameState.moveHistory.map((move, index) => {
                const moveNumber = Math.floor(index / 2) + 1;
                // Use type assertion to handle missing properties safely
                const notation = (move as any).notation || `${move.from.row}${move.from.col}-${move.to.row}${move.to.col}`;
                return index % 2 === 0 ? `${moveNumber}. ${notation}` : notation;
            }).join(' ');

            pgn += moveHistory + ` ${result}`;

            // Create and download file
            const blob = new Blob([pgn], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `game-${gameId}-${date}.pgn`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('Game PGN downloaded');
        } catch (error) {
            console.error('Failed to download PGN:', error);
            toast.error('Failed to download game PGN');
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

                    {/* Chess board section */}
                    <div className="relative mb-4">
                        {/* Opponent info */}
                        <div className="flex items-center justify-between mb-2 p-2 bg-secondary/30 rounded-md">
                            <div className="flex items-center gap-2">
                                <Avatar>
                                    <AvatarImage src={opponent?.avatar_url || ''} />
                                    <AvatarFallback>{opponent?.username?.substring(0, 2) || '??'}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium">{opponent?.username || 'Waiting for opponent...'}</p>
                                    {gameDetails?.variant && (
                                        <Badge variant="outline" className="text-xs">
                                            {gameDetails.variant}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span className="font-mono">
                                    {formatTime(playerColor === 'white' ? blackTime : whiteTime)}
                                </span>
                            </div>
                        </div>

                        {/* Chess board */}
                        <div className="aspect-square">
                            <ChessBoard
                                gameState={gameState}
                                perspective={playerColor === 'white' ? PieceColor.WHITE : PieceColor.BLACK}
                                onMove={handleGameStateMove}
                                disabled={!isMyTurn || !!gameResult}
                                showCoordinates={true}
                            />
                        </div>

                        {/* Current player info */}
                        <div className="flex items-center justify-between mt-2 p-2 bg-secondary/30 rounded-md">
                            <div className="flex items-center gap-2">
                                <Avatar>
                                    <AvatarImage src={user?.user_metadata?.avatar_url || ''} />
                                    <AvatarFallback>{user?.email?.substring(0, 2) || 'ME'}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium">{user?.user_metadata?.username || user?.email}</p>
                                    <Badge variant={isMyTurn ? "default" : "outline"} className="text-xs">
                                        {playerColor === 'white' ? 'White' : 'Black'}
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span className="font-mono">
                                    {formatTime(playerColor === 'white' ? whiteTime : blackTime)}
                                </span>
                            </div>
                        </div>

                        {/* Game result overlay */}
                        {gameResult && (
                            <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm rounded-lg">
                                <Card className="w-80">
                                    <CardHeader>
                                        <CardTitle>Game Over</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-lg font-bold text-center mb-2">{gameResult}</p>
                                        <div className="flex justify-center mt-4">
                                            <Button onClick={() => navigate('/lobby')}>
                                                Back to Lobby
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>

                    {/* Mobile game controls */}
                    <div className="flex md:hidden gap-2 mb-4">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setShowChatMobile(!showChatMobile)}
                        >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Chat
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleDraw()}
                            disabled={!!gameResult || !gameDetails?.status || gameDetails.status !== 'active'}
                        >
                            <HandshakeIcon className="h-4 w-4 mr-2" />
                            Draw
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1"
                            onClick={() => setShowResignDialog(true)}
                            disabled={!!gameResult || !gameDetails?.status || gameDetails.status !== 'active'}
                        >
                            <Flag className="h-4 w-4 mr-2" />
                            Resign
                        </Button>
                    </div>

                    {/* Game result and analysis */}
                    {gameResult && (
                        <Card className="mt-6">
                            <CardHeader>
                                <CardTitle>Game Finished: {gameResult}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="mb-4">This game has ended. You can review the moves or analyze the game.</p>
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={handleToggleAnalysis}
                                        disabled={analysisLoading}
                                    >
                                        {analysisLoading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Loading Analysis...
                                            </>
                                        ) : (
                                            showAnalysis ? 'Hide Analysis' : 'Show Analysis'
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleDownloadPGN}
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download PGN
                                    </Button>
                                    <Button onClick={() => navigate('/lobby')}>
                                        Back to Lobby
                                    </Button>
                                </div>

                                {showAnalysis && !analysisLoading && (
                                    <div className="mt-4">
                                        <div className="flex justify-end mb-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setFullscreenAnalysis(!fullscreenAnalysis)}
                                            >
                                                {fullscreenAnalysis ? (
                                                    <Minimize2 className="h-4 w-4" />
                                                ) : (
                                                    <Maximize2 className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                        <GameAnalysis
                                            gameState={gameState}
                                            moveHistory={gameState.moveHistory.map(move => ({
                                                from: move.from,
                                                to: move.to,
                                                notation: move.notation || `${move.from.row}${move.from.col}-${move.to.row}${move.to.col}`
                                            }))}
                                            playerColor={playerColor === 'white' ? PieceColor.WHITE : PieceColor.BLACK}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right column - Chat & Game Info */}
                <div className={`w-full lg:w-1/3 ${showChatMobile ? '' : 'hidden md:block'}`}>
                    <Card className="h-full">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-center">
                                <CardTitle>Game Chat</CardTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="md:hidden"
                                    onClick={() => setShowChatMobile(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col h-[calc(100%-4rem)]">
                            <ScrollArea className="flex-1 mb-4">
                                <div className="space-y-4 pr-4">
                                    {messages.map((msg, index) => (
                                        <div key={index} className={`flex ${msg.senderId === user?.id ? 'justify-end' : ''}`}>
                                            <div className={`max-w-[80%] p-3 rounded-lg ${msg.senderId === user?.id
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted'
                                                }`}>
                                                <div className="text-xs font-medium mb-1">
                                                    {msg.senderId === user?.id
                                                        ? 'You'
                                                        : opponent?.username || 'Opponent'}
                                                </div>
                                                <p>{msg.message}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            </ScrollArea>
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                <Input
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    disabled={!!gameResult}
                                />
                                <Button type="submit" disabled={!message.trim() || !!gameResult}>
                                    Send
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Resign confirmation dialog */}
            <Dialog open={showResignDialog} onOpenChange={setShowResignDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Resign Game</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to resign? This will count as a loss.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowResignDialog(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleResign}>
                            Resign
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Fullscreen analysis dialog */}
            <Dialog open={fullscreenAnalysis} onOpenChange={setFullscreenAnalysis}>
                <DialogContent className="max-w-4xl h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>Game Analysis</DialogTitle>
                        <DialogDescription>
                            Analyze your game with Stockfish engine evaluation
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto py-2">
                        <GameAnalysis
                            gameState={gameState}
                            moveHistory={gameState.moveHistory.map(move => ({
                                from: move.from,
                                to: move.to,
                                notation: move.notation || `${move.from.row}${move.from.col}-${move.to.row}${move.to.col}`
                            }))}
                            playerColor={playerColor === 'white' ? PieceColor.WHITE : PieceColor.BLACK}
                        />
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setFullscreenAnalysis(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}