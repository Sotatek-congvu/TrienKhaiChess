import {
    GameState,
    PieceColor,
    PieceType,
    ChessPiece,
    Position
} from '@/lib/chess-models';
import {
    getValidMoves,
    makeMove,
    dropPiece,
    getValidDropSquares,
    isKingInCheck,
    checkIfCheckmate
} from '@/lib/chess-logic';

// Điểm số chi tiết và chiến lược cho từng loại quân
const PIECE_VALUES: Record<PieceType, number> = {
    [PieceType.KING]: 200,      // Giá trị cao để bảo vệ
    [PieceType.QUEEN]: 9,        // Quân mạnh nhất
    [PieceType.ROOK]: 5,         // Quân chủ chốt
    [PieceType.BISHOP]: 3,       // Quân chéo
    [PieceType.KNIGHT]: 3,       // Quân nhảy
    [PieceType.PAWN]: 1          // Quân yếu nhất
};

// Ma trận điểm vị trí (Piece-Square Tables)
const PIECE_SQUARE_TABLES: Record<PieceType, number[][]> = {
    [PieceType.KING]: [
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-20, -30, -30, -40, -40, -30, -30, -20],
        [-10, -20, -20, -20, -20, -20, -20, -10],
        [20, 10, 0, 0, 0, 0, 10, 20],
        [20, 30, 10, 0, 0, 10, 30, 20],
        [30, 40, 20, 0, 0, 20, 40, 30],
        [30, 40, 40, 50, 50, 40, 40, 30]
    ].slice(0, 6).map(row => row.slice(0, 6)),

    [PieceType.QUEEN]: [
        [-20, -10, -10, -5, -5, -10, -10, -20],
        [-10, 0, 0, 0, 0, 0, 0, -10],
        [-10, 0, 5, 5, 5, 5, 0, -10],
        [-5, 0, 5, 5, 5, 5, 0, -5],
        [0, 0, 5, 5, 5, 5, 0, -5],
        [-10, 5, 5, 5, 5, 5, 0, -10],
        [-10, 0, 5, 0, 0, 0, 0, -10],
        [-20, -10, -10, -5, -5, -10, -10, -20]
    ].slice(0, 6).map(row => row.slice(0, 6)),

    [PieceType.ROOK]: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [5, 10, 10, 10, 10, 10, 10, 5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5],
        [-5, 0, 0, 0, 0, 0, 0, -5]
    ].slice(0, 6).map(row => row.slice(0, 6)),

    [PieceType.BISHOP]: [
        [-20, -10, -10, -10, -10, -10, -10, -20],
        [-10, 0, 0, 0, 0, 0, 0, -10],
        [-10, 0, 5, 10, 10, 5, 0, -10],
        [-10, 5, 5, 10, 10, 5, 5, -10],
        [-10, 0, 10, 10, 10, 10, 0, -10],
        [-10, 10, 10, 10, 10, 10, 10, -10],
        [-10, 5, 0, 0, 0, 0, 5, -10],
        [-20, -10, -10, -10, -10, -10, -10, -20]
    ].slice(0, 6).map(row => row.slice(0, 6)),

    [PieceType.KNIGHT]: [
        [-50, -40, -30, -30, -30, -30, -40, -50],
        [-40, -20, 0, 0, 0, 0, -20, -40],
        [-30, 0, 10, 15, 15, 10, 0, -30],
        [-30, 5, 15, 20, 20, 15, 5, -30],
        [-30, 0, 15, 20, 20, 15, 0, -30],
        [-30, 5, 10, 15, 15, 10, 5, -30],
        [-40, -20, 0, 5, 5, 0, -20, -40],
        [-50, -40, -30, -30, -30, -30, -40, -50]
    ].slice(0, 6).map(row => row.slice(0, 6)),

    [PieceType.PAWN]: [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10],
        [5, 5, 10, 25, 25, 10, 5, 5],
        [0, 0, 0, 20, 20, 0, 0, 0],
        [5, -5, -10, 0, 0, -10, -5, 5],
        [5, 10, 10, -20, -20, 10, 10, 5],
        [0, 0, 0, 0, 0, 0, 0, 0]
    ].slice(0, 6).map(row => row.slice(0, 6))
};

