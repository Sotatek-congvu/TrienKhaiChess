import { FC } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GameState, PieceColor } from '@/lib/chess-models';

export interface GameControlsProps {
  gameState: GameState;
  onNewGame: () => void;
  onUndo: () => void;
  onReset: () => void;
  onDrawOffer: () => Promise<boolean>;
  onResign: () => Promise<void>;
  isGameActive: boolean;
  isPlayerTurn: boolean;
  canUndo: boolean;
  isAIEnabled: boolean;
  onToggleAI: () => void;
  isThinking: boolean;
  onReady?: () => void;
  isReady?: boolean;
}

const GameControls: FC<GameControlsProps> = ({
  gameState,
  onNewGame,
  onUndo,
  onReset,
  onDrawOffer,
  onResign,
  isGameActive,
  isPlayerTurn,
  canUndo,
  isAIEnabled,
  onToggleAI,
  isThinking,
  onReady,
  isReady
}) => {
  const { currentPlayer, isCheckmate, isStalemate } = gameState;
  const gameOver = isCheckmate || isStalemate;
  const { toast } = useToast();

  const playerToMove = currentPlayer === PieceColor.WHITE ? 'White' : 'Black';

  const handleDrawOffer = () => {
    onDrawOffer();
    toast({
      title: "Đề nghị hòa",
      description: "Đã gửi đề nghị hòa đến đối thủ",
    });
  };

  const handleResign = () => {
    onResign();
    toast({
      title: "Đầu hàng",
      description: "Bạn đã đầu hàng",
      variant: "destructive",
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="font-medium">Trạng thái</h3>
        <div className="text-sm">
          {gameOver ? (
            <p className="text-red-500">
              {isCheckmate ? 'Chiếu hết!' : 'Hòa cờ!'}
            </p>
          ) : (
            <p>
              Lượt đi: <span className="font-medium">{playerToMove}</span>
              {isThinking && ' (AI đang suy nghĩ...)'}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="ai-mode">Chế độ AI</Label>
          <Switch
            id="ai-mode"
            checked={isAIEnabled}
            onCheckedChange={onToggleAI}
            disabled={isThinking}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Điều khiển</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={onUndo}
            disabled={!isGameActive || !isPlayerTurn || !canUndo}
          >
            Đi lại
          </Button>
          <Button
            variant="outline"
            onClick={onReset}
            disabled={!isGameActive}
          >
            Chơi lại
          </Button>
          <Button
            variant="outline"
            onClick={handleDrawOffer}
            disabled={!isGameActive || !isPlayerTurn}
          >
            Đề nghị hòa
          </Button>
          <Button
            variant="destructive"
            onClick={handleResign}
            disabled={!isGameActive}
          >
            Đầu hàng
          </Button>
        </div>
      </div>

      {onReady && (
        <div className="space-y-2">
          <Button
            variant={isReady ? "default" : "outline"}
            onClick={onReady}
            className="w-full"
            disabled={isThinking}
          >
            {isReady ? 'Hủy sẵn sàng' : 'Sẵn sàng'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default GameControls;
