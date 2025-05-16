// Hàm tiện ích để chuyển đổi trạng thái game từ server sang client
import { GameState, PieceColor, PieceType } from './chess-models';

// Chuyển đổi loại quân cờ từ chuỗi sang enum
export const convertPieceType = (pieceType: string): PieceType => {
    switch (pieceType.toLowerCase()) {
        case 'pawn': return PieceType.PAWN;
        case 'rook': return PieceType.ROOK;
        case 'knight': return PieceType.KNIGHT;
        case 'bishop': return PieceType.BISHOP;
        case 'queen': return PieceType.QUEEN;
        case 'king': return PieceType.KING;
        default:
            console.error('Unknown piece type:', pieceType);
            return PieceType.PAWN; // default fallback
    }
};

// Chuyển đổi trạng thái game từ server sang client
export const convertGameState = (serverGameState: any): GameState => {
    if (!serverGameState) return null;

    try {
        // Chuyển đổi màu người chơi hiện tại
        const currentPlayer = serverGameState.currentPlayer === 'white'
            ? PieceColor.WHITE
            : PieceColor.BLACK;

        // Chuyển đổi bàn cờ
        const board = Array.isArray(serverGameState.board)
            ? serverGameState.board.map(row =>
                row.map(piece => {
                    if (!piece) return null;
                    return {
                        ...piece,
                        color: piece.color === 'white' ? PieceColor.WHITE : PieceColor.BLACK,
                        type: convertPieceType(piece.type)
                    };
                })
            )
            : Array(6).fill(null).map(() => Array(6).fill(null));

        // Chuyển đổi nước đi cuối cùng
        let lastMove = null;
        if (serverGameState.lastMove) {
            const { from, to, piece } = serverGameState.lastMove;
            lastMove = {
                from,
                to,
                piece: piece ? {
                    ...piece,
                    color: piece.color === 'white' ? PieceColor.WHITE : PieceColor.BLACK,
                    type: convertPieceType(piece.type)
                } : null
            };
        }

        // Chuyển đổi lịch sử nước đi
        const moveHistory = Array.isArray(serverGameState.moveHistory)
            ? serverGameState.moveHistory.map(move => ({
                ...move,
                piece: move.piece ? {
                    ...move.piece,
                    color: move.piece.color === 'white' ? PieceColor.WHITE : PieceColor.BLACK,
                    type: convertPieceType(move.piece.type)
                } : null
            }))
            : [];        // Trả về trạng thái game đã chuyển đổi
        return {
            board,
            currentPlayer,
            lastMove,
            moveHistory,
            isCheckmate: serverGameState.isCheckmate || false,
            isStalemate: serverGameState.isStalemate || false,
            isCheck: serverGameState.isCheck || false,
            selectedPiece: null,
            validMoves: [],
            pieceBank: {
                [PieceColor.WHITE]: serverGameState.capturedPieces?.white || [],
                [PieceColor.BLACK]: serverGameState.capturedPieces?.black || []
            }
        };
    } catch (error) {
        console.error('Error converting game state:', error);
        console.error('Server game state:', serverGameState);
        return null;
    }
};
