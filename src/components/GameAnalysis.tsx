import { useState, useEffect } from 'react';
import { GameState, PieceColor, Position, Move, PieceType, ChessPiece } from '@/lib/chess-models';
import ChessBoard from './ChessBoard';
import MoveHistory from './MoveHistory';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useStockfish } from '@/hooks/use-stockfish';
import { getStockfishService } from '@/lib/chessengine/stockfish-service';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { makeMove } from '@/lib/chess-logic';

interface GameAnalysisProps {
    gameState: GameState;
    moveHistory: { from: Position; to: Position; notation: string }[];
    playerColor: PieceColor;
}

export default function GameAnalysis({ gameState: initialGameState, moveHistory, playerColor }: GameAnalysisProps) {
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
    const [displayState, setDisplayState] = useState<GameState>(initialGameState);
    const [evaluation, setEvaluation] = useState<string>('');

    // Initialize stockfish with dummy values since we're only using it for analysis
    const stockfish = useStockfish({
        enabled: false,
        aiColor: PieceColor.WHITE,
        onAIMove: () => { }
    });

    // Get stockfish service for position analysis
    const stockfishService = getStockfishService();

    const analyzePosition = async (state: GameState) => {
        try {
            // Since evaluatePosition doesn't exist, we'll use another method or set a placeholder
            // for now we'll just set a placeholder message
            setEvaluation('Evaluation not available in this version');
        } catch (error) {
            console.error('Error analyzing position:', error);
            setEvaluation('Analysis error');
        }
    };

    useEffect(() => {
        // When the component mounts, show the initial position
        setDisplayState(initialGameState);
    }, [initialGameState]);

    useEffect(() => {
        // Request engine analysis of the current position
        if (displayState) {
            analyzePosition(displayState);
        }
    }, [displayState]);

    // Helper function to replay moves on a game state
    const replayMoves = (startState: GameState, movesToReplay: { from: Position; to: Position }[]) => {
        let currentState = { ...startState };

        for (const move of movesToReplay) {
            const result = makeMove(currentState, move.from, move.to);
            // The makeMove function returns a GameState directly
            currentState = result;
        }

        return currentState;
    };

    const goToMove = (index: number) => {
        if (index < -1 || index >= moveHistory.length) return;

        // Reset to initial position
        let newState = { ...initialGameState };

        // Apply moves up to the selected index
        if (index >= 0) {
            newState = replayMoves(newState, moveHistory.slice(0, index + 1));
        }

        setDisplayState(newState);
        setCurrentMoveIndex(index);
    };

    const goToPrevMove = () => goToMove(currentMoveIndex - 1);
    const goToNextMove = () => goToMove(currentMoveIndex + 1);

    // Convert moveHistory to a format compatible with MoveHistory component
    const formattedGameState: GameState = {
        ...displayState,
        moveHistory: moveHistory.map((move, index) => ({
            from: move.from,
            to: move.to,
            notation: move.notation,
            isCheck: false,
            isCheckmate: false,
            capturedPiece: null,
            isPromotion: false,
            promoteTo: null,
            piece: {  // Add the required piece property with all required fields
                id: `piece-${index}`,  // Generate a unique id
                type: PieceType.PAWN,  // Use the PieceType enum instead of string
                color: index % 2 === 0 ? PieceColor.WHITE : PieceColor.BLACK,
                hasMoved: true  // Add the required hasMoved property
            }
        })) as unknown as Move[]
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Game Analysis</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <div className="aspect-square mb-4">
                            <ChessBoard
                                gameState={displayState}
                                onMove={() => { }}
                                perspective={playerColor}
                                disabled={true}
                            />
                        </div>
                        <div className="flex justify-between">
                            <Button
                                variant="outline"
                                onClick={goToPrevMove}
                                disabled={currentMoveIndex < 0}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                            </Button>
                            <Button
                                variant="outline"
                                onClick={goToNextMove}
                                disabled={currentMoveIndex >= moveHistory.length - 1}
                            >
                                Next <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <div>
                        <div className="mb-4">
                            <h3 className="text-lg font-medium mb-2">Evaluation</h3>
                            <div className="p-4 border rounded-md">
                                <p className="font-mono">{evaluation || 'Analyzing...'}</p>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-medium mb-2">Move History</h3>
                            <MoveHistory
                                gameState={formattedGameState}
                                onMoveClick={(index) => goToMove(index)}
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}