// Hệ số trọng số cho các yếu tố chiến lược
const STRATEGIC_WEIGHTS = {
    PIECE_VALUE: 1.0,
    PIECE_POSITION: 0.5,
    MOBILITY: 0.3,
    CENTER_CONTROL: 0.2,
    KING_SAFETY: 0.4,
    PIECE_DEVELOPMENT: 0.2
};

// Hằng số điểm
const CHECKMATE_SCORE = 10000;
const STALEMATE_SCORE = 0;
const DEFAULT_DEPTH = 4;

interface AIMove {
    from?: Position;
    to: Position;
    piece?: ChessPiece;
    score: number;
    capturedPiece?: ChessPiece;
}

export class ChessAI {
    // Bảng tra cứu Transposition Table
    private transpositionTable: Map<string, { depth: number, score: number, type: 'exact' | 'upperbound' | 'lowerbound' }> = new Map();

    // Hàm băm trạng thái bàn cờ
    private hashGameState(gameState: GameState): string {
        const boardHash = gameState.board.map(row =>
            row.map(piece => piece ?
                `${piece.color}${piece.type}${piece.id}` : 'null'
            ).join('|')
        ).join('||');

        const pieceBankHash =
            gameState.pieceBank[PieceColor.WHITE].map(p => `W${p.type}`).join('|') +
            '||' +
            gameState.pieceBank[PieceColor.BLACK].map(p => `B${p.type}`).join('|');

        return `${boardHash}|${pieceBankHash}|${gameState.currentPlayer}`;
    }

