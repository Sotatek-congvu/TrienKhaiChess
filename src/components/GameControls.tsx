import { FC } from 'react';
import { Button } from '@/components/ui/button';
import { GameState, PieceColor } from '@/lib/chess-models';
import { RefreshCw, RotateCcw, Undo, ArrowDownUp, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface GameControlsProps {
  gameState: GameState;
  onNewGame: () => void;
  onFlipBoard: () => void;
  onUndoMove?: () => void;
  aiMode: boolean;
  onToggleAI: (enabled: boolean) => void;
  isThinking?: boolean;
  className?: string;
}

const GameControls: FC<GameControlsProps> = ({
  gameState,
  onNewGame,
  onFlipBoard,
  onUndoMove,
  aiMode,
  onToggleAI,
  isThinking = false,
  className
}) => {
  const { currentPlayer, isCheckmate, isStalemate } = gameState;
  const gameOver = isCheckmate || isStalemate;

  const playerToMove = currentPlayer === PieceColor.WHITE ? 'White' : 'Black';

  let statusText: string;

  if (isCheckmate) {
    const winner = currentPlayer === PieceColor.WHITE ? 'Black' : 'White';
    statusText = `Chiếu hết! ${winner} thắng`;
  } else if (isStalemate) {
    statusText = 'Hòa cờ! Trò chơi kết thúc';
  } else {
    statusText = `${playerToMove === 'White' ? 'Trắng' : 'Đen'} đi`;
    if (aiMode && currentPlayer === PieceColor.BLACK && isThinking) {
      statusText += ' (AI đang suy nghĩ...)';
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex justify-between items-center">
        <p className={cn(
          "text-sm font-medium",
          gameOver && "text-primary font-bold",
          isThinking && "animate-pulse"
        )}>
          {statusText}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onNewGame}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Trò chơi mới
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onFlipBoard}
        >
          <ArrowDownUp className="w-4 h-4 mr-2" />
          Lật bàn cờ
        </Button>

        {onUndoMove && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onUndoMove}
            disabled={gameState.moveHistory.length === 0 || isThinking}
          >
            <Undo className="w-4 h-4 mr-2" />
            Đi lại
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between p-3 mt-2 bg-gradient-to-r from-blue-700/50 to-blue-900/50 rounded-lg border border-blue-700/50">
        <div className="flex items-center">
          <Cpu className="w-5 h-5 mr-2 text-blue-400" />
          <Label htmlFor="ai-mode" className="font-bold text-blue-300">
            CHơi với AI Lỏ
          </Label>
        </div>

        <Switch
          id="ai-mode"
          checked={aiMode}
          onCheckedChange={onToggleAI}
          disabled={isThinking}
        />
      </div>
    </div>
  );
};

export default GameControls;
