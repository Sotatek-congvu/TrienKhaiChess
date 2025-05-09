import { FC } from 'react';
import { GameState, positionToAlgebraic } from '@/lib/chess-models';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface Move {
  from: { row: number; col: number };
  to: { row: number; col: number };
  piece: string;
  capturedPiece?: string;
  isCheck?: boolean;
  isCheckmate?: boolean;
}

export interface MoveHistoryProps {
  gameState: GameState;
}

const MoveHistory: FC<MoveHistoryProps> = ({ gameState }) => {
  const moves = gameState.moveHistory || [];

  return (
    <div className="space-y-2">
      <h3 className="font-medium">Lịch sử nước đi</h3>
      <div className="max-h-60 overflow-y-auto">
        {moves.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có nước đi nào</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {moves.map((move, index) => {
              const moveNumber = Math.floor(index / 2) + 1;
              const isWhiteMove = index % 2 === 0;
              const from = `${String.fromCharCode(97 + move.from.col)}${6 - move.from.row}`;
              const to = `${String.fromCharCode(97 + move.to.col)}${6 - move.to.row}`;
              const moveText = `${move.piece}${from}-${to}${move.isCheckmate ? '#' : move.isCheck ? '+' : ''}`;

              return (
                <div key={index} className="flex items-center gap-2">
                  {isWhiteMove && <span className="text-muted-foreground">{moveNumber}.</span>}
                  <span className={isWhiteMove ? 'text-white' : 'text-gray-400'}>
                    {moveText}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MoveHistory;