    // Đánh giá bảng cải tiến
    private evaluateBoard(gameState: GameState): number {
        // Kiểm tra trạng thái kết thúc game
        if (gameState.isCheckmate) {
            return gameState.currentPlayer === PieceColor.WHITE
                ? -CHECKMATE_SCORE
                : CHECKMATE_SCORE;
        }

        if (gameState.isStalemate) {
            return STALEMATE_SCORE;
        }

        let score = 0;
        const board = gameState.board;

        // Đánh giá chi tiết từng quân
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                const piece = board[row][col];
                if (piece) {
                    const multiplier = piece.color === PieceColor.WHITE ? 1 : -1;

                    // Giá trị quân cơ bản
                    let pieceScore = PIECE_VALUES[piece.type];

                    // Điểm vị trí từ bảng điểm
                    const positionScore = PIECE_SQUARE_TABLES[piece.type][row][col];

                    // Đánh giá điều kiện di chuyển
                    const mobilityScore = this.calculateMobilityScore(gameState, piece, { row, col });

                    // Kiểm soát trung tâm
                    const centerControlScore = this.calculateCenterControlScore(row, col);

                    // Tổng điểm cho quân
                    const totalPieceScore =
                        (pieceScore * STRATEGIC_WEIGHTS.PIECE_VALUE) +
                        (positionScore * STRATEGIC_WEIGHTS.PIECE_POSITION) +
                        (mobilityScore * STRATEGIC_WEIGHTS.MOBILITY) +
                        (centerControlScore * STRATEGIC_WEIGHTS.CENTER_CONTROL);

                    score += multiplier * totalPieceScore;
                }
            }
        }

        // Điểm cho quân trong piece bank
        const pieceBankScores = gameState.pieceBank[PieceColor.WHITE].reduce(
            (total, piece) => total + PIECE_VALUES[piece.type], 0
        ) - gameState.pieceBank[PieceColor.BLACK].reduce(
            (total, piece) => total + PIECE_VALUES[piece.type], 0
        );

        // Điểm an toàn của vua
        const kingSafetyScore = this.calculateKingSafetyScore(gameState);

        return score + pieceBankScores + (kingSafetyScore * STRATEGIC_WEIGHTS.KING_SAFETY);
    }

    // Tính điểm di chuyển (mobility)
    private calculateMobilityScore(gameState: GameState, piece: ChessPiece, position: Position): number {
        const validMoves = getValidMoves(gameState, position);
        return validMoves.length * 0.1; // Mỗi nước đi thêm 0.1 điểm
    }

    // Tính điểm kiểm soát trung tâm
    private calculateCenterControlScore(row: number, col: number): number {
        const centerRows = [1, 2, 3, 4];
        const centerCols = [1, 2, 3, 4];

        if (centerRows.includes(row) && centerCols.includes(col)) {
            return 2; // Quân ở trung tâm được thưởng điểm
        }

        return 0;
    }

    // Tính điểm an toàn của vua
    private calculateKingSafetyScore(gameState: GameState): number {
        const kingColor = gameState.currentPlayer;
        const opponentColor = kingColor === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;

        // Tìm vua
        let kingPosition: Position | null = null;
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                const piece = gameState.board[row][col];
                if (piece?.type === PieceType.KING && piece?.color === kingColor) {
                    kingPosition = { row, col };
                    break;
                }
            }
            if (kingPosition) break;
        }

        if (!kingPosition) return 0;

        // Kiểm tra các quân đe dọa vua
        const threateningPieces = this.findThreateningPieces(gameState, kingPosition, opponentColor);

        // Điểm âm nếu có nhiều quân đe dọa
        return -threateningPieces.length * 2;
    }

    // Tìm các quân đe dọa vua
    private findThreateningPieces(gameState: GameState, kingPosition: Position, opponentColor: PieceColor): Position[] {
        const threateningPieces: Position[] = [];

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece.color === opponentColor) {
                    const validMoves = getValidMoves(gameState, { row, col });
                    if (validMoves.some(move =>
                        move.row === kingPosition.row && move.col === kingPosition.col
                    )) {
                        threateningPieces.push({ row, col });
                    }
                }
            }
        }

        return threateningPieces;
    }

    // Thuật toán Minimax với Alpha-Beta Pruning và Transposition Table
    private minimax(
        gameState: GameState,
        depth: number,
        alpha: number,
        beta: number,
        maximizingPlayer: boolean,
        nullMove = false
    ): number {
        // Kiểm tra bảng tra cứu
        const stateHash = this.hashGameState(gameState);
        const cachedResult = this.transpositionTable.get(stateHash);
        if (cachedResult && cachedResult.depth >= depth) {
            return cachedResult.score;
        }

        // Điều kiện dừng
        if (depth === 0 || gameState.isCheckmate || gameState.isStalemate) {
            const score = this.evaluateBoard(gameState);
            this.transpositionTable.set(stateHash, { depth, score, type: 'exact' });
            return score;
        }

        // Null Move Pruning - kỹ thuật cắt tỉa nâng cao
        if (!nullMove && depth > 2) {
            const nullMoveReduction = Math.floor(depth / 3);
            const nullMoveScore = -this.minimax(
                { ...gameState, currentPlayer: gameState.currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE },
                depth - nullMoveReduction - 1,
                -beta,
                -beta + 1,
                !maximizingPlayer,
                true
            );

            if (nullMoveScore >= beta) {
                return beta;
            }
        }

        // Sắp xếp và lọc các nước đi
        const moves = this.orderMoves(this.getAllValidMoves(gameState, gameState.currentPlayer), gameState);

        if (maximizingPlayer) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const newState = this.applyMove(gameState, move);
                const evaluation = this.minimax(
                    newState,
                    depth - 1,
                    alpha,
                    beta,
                    false
                );

                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);

                // Kiểm tra điều kiện cắt tỉa
                if (beta <= alpha) {
                    // Lưu vào bảng tra cứu với loại lượt cắt tỉa
                    this.transpositionTable.set(stateHash, {
                        depth,
                        score: maxEval,
                        type: 'lowerbound'
                    });
                    break;
                }
            }

            // Lưu vào bảng tra cứu
            this.transpositionTable.set(stateHash, {
                depth,
                score: maxEval,
                type: 'exact'
            });
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const newState = this.applyMove(gameState, move);
                const evaluation = this.minimax(
                    newState,
                    depth - 1,
                    alpha,
                    beta,
                    true
                );

                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);

                // Kiểm tra điều kiện cắt tỉa
                if (beta <= alpha) {
                    // Lưu vào bảng tra cứu với loại lượt cắt tỉa
                    this.transpositionTable.set(stateHash, {
                        depth,
                        score: minEval,
                        type: 'upperbound'
                    });
                    break;
                }
            }

            // Lưu vào bảng tra cứu
            this.transpositionTable.set(stateHash, {
                depth,
                score: minEval,
                type: 'exact'
            });
            return minEval;
        }
    }

    // Sắp xếp các nước đi để cải thiện hiệu quả cắt tỉa
    // Sắp xếp các nước đi để cải thiện hiệu quả cắt tỉa
    private orderMoves(moves: AIMove[], gameState: GameState): AIMove[] {
        return moves.sort((a, b) => {
            // Ưu tiên các nước ăn quân quan trọng
            const aCapture = a.from && gameState.board[a.to.row][a.to.col] ?
                PIECE_VALUES[gameState.board[a.to.row][a.to.col]!.type] : 0;
            const bCapture = b.from && gameState.board[b.to.row][b.to.col] ?
                PIECE_VALUES[gameState.board[b.to.row][b.to.col]!.type] : 0;

            // Ưu tiên nước ăn quân có giá trị cao hơn
            if (aCapture !== bCapture) {
                return bCapture - aCapture;
            }

            // Ưu tiên các nước di chuyển quân quan trọng
            const aPieceValue = a.piece ? PIECE_VALUES[a.piece.type] : 0;
            const bPieceValue = b.piece ? PIECE_VALUES[b.piece.type] : 0;

            return bPieceValue - aPieceValue;
        });
    }



    // Lấy tất cả các nước đi hợp lệ
    private getAllValidMoves(gameState: GameState, color: PieceColor): AIMove[] {
        const moves: AIMove[] = [];

        // Kiểm tra nước đi của các quân trên bàn
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece.color === color) {
                    const validMoves = getValidMoves(gameState, { row, col });
                    validMoves.forEach(move => {
                        moves.push({
                            from: { row, col },
                            to: move,
                            piece,
                            score: 0,
                            capturedPiece: gameState.board[move.row][move.col] || undefined
                        });
                    });
                }
            }
        }

        // Kiểm tra nước thả quân từ piece bank
        const pieceBankMoves = gameState.pieceBank[color];
        pieceBankMoves.forEach(piece => {
            const validDropSquares = getValidDropSquares(gameState, piece);
            validDropSquares.forEach(square => {
                moves.push({
                    to: square,
                    piece,
                    score: 0
                });
            });
        });

        return moves;
    }

    // Áp dụng nước đi
    private applyMove(gameState: GameState, move: AIMove): GameState {
        if (move.from) {
            // Nước đi di chuyển quân
            return makeMove(gameState, move.from, move.to);
        } else if (move.piece) {
            // Nước thả quân từ piece bank
            return dropPiece(gameState, move.piece, move.to);
        }

        // Nếu không có nước đi hợp lệ, trả về trạng thái ban đầu
        return gameState;
    }

    // Tìm nước đi tốt nhất
    private iterativeDeepening(gameState: GameState, maxTime: number): AIMove | null {
        let bestMove: AIMove | null = null;
        const startTime = Date.now();
        for (let depth = 1; Date.now() - startTime < maxTime; depth++) {
            const move = this.findBestMoveAtDepth(gameState, depth);
            if (move) {
                bestMove = move;
            }
        }
        return bestMove;
    }

    private findBestMoveAtDepth(gameState: GameState, depth: number): AIMove | null {
        const moves = this.getAllValidMoves(gameState, gameState.currentPlayer);
        let bestMove: AIMove | null = null;
        let bestScore = gameState.currentPlayer === PieceColor.WHITE ? -Infinity : Infinity;

        for (const move of moves) {
            const newState = this.applyMove(gameState, move);
            const score = this.minimax(newState, depth, -Infinity, Infinity, gameState.currentPlayer === PieceColor.BLACK);
            if (gameState.currentPlayer === PieceColor.WHITE) {
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
            } else {
                if (score < bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
            }
        }
        return bestMove;
    }

    findBestMove(gameState: GameState): AIMove | null {
        return this.iterativeDeepening(gameState, 1000); // 2 giây
    }
}

export default ChessAI;