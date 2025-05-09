import { FC } from 'react';
import { GameState, Move, PieceColor, Position } from '@/lib/chess-models';
import { cn } from '@/lib/utils';

export interface GameBoardProps {
    gameState: GameState;
    selectedSquare: Position | null;
    validMoves: Move[];
    onSquareClick: (position: Position) => void;
    isFlipped: boolean;
    lastMove: Move | null;
    isCheck: boolean;
    className?: string;
}

const GameBoard: FC<GameBoardProps> = ({
    gameState,
    selectedSquare,
    validMoves,
    onSquareClick,
    isFlipped,
    lastMove,
    isCheck,
    className
}) => {
    const { board } = gameState;

    const getSquareColor = (row: number, col: number): string => {
        const isLightSquare = (row + col) % 2 === 0;
        return isLightSquare ? 'bg-board-light' : 'bg-board-dark';
    };

    const isValidMove = (row: number, col: number): boolean => {
        return validMoves.some(move => move.to.row === row && move.to.col === col);
    };

    const isLastMove = (row: number, col: number): boolean => {
        if (!lastMove) return false;
        return (
            (row === lastMove.from.row && col === lastMove.from.col) ||
            (row === lastMove.to.row && col === lastMove.to.col)
        );
    };

    const isKingInCheck = (row: number, col: number): boolean => {
        const piece = board[row][col];
        return isCheck && piece?.type === 'king' && piece.color === gameState.currentPlayer;
    };

    const renderSquare = (row: number, col: number) => {
        const piece = board[row][col];
        const isSelected = selectedSquare?.row === row && selectedSquare?.col === col;
        const isValidMoveSquare = isValidMove(row, col);
        const isLastMoveSquare = isLastMove(row, col);
        const isCheckSquare = isKingInCheck(row, col);

        const displayRow = isFlipped ? 7 - row : row;
        const displayCol = isFlipped ? 7 - col : col;

        return (
            <div
                key={`${row}-${col}`}
                className={cn(
                    'relative w-full pb-[100%]',
                    getSquareColor(row, col),
                    isSelected && 'ring-2 ring-yellow-400',
                    isLastMoveSquare && 'ring-2 ring-blue-400',
                    isCheckSquare && 'ring-2 ring-red-500'
                )}
                onClick={() => onSquareClick({ row, col })}
            >
                <div className="absolute inset-0 flex items-center justify-center">
                    {piece && (
                        <img
                            src={`/pieces/${piece.color.toLowerCase()}_${piece.type.toLowerCase()}.svg`}
                            alt={`${piece.color} ${piece.type}`}
                            className="w-full h-full p-1"
                            draggable={false}
                        />
                    )}
                    {isValidMoveSquare && !piece && (
                        <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                    )}
                    {isValidMoveSquare && piece && (
                        <div className="absolute inset-0 ring-2 ring-yellow-400 rounded-sm" />
                    )}
                </div>
                {/* Coordinates */}
                {col === 0 && (
                    <div className="absolute left-0 top-0 text-xs p-0.5">
                        {8 - displayRow}
                    </div>
                )}
                {row === 7 && (
                    <div className="absolute right-0 bottom-0 text-xs p-0.5">
                        {String.fromCharCode(97 + displayCol)}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={cn("aspect-square", className)}>
            <div className="grid grid-cols-8 h-full border border-gray-700">
                {Array.from({ length: 8 }, (_, row) =>
                    Array.from({ length: 8 }, (_, col) => renderSquare(row, col))
                )}
            </div>
        </div>
    );
};

export default GameBoard; 