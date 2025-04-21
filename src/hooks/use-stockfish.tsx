import { useEffect, useState, useCallback } from 'react';
import { GameState, PieceColor } from '@/lib/chess-models';
import { getStockfishService } from '@/lib/stockfish-service';

interface UseStockfishProps {
    enabled: boolean;
    aiColor: PieceColor;
    onAIMove: (newState: GameState) => void;
}

export const useStockfish = ({ enabled, aiColor, onAIMove }: UseStockfishProps) => {
    const [isThinking, setIsThinking] = useState(false);
    const [thinkingTimeout, setThinkingTimeout] = useState<NodeJS.Timeout | null>(null);

    // Tối ưu: Giảm thời gian chờ tối đa xuống 2 giây
    const MAX_THINKING_TIME = 2000;

    // Giữ tham chiếu đến service
    const stockfishService = getStockfishService();

    // Tối ưu: Thêm cơ chế timeout để tránh chờ quá lâu
    const getAIMove = useCallback(
        async (gameState: GameState): Promise<GameState> => {
            try {
                setIsThinking(true);

                // Thiết lập timeout để tránh treo giao diện
                const timeoutPromise = new Promise<GameState>((resolve) => {
                    const timer = setTimeout(() => {
                        console.warn('AI thinking timeout reached, returning current best move');
                        resolve(gameState);
                    }, MAX_THINKING_TIME);

                    setThinkingTimeout(timer);
                });

                // Chạy AI trong một Promise
                const aiMovePromise = stockfishService.makeMove(gameState);

                // Đợi AI hoặc timeout, cái nào đến trước
                const result = await Promise.race([aiMovePromise, timeoutPromise]);
                return result || gameState;
            } catch (error) {
                console.error('Error getting AI move:', error);
                return gameState;
            } finally {
                // Xóa timeout nếu có
                if (thinkingTimeout) {
                    clearTimeout(thinkingTimeout);
                    setThinkingTimeout(null);
                }
                setIsThinking(false);
            }
        },
        [thinkingTimeout, stockfishService]
    );

    // Thêm makeMove function để phù hợp với cách gọi trong Index.tsx
    const makeMove = useCallback(
        async (gameState: GameState) => {
            if (!enabled || gameState.currentPlayer !== aiColor) {
                return;
            }

            try {
                const newState = await getAIMove(gameState);
                if (newState) {
                    onAIMove(newState);
                }
            } catch (error) {
                console.error('Error in makeMove:', error);
            }
        },
        [enabled, aiColor, getAIMove, onAIMove]
    );

    // Hàm hủy bỏ Stockfish khi component unmount
    useEffect(() => {
        const service = getStockfishService();

        // Thiết lập chế độ sử dụng bản đồ chuyển đổi 6x6->8x8
        service.setUseAdaptedBoard(true);

        // Thiết lập độ khó cao nhất với cài đặt tốc độ tối ưu
        service.setMaxDifficulty();

        // Cấu hình ưu tiên sử dụng thả quân khi có thể
        service.setHybridMode(true);

        // Tùy chỉnh tỷ lệ thả quân cao hơn trong trò chơi
        service.setDropPreference('aggressive');

        return () => {
            // Xóa timeout nếu có
            if (thinkingTimeout) {
                clearTimeout(thinkingTimeout);
            }
            // Dừng engine khi unmount
            service.stop();
        };
    }, [thinkingTimeout]);

    return {
        isThinking,
        getAIMove,
        makeMove
    };
};