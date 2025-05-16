import { FC, useState, useEffect, useRef } from 'react';
import ChessPiece from './ChessPiece';
import PieceBank from './PieceBank';
import CheckmateModal from './CheckmateModal';
import {
  ChessPiece as ChessPieceType,
  GameState,
  PieceColor,
  PieceType,
  Position,
  positionToAlgebraic
} from '@/lib/chess-models';
import { getValidMoves, makeMove, getValidDropSquares, dropPiece } from '@/lib/chess-logic';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAudio } from '@/hooks/use-audio'; // Thêm import useAudio

interface ChessBoardProps {
  gameState: GameState;
  onMove: (newState: GameState) => void;
  onPieceSelect?: (position: Position) => void;
  onSquareClick?: (position: Position) => void;
  perspective?: PieceColor;
  showCoordinates?: boolean;
  onNewGame?: () => void;
  disabled?: boolean;
}

const ChessBoard: FC<ChessBoardProps> = ({
  gameState,
  onMove,
  onPieceSelect,
  onSquareClick,
  perspective = PieceColor.WHITE,
  showCoordinates = false,
  onNewGame,
  disabled = false
}) => {
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [promotionPosition, setPromotionPosition] = useState<Position | null>(null);
  const [isDroppingPiece, setIsDroppingPiece] = useState<ChessPieceType | null>(null);
  const [dropHighlight, setDropHighlight] = useState<boolean>(false);
  const [showCheckmateModal, setShowCheckmateModal] = useState<boolean>(false);
  const { playSound, isMuted, toggleMute } = useAudio(); // Sử dụng hook useAudio

  // Tạo mảng các chỉ số hàng và cột theo thứ tự hiển thị trên bàn cờ
  const boardRows = [...Array(6).keys()];
  const boardCols = [...Array(6).keys()];

  // Khi góc nhìn là WHITE:
  // - Hàng 0 (trắng) ở dưới cùng, hàng 5 (đen) ở trên cùng
  // Khi góc nhìn là BLACK:
  // - Hàng 5 (đen) ở dưới cùng, hàng 0 (trắng) ở trên cùng

  // Đảo ngược hàng để hiển thị bàn cờ đúng với góc nhìn
  boardRows.reverse();

  // Đảo ngược cột chỉ khi góc nhìn là BLACK
  if (perspective === PieceColor.BLACK) {
    boardCols.reverse();
  }
  // Hàm chuyển đổi từ vị trí hiển thị sang vị trí thực tế trên bàn cờ
  const getBoardPosition = (displayRow: number, displayCol: number): Position => {
    let row, col;

    // Khi góc nhìn là WHITE:
    // - displayRow 0 (trên cùng) → boardRow 5 (hàng đen)
    // - displayRow 5 (dưới cùng) → boardRow 0 (hàng trắng)
    // Khi góc nhìn là BLACK:
    // - displayRow 0 (trên cùng) → boardRow 0 (hàng trắng)
    // - displayRow 5 (dưới cùng) → boardRow 5 (hàng đen)
    if (perspective === PieceColor.WHITE) {
      row = 5 - displayRow;
      col = displayCol;
    } else {
      row = displayRow;
      col = 5 - displayCol;
    }

    return { row, col };
  };

  // Chuyển đổi ngược lại từ vị trí thực tế sang vị trí hiển thị
  const getDisplayPosition = (boardRow: number, boardCol: number): Position => {
    let row, col;

    if (perspective === PieceColor.WHITE) {
      row = 5 - boardRow;
      col = boardCol;
    } else {
      row = boardRow;
      col = 5 - boardCol;
    }

    return { row, col };
  };

  // Hàm kiểm tra xem ô có màu sáng hay không
  const isLightSquare = (row: number, col: number) => (row + col) % 2 === 0;

  // Hàm lấy ký hiệu toạ độ của ô cờ
  const getSquareNotation = (row: number, col: number) => {
    const file = String.fromCharCode(97 + col);
    const rank = row + 1;
    return `${file}${rank}`;
  };

  // Hàm kiểm tra xem ô có phải là một phần của nước đi gần nhất không
  const isPartOfLastMove = (row: number, col: number) => {
    const { lastMove } = gameState;
    if (!lastMove) return false;

    return (
      (lastMove.from.row === row && lastMove.from.col === col) ||
      (lastMove.to.row === row && lastMove.to.col === col)
    );
  };

  // Hàm kiểm tra xem ô có đang bị chiếu không
  const isSquareInCheck = (row: number, col: number) => {
    const { board, isCheck } = gameState;
    const piece = board[row][col];

    return isCheck &&
      piece &&
      piece.type === PieceType.KING &&
      piece.color === gameState.currentPlayer;
  };

  useEffect(() => {
    setSelectedPosition(null);
    setValidMoves([]);
    setIsDroppingPiece(null);
  }, [gameState.currentPlayer]);

  useEffect(() => {
    if (gameState.isCheckmate) {
      const winner = gameState.currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;
      const winnerText = winner === PieceColor.WHITE ? "Trắng" : "Đen";

      toast.error(`Chiếu hết! Người chơi quân ${winnerText} đã thắng!`, {
        duration: 5000,
        position: "top-center",
      });

      setShowCheckmateModal(true);
    } else {
      setShowCheckmateModal(false);
    }
  }, [gameState.isCheckmate, gameState.currentPlayer]);

  // Thêm useEffect mới để phát âm thanh khi gameState thay đổi
  const lastPlayedMoveRef = useRef<string | null>(null);

  useEffect(() => {
    // Bỏ qua lần render đầu tiên
    if (!gameState.lastMove) return;

    // Tạo một key duy nhất cho mỗi nước đi
    const lastMoveKey = `${gameState.moveHistory.length}`;

    // Nếu đã phát âm thanh cho nước đi này rồi, không phát lại
    if (lastPlayedMoveRef.current === lastMoveKey) {
      return;
    }

    lastPlayedMoveRef.current = lastMoveKey;

    const { lastMove, isCheck, isCheckmate, isStalemate } = gameState;

    // Kiểm tra xem nước đi cuối cùng có phải là thả quân không
    if (lastMove.isDropped) {
      playSound('drop');
    } else {
      // Kiểm tra xem nước đi cuối cùng có phải là ăn quân không
      const isCapture = lastMove.capturedPiece !== null && lastMove.capturedPiece !== undefined;

      // Phát âm thanh dựa vào loại nước đi
      if (isCapture) {
        playSound('capture');
      } else {
        playSound('move');
      }
    }

    // Phát âm thanh cho các trạng thái đặc biệt
    if (isCheckmate) {
      playSound('checkmate');
    } else if (isCheck) {
      playSound('check');
    } else if (isStalemate) {
      playSound('gameOver');
    }
  }, [gameState.moveHistory.length, gameState.lastMove, playSound]);

  const handlePieceBankSelect = (piece: ChessPieceType) => {
    if (disabled) {
      return;
    }

    if (piece.color !== gameState.currentPlayer) {
      toast.error("Chỉ có thể thả quân trong lượt của bạn!", {
        duration: 3000,
        position: "top-center",
      });
      return;
    }

    // Không phát âm thanh ở đây, sẽ được xử lý trong useEffect
    setSelectedPosition(null);
    setIsDroppingPiece(piece);
    setDropHighlight(true);
    const validDropSquares = getValidDropSquares(gameState, piece);
    setValidMoves(validDropSquares);

    toast.info("Chọn ô để thả quân", {
      duration: 3000,
      position: "top-center",
    });
  };
  // Xử lý khi người dùng chọn một quân cờ
  const handlePieceSelect = (displayPosition: Position) => {
    if (disabled) {
      console.log('Board is disabled');
      return;
    }

    // Chuyển đổi vị trí hiển thị sang vị trí thực tế trên bàn cờ
    const position = getBoardPosition(displayPosition.row, displayPosition.col);

    console.log('Piece selected at position:', position);
    const piece = gameState.board[position.row][position.col];
    console.log('Selected piece:', piece);

    if (!piece || piece.color !== gameState.currentPlayer) {
      console.log('Invalid piece selection - no piece or wrong color');
      return;
    }

    // Gọi callback nếu được cung cấp
    if (onPieceSelect) {
      onPieceSelect(position);
    }

    setSelectedPosition(position);
    const moves = getValidMoves(gameState, position);
    console.log('Valid moves for selected piece:', moves);
    setValidMoves(moves);
  };
  // Xử lý khi người dùng click vào một ô
  const handleSquareClick = (displayPosition: Position) => {
    // Kiểm tra nếu bàn cờ bị vô hiệu hóa trước khi xử lý
    if (disabled) {
      console.log('Board is disabled, ignoring click');
      return;
    }

    // Chuyển đổi vị trí hiển thị sang vị trí thực tế trên bàn cờ
    const position = getBoardPosition(displayPosition.row, displayPosition.col);

    console.log('Square clicked:', position);
    console.log('Current player:', gameState.currentPlayer);
    console.log('Disabled status:', disabled);

    // Gọi callback nếu được cung cấp
    if (onSquareClick) {
      onSquareClick(position);
      // Nếu có callback, để callback xử lý logic
      return;
    }

    const piece = gameState.board[position.row][position.col];
    console.log('Piece at position:', piece);

    // If a piece is being dropped
    if (isDroppingPiece) {
      console.log('Currently dropping piece:', isDroppingPiece);
      if (validMoves.some(move => move.row === position.row && move.col === position.col)) {
        console.log('Valid drop position');
        const newState = dropPiece(gameState, isDroppingPiece, position);
        onMove(newState);

        // Âm thanh sẽ được xử lý trong useEffect
        if (newState.isCheckmate) {
          const winner = gameState.currentPlayer;
          const winnerText = winner === PieceColor.WHITE ? "Trắng" : "Đen";
          toast.success(`Chiếu hết! ${winnerText} thắng!`);
        } else if (newState.isCheck) {
          toast.warning('Chiếu!');
        }
      } else {
        console.log('Invalid drop position');
        toast.error('Invalid drop position');
      }
      setIsDroppingPiece(null);
      setValidMoves([]);
      setDropHighlight(false);
      return;
    }

    // If a piece is already selected
    if (selectedPosition) {
      console.log('Piece already selected at:', selectedPosition);
      // If clicking the same piece, deselect it
      if (selectedPosition.row === position.row && selectedPosition.col === position.col) {
        console.log('Deselecting piece');
        setSelectedPosition(null);
        setValidMoves([]);
        return;
      }

      // If clicking a valid move square
      if (validMoves.some(move => move.row === position.row && move.col === position.col)) {
        console.log('Moving piece to:', position);
        const newState = makeMove(gameState, selectedPosition, position);
        onMove(newState);
        // Việc phát âm thanh sẽ được xử lý trong useEffect

        setSelectedPosition(null);
        setValidMoves([]);
        return;
      }

      // If clicking another piece of the same color, select it instead
      if (piece && piece.color === gameState.currentPlayer) {
        console.log('Selecting new piece');
        setSelectedPosition(position);
        const moves = getValidMoves(gameState, position);
        console.log('Valid moves for new piece:', moves);
        setValidMoves(moves);
        return;
      }

      // Invalid move
      console.log('Invalid move');
      toast.error('Invalid move');
      return;
    }

    // If no piece is selected, try to select one
    if (piece && piece.color === gameState.currentPlayer) {
      console.log('Selecting piece');
      setSelectedPosition(position);
      const moves = getValidMoves(gameState, position);
      console.log('Valid moves:', moves);
      setValidMoves(moves);
    } else if (piece) {
      console.log('Cannot select opponent\'s piece');
      toast.error('Cannot select opponent\'s piece');
    }
  };

  const handlePromotion = (promoteTo: PieceType) => {
    if (!selectedPosition || !promotionPosition) return;

    const newState = makeMove(gameState, selectedPosition, promotionPosition, promoteTo);
    onMove(newState);

    // Không phát âm thanh ở đây, sẽ được xử lý trong useEffect
    if (newState.isCheckmate) {
      const winner = gameState.currentPlayer === PieceColor.WHITE ? "Trắng" : "Đen";
      toast.success(`Chiếu hết! ${winner} thắng!`);
    } else if (newState.isCheck) {
      toast.warning('Chiếu!');
    }

    setSelectedPosition(null);
    setValidMoves([]);
    setPromotionPosition(null);
  };

  const handleNewGame = () => {
    if (onNewGame) {
      onNewGame();
      setShowCheckmateModal(false);

      // Phát âm thanh khi bắt đầu trò chơi mới
      playSound('start');

      toast.success("Trò chơi mới đã bắt đầu!", {
        duration: 3000,
        position: "top-center",
      });
    }
  };

  const handleReviewBoard = () => {
    setShowCheckmateModal(false);

    toast.info("Hãy xem lại bàn cờ để hiểu tại sao bị chiếu hết!", {
      duration: 4000,
      position: "top-center",
    });
  };

  // Thêm hàm mới để đánh giá thả quân trực quan
  const getDropSquareHighlightClass = (position: Position): string => {
    if (!isDroppingPiece || !validMoves.some(move => move.row === position.row && move.col === position.col)) {
      return '';
    }

    // Phân loại các vị trí thả quân theo chất lượng
    const piece = isDroppingPiece;
    if (!piece) return 'drop-target'; // Class mặc định

    // Kiểm tra vị trí đặc biệt
    if (piece.type === PieceType.KNIGHT) {
      // Kiểm tra outpost cho mã
      const centerRows = piece.color === PieceColor.WHITE ? [3, 4] : [2, 1];
      const isCenterSquare = centerRows.includes(position.row) && position.col >= 1 && position.col <= 4;

      if (isCenterSquare) return 'drop-target-optimal';
    }

    // Kiểm tra vị trí để thả tốt phong cấp
    if (piece.type === PieceType.PAWN) {
      const promotionRow = piece.color === PieceColor.WHITE ? 4 : 1;
      if (position.row === promotionRow) {
        return 'drop-target-optimal';
      }
    }

    // Kiểm tra nếu là vị trí trung tâm
    const isCenter = (position.row === 2 || position.row === 3) && (position.col === 2 || position.col === 3);
    if (isCenter) return 'drop-target-good';

    return 'drop-target';
  };

  return (
    <div className="flex flex-col md:flex-row items-start gap-4">
      <div className="md:w-48 space-y-4">
        <PieceBank
          pieces={gameState.pieceBank[PieceColor.WHITE]}
          color={PieceColor.WHITE}
          onPieceSelect={handlePieceBankSelect}
          isActive={gameState.currentPlayer === PieceColor.WHITE}
          className="w-full"
        />
        <PieceBank
          pieces={gameState.pieceBank[PieceColor.BLACK]}
          color={PieceColor.BLACK}
          onPieceSelect={handlePieceBankSelect}
          isActive={gameState.currentPlayer === PieceColor.BLACK}
          className="w-full"
        />
      </div>      <div className={cn(
        "relative w-full max-w-md aspect-square rounded-lg overflow-hidden shadow-2xl bg-gradient-to-br from-gray-800 to-gray-900 p-2",
        dropHighlight && "ring-2 ring-yellow-400 ring-opacity-50"
      )}>
        <div className="w-full h-full grid grid-cols-6 grid-rows-6 relative">
          {boardRows.map((displayRowIndex, rowIdx) => (
            boardCols.map((displayColIndex, colIdx) => {
              // Chuyển đổi vị trí hiển thị sang vị trí thực tế trên bàn cờ
              const boardPosition = getBoardPosition(displayRowIndex, displayColIndex);

              // Lấy quân cờ và thông tin khác dựa trên vị trí thực tế
              const piece = gameState.board[boardPosition.row][boardPosition.col];
              const isValidMoveSquare = validMoves.some(
                move => move.row === boardPosition.row && move.col === boardPosition.col
              );
              const isSelected = selectedPosition?.row === boardPosition.row &&
                selectedPosition?.col === boardPosition.col;
              const isLastMoveSquare = isPartOfLastMove(boardPosition.row, boardPosition.col);
              const isCheckSquare = isSquareInCheck(boardPosition.row, boardPosition.col);

              // Debug
              console.log(`Rendering square: display(${displayRowIndex},${displayColIndex}) -> board(${boardPosition.row},${boardPosition.col})`);
              console.log(`Piece: ${piece?.color} ${piece?.type}, isValid: ${isValidMoveSquare}, isSelected: ${isSelected}`);

              // Sử dụng vị trí hiển thị cho key và để quyết định màu ô
              return (
                <div
                  key={`${displayRowIndex}-${displayColIndex}`}
                  className={cn(
                    "chess-square relative flex items-center justify-center",
                    isLightSquare(displayRowIndex, displayColIndex) ? "bg-board-light" : "bg-board-dark",
                    isLastMoveSquare && "last-move",
                    isCheckSquare && "check",
                    isValidMoveSquare && !isDroppingPiece && "valid-move",
                    isDroppingPiece && isValidMoveSquare && getDropSquareHighlightClass(boardPosition),
                    isSelected && "ring-2 ring-yellow-400"
                  )}
                  onClick={() => {
                    // Thêm debug để kiểm tra sự kiện click
                    console.log(`Clicked square: display(${displayRowIndex},${displayColIndex})`);
                    console.log(`Current player: ${gameState.currentPlayer}, disabled: ${disabled}`);

                    // Gọi handleSquareClick với vị trí hiển thị
                    handleSquareClick({ row: displayRowIndex, col: displayColIndex });
                  }}
                >
                  <AnimatePresence mode="wait">
                    {piece && (
                      <motion.div
                        key={`piece-${piece.id}-${boardPosition.row}-${boardPosition.col}`}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{
                          scale: 1,
                          opacity: 1,
                          y: isValidMoveSquare ? [0, -5, 0] : 0
                        }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChessPiece
                          piece={piece}
                          isSelected={isSelected}
                          className={cn(
                            "w-full h-full",
                            isSelected && "ring-2 ring-yellow-400"
                          )}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {isValidMoveSquare && !piece && (
                    <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                  )}
                  {isValidMoveSquare && piece && (
                    <div className="absolute inset-0 ring-2 ring-yellow-400 rounded-sm" />
                  )}
                  {showCoordinates && (
                    <div className="absolute bottom-0 right-0 text-xs text-gray-400">
                      {getSquareNotation(boardPosition.row, boardPosition.col)}
                    </div>
                  )}
                </div>
              );
            })
          ))}
        </div>

        {isDroppingPiece && (
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
            Đang thả quân...
          </div>
        )}
      </div>

      {promotionPosition && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel p-6 rounded-xl"
          >
            <h3 className="text-lg font-semibold mb-4 text-center">
              Chọn quân phong cấp:
            </h3>
            <div className="flex gap-4 justify-center">
              {[PieceType.ROOK, PieceType.KNIGHT, PieceType.BISHOP].map((type) => (
                <button
                  key={type}
                  className="w-16 h-16 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors"
                  onClick={() => handlePromotion(type)}
                >
                  <ChessPiece
                    piece={{
                      id: `promotion-${type}`,
                      type,
                      color: gameState.currentPlayer,
                      hasMoved: true
                    }}
                    className="text-5xl"
                  />
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      <CheckmateModal
        winner={gameState.currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE}
        onNewGame={handleNewGame}
        onReview={handleReviewBoard}
        open={showCheckmateModal}
      />
    </div>
  );
};

export default ChessBoard;
