import { FC } from 'react';
import { Trophy, Crown, XCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PieceColor } from '@/lib/chess-models';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';

interface CheckmateModalProps {
  winner: PieceColor;
  onNewGame: () => void;
  onReview: () => void;
  open: boolean;
}

const CheckmateModal: FC<CheckmateModalProps> = ({ winner, onNewGame, onReview, open }) => {
  const winnerText = winner === PieceColor.WHITE ? "Trắng" : "Đen";

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 text-white max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <AlertDialogHeader className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Trophy className="text-yellow-400 h-10 w-10" />
              <AlertDialogTitle className="text-2xl font-bold text-center">
                Chiếu hết!
              </AlertDialogTitle>
              <Crown className="text-yellow-400 h-10 w-10" />
            </div>

            <AlertDialogDescription className="text-center text-lg text-gray-300">
              Người chơi quân <span className="font-bold text-xl">{winnerText}</span> đã thắng!
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex justify-center my-6">
            <motion.div
              className={`w-24 h-24 rounded-full flex items-center justify-center ${winner === PieceColor.WHITE ? 'bg-white text-black' : 'bg-black text-white border border-white'}`}
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            >
              <span className="text-5xl">♚</span>
            </motion.div>
          </div>

          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 justify-center">
            <AlertDialogAction asChild>
              <Button
                onClick={onReview}
                className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white py-2 rounded-lg shadow-lg"
              >
                <Eye className="mr-2 h-4 w-4" />
                Xem lại
              </Button>
            </AlertDialogAction>
            <AlertDialogAction asChild>
              <Button
                onClick={onNewGame}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-2 rounded-lg shadow-lg"
              >
                Chơi lại
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </motion.div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CheckmateModal;
