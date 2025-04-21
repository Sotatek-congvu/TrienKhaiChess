import { useEffect, useState } from 'react';
import { GameState, PieceColor } from '@/lib/chess-models';
import ChessBoard from '@/components/ChessBoard';
import GameControls from '@/components/GameControls';
import MoveHistory from '@/components/MoveHistory';
import GameInfo from '@/components/GameInfo';
import GameRules from '@/components/GameRules';
import { useStockfish } from '@/hooks/use-stockfish';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle, Cpu } from 'lucide-react';
import { toast } from "sonner";
import {
  createInitialGameState
} from '@/lib/chess-models';
import { motion, AnimatePresence } from 'framer-motion';

const Index = () => {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState());
  const [boardPerspective, setBoardPerspective] = useState<PieceColor>(PieceColor.WHITE);
  const [gameStateHistory, setGameStateHistory] = useState<GameState[]>([createInitialGameState()]);
  const [showRules, setShowRules] = useState<boolean>(true);
  const [playAgainstAI, setPlayAgainstAI] = useState<boolean>(true); // Mặc định bật AI

  // Sử dụng hook Stockfish - đã được cập nhật để luôn sử dụng chế độ khó nhất
  const { isThinking, makeMove: makeMoveAI } = useStockfish({
    enabled: playAgainstAI,
    aiColor: PieceColor.BLACK,
    onAIMove: (newState) => {
      setGameState(newState);
      setGameStateHistory(prev => [...prev, newState]);

      if (newState.isCheckmate) {
        toast.success("AI Lỏ đã chiếu hết bạn!", {
          description: "Thật tiếc! Thử lại nước nữa nhé?",
          duration: 5000,
        });
      } else if (newState.isCheck) {
        toast.warning("Chiếu!", {
          description: "Vua của bạn đang bị đe dọa!",
        });
      }
    }
  });

  // Kích hoạt AI khi trang được khởi tạo
  useEffect(() => {
    // Nếu lượt hiện tại là của AI (đen), cho AI đi
    if (playAgainstAI && gameState.currentPlayer === PieceColor.BLACK) {
      console.log("Lượt hiện tại là của đen, gọi AI đi...");
      setTimeout(() => {
        makeMoveAI(gameState);
      }, 500);
    }
  }, []);

  const toggleAI = useCallback((enabled: boolean) => {
    console.log("Bật/tắt AI:", enabled);
    setPlayAgainstAI(enabled);

    // Thông báo khi bật/tắt AI
    if (enabled) {
      toast.info("Đã bật AI Lỏ", {
        description: "AI đang sử dụng chế độ thông minh nhất"
      });

      // Nếu bật AI và lượt hiện tại là của AI (đen)
      if (gameState.currentPlayer === PieceColor.BLACK) {
        console.log("Lượt hiện tại là của đen, gọi AI đi...");
        makeMoveAI(gameState);
      }
    } else {
      toast.info("Đã tắt AI");
    }
  }, [gameState, makeMoveAI]);

  // Xử lý nước đi của người chơi
  const handleMove = useCallback((newState: GameState) => {
    setGameState(newState);
    setGameStateHistory(prev => [...prev, newState]);

    // Thông báo khi chiếu hoặc chiếu hết
    if (newState.isCheckmate) {
      const winner = newState.currentPlayer === PieceColor.WHITE ? "Đen" : "Trắng";
      toast.success(`Chiếu hết! ${winner} thắng!`, { duration: 5000 });
    } else if (newState.isCheck) {
      toast.warning("Chiếu!");
    }

    console.log("Sau khi người chơi đi, lượt hiện tại:", newState.currentPlayer);

    // Nếu đang chơi với AI và đến lượt AI
    if (playAgainstAI && newState.currentPlayer === PieceColor.BLACK && !newState.isCheckmate && !newState.isStalemate) {
      console.log("Đến lượt AI đi...");

      // Thêm thời gian trễ trước khi AI di chuyển
      toast.info("AI Lỏ đang suy nghĩ...", { duration: 1500 });

      setTimeout(() => {
        makeMoveAI(newState);
      }, 1500); // Đợi 1.5 giây trước khi AI thực hiện nước đi
    }
  }, [playAgainstAI, makeMoveAI]);

  const handleNewGame = useCallback(() => {
    const initialState = createInitialGameState();
    setGameState(initialState);
    setGameStateHistory([initialState]);

    toast.info("Trò chơi mới đã bắt đầu!");

    if (playAgainstAI && initialState.currentPlayer === PieceColor.BLACK) {
      // Cho AI đi sau một chút để người chơi thấy bàn cờ mới
      setTimeout(() => {
        makeMoveAI(initialState);
      }, 500);
    }
  }, [playAgainstAI, makeMoveAI]);

  const handleFlipBoard = useCallback(() => {
    setBoardPerspective(prev =>
      prev === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE
    );
  }, []);

  const handleUndoMove = useCallback(() => {
    if (gameStateHistory.length <= 1) return;

    const previousStates = [...gameStateHistory];

    // Nếu đang chơi với AI, cần undo 2 nước (người chơi và AI)
    const stepsToUndo = playAgainstAI ? 2 : 1;

    // Đảm bảo có đủ lịch sử để undo
    const newLength = Math.max(1, previousStates.length - stepsToUndo);
    const trimmedStates = previousStates.slice(0, newLength);

    const previousState = trimmedStates[trimmedStates.length - 1];
    setGameState(previousState);
    setGameStateHistory(trimmedStates);

    toast.info("Đã đi lại nước trước");
  }, [gameStateHistory, playAgainstAI]);

  return (
    <div className="min-h-screen bg-[#312e2b] text-white p-4">
      <div className="max-w-5xl mx-auto">
        <motion.header
          className="text-center mb-4 relative"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Chessmihouse 6×6
          </h1>
          <p className="text-gray-400 text-sm">
            Cờ vua 6x6 với luật Crazyhouse - thả quân đã bắt
          </p>

          <div className="absolute right-0 top-0 flex items-center gap-2">
            <Button
              variant={playAgainstAI ? "default" : "outline"}
              size="sm"
              className="flex items-center gap-1"
              onClick={() => toggleAI(!playAgainstAI)}
            >
              <Cpu size={16} />
              {playAgainstAI ? "Tắt AI" : "Bật AI"}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-gray-300 hover:text-white hover:bg-gray-700"
              onClick={() => setShowRules(true)}
            >
              <HelpCircle size={20} />
            </Button>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <ChessBoard
              gameState={gameState}
              onMove={handleMove}
              perspective={boardPerspective}
              onNewGame={handleNewGame}
              disabled={isThinking} // Vô hiệu hóa bàn cờ khi AI đang suy nghĩ
            />
          </motion.div>

          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <GameControls
              gameState={gameState}
              onNewGame={handleNewGame}
              onFlipBoard={handleFlipBoard}
              onUndoMove={handleUndoMove}
              aiMode={playAgainstAI}
              onToggleAI={toggleAI}
              isThinking={isThinking}
            />

            <GameInfo gameState={gameState} />

            <MoveHistory gameState={gameState} />
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {showRules && <GameRules onClose={() => setShowRules(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default Index;
