import { FC } from 'react';
import { GameState, PieceColor, PieceType } from '@/lib/chess-models';
import { getPieceSymbol } from './ChessPiece';
import { cn } from '@/lib/utils';

export interface GameInfoProps {
  whitePlayer: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  } | null;
  blackPlayer: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  } | null;
  currentPlayer: PieceColor;
  whiteTime: number;
  blackTime: number;
  isGameActive: boolean;
  winner: string | null;
}

const GameInfo: FC<GameInfoProps> = ({
  whitePlayer,
  blackPlayer,
  currentPlayer,
  whiteTime,
  blackTime,
  isGameActive,
  winner
}) => {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${currentPlayer === PieceColor.WHITE ? 'bg-white' : 'bg-gray-400'}`} />
          <span className="font-medium">White: {whitePlayer?.displayName || 'Waiting...'}</span>
        </div>
        <span className="font-mono">{formatTime(whiteTime)}</span>
      </div>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${currentPlayer === PieceColor.BLACK ? 'bg-black' : 'bg-gray-400'}`} />
          <span className="font-medium">Black: {blackPlayer?.displayName || 'Waiting...'}</span>
        </div>
        <span className="font-mono">{formatTime(blackTime)}</span>
      </div>
      {winner && (
        <div className="text-center font-bold text-lg">
          {winner === 'draw' ? 'Game ended in a draw' : `${winner === whitePlayer?.id ? 'White' : 'Black'} wins!`}
        </div>
      )}
    </div>
  );
};

export default GameInfo;
