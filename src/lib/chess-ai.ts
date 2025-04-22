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

// Giá trị quân cờ tối ưu cho bàn cờ 6x6
const PIECE_VALUES: Record<PieceType, number> = {
    [PieceType.KING]: 10000,
    [PieceType.QUEEN]: 900,    // Giữ nguyên giá trị
    [PieceType.ROOK]: 550,     // Tăng giá trị xe trên bàn nhỏ 
    [PieceType.BISHOP]: 360,   // Tăng nhẹ
    [PieceType.KNIGHT]: 375,   // Tăng mạnh vì mã hiệu quả hơn trên bàn 6x6
    [PieceType.PAWN]: 150      // Tăng giá trị tốt vì gần phong cấp hơn
};

// Bảng điểm vị trí được tái tối ưu hóa cho bàn cờ 6x6
const PIECE_SQUARE_TABLES: Record<PieceType, number[][]> = {
    [PieceType.KING]: [
        [-40, -30, -20, -20, -30, -40],   // Vua ở góc kém an toàn hơn trên bàn 6x6
        [-30, -15, -5, -5, -15, -30],
        [-20, -5, 10, 10, -5, -20],
        [-20, -5, 10, 10, -5, -20],
        [-30, -15, -5, -5, -15, -30],
        [-40, -30, -20, -20, -30, -40]
    ],
    [PieceType.QUEEN]: [
        [-20, -10, -5, -5, -10, -20],
        [-10, 0, 8, 8, 0, -10],
        [-5, 8, 15, 15, 8, -5],
        [-5, 8, 15, 15, 8, -5],
        [-10, 0, 8, 8, 0, -10],
        [-20, -10, -5, -5, -10, -20]
    ],
    [PieceType.ROOK]: [
        [0, 5, 10, 10, 5, 0],
        [5, 15, 20, 20, 15, 5],     // Tăng giá trị xe ở trung tâm
        [0, 10, 15, 15, 10, 0],
        [0, 10, 15, 15, 10, 0],
        [5, 15, 20, 20, 15, 5],
        [0, 5, 10, 10, 5, 0]
    ],
    [PieceType.BISHOP]: [
        [-15, -10, -5, -5, -10, -15],
        [-10, 10, 15, 15, 10, -10],     // Tăng giá trị tượng ở trung tâm
        [-5, 15, 25, 25, 15, -5],
        [-5, 15, 25, 25, 15, -5],
        [-10, 10, 15, 15, 10, -10],
        [-15, -10, -5, -5, -10, -15]
    ],
    [PieceType.KNIGHT]: [
        [-50, -30, -20, -20, -30, -50],  // Mã ở góc rất kém
        [-30, 0, 15, 15, 0, -30],
        [-20, 15, 35, 35, 15, -20],      // Tăng giá trị mã ở trung tâm
        [-20, 15, 35, 35, 15, -20],
        [-30, 0, 15, 15, 0, -30],
        [-50, -30, -20, -20, -30, -50]
    ],
    [PieceType.PAWN]: [
        [0, 0, 0, 0, 0, 0],
        [120, 120, 120, 120, 120, 120],  // Tốt ở hàng cuối được thưởng cao
        [25, 30, 40, 40, 30, 25],
        [15, 20, 30, 30, 20, 15],
        [10, 15, 20, 20, 15, 10],
        [0, 0, 0, 0, 0, 0]
    ]
};

// Bảng đánh giá cho việc thả quân ở các vị trí
const DROP_POSITION_VALUES: Record<PieceType, number[][]> = {
    [PieceType.QUEEN]: [
        [10, 15, 20, 20, 15, 10],
        [15, 25, 35, 35, 25, 15],
        [20, 35, 40, 40, 35, 20],
        [20, 35, 40, 40, 35, 20],
        [15, 25, 35, 35, 25, 15],
        [10, 15, 20, 20, 15, 10]
    ],
    [PieceType.ROOK]: [
        [5, 10, 15, 15, 10, 5],
        [10, 20, 25, 25, 20, 10],
        [15, 25, 30, 30, 25, 15],
        [15, 25, 30, 30, 25, 15],
        [10, 20, 25, 25, 20, 10],
        [5, 10, 15, 15, 10, 5]
    ],
    [PieceType.BISHOP]: [
        [5, 10, 15, 15, 10, 5],
        [10, 20, 25, 25, 20, 10],
        [15, 25, 30, 30, 25, 15],
        [15, 25, 30, 30, 25, 15],
        [10, 20, 25, 25, 20, 10],
        [5, 10, 15, 15, 10, 5]
    ],
    [PieceType.KNIGHT]: [
        [0, 5, 10, 10, 5, 0],
        [5, 20, 30, 30, 20, 5],
        [10, 30, 40, 40, 30, 10],
        [10, 30, 40, 40, 30, 10],
        [5, 20, 30, 30, 20, 5],
        [0, 5, 10, 10, 5, 0]
    ],
    [PieceType.PAWN]: [
        [0, 0, 0, 0, 0, 0],
        [30, 40, 50, 50, 40, 30],
        [25, 30, 40, 40, 30, 25],
        [20, 25, 30, 30, 25, 20],
        [10, 15, 20, 20, 15, 10],
        [0, 0, 0, 0, 0, 0]
    ],
    [PieceType.KING]: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0]
    ]
};

// Bảng đánh giá cho việc thả quân ở các vị trí đặc biệt cho bàn 6x6
const SPECIAL_DROP_POSITIONS: Record<PieceType, number[][]> = {
    [PieceType.KNIGHT]: [
        [0, 10, 15, 15, 10, 0], // Vị trí góc không tốt cho Mã
        [10, 30, 40, 40, 30, 10], // Mã kiểm soát tốt vị trí gần trung tâm
        [15, 40, 60, 60, 40, 15],
        [15, 40, 60, 60, 40, 15],
        [10, 30, 40, 40, 30, 10],
        [0, 10, 15, 15, 10, 0]
    ],
    [PieceType.BISHOP]: [
        [20, 10, 10, 10, 10, 20], // Tượng hoạt động hiệu quả ở bàn cờ nhỏ
        [10, 30, 20, 20, 30, 10],
        [10, 20, 40, 40, 20, 10],
        [10, 20, 40, 40, 20, 10],
        [10, 30, 20, 20, 30, 10],
        [20, 10, 10, 10, 10, 20]
    ],
    [PieceType.ROOK]: [
        [10, 10, 10, 10, 10, 10],
        [25, 15, 15, 15, 15, 25], // Xe hoạt động tốt hơn trên bàn cờ nhỏ
        [10, 15, 20, 20, 15, 10],
        [10, 15, 20, 20, 15, 10],
        [25, 15, 15, 15, 15, 25],
        [10, 10, 10, 10, 10, 10]
    ],
    [PieceType.QUEEN]: [
        [15, 15, 20, 20, 15, 15],
        [15, 30, 40, 40, 30, 15],
        [20, 40, 50, 50, 40, 20], // Hậu rất mạnh trên bàn cờ nhỏ
        [20, 40, 50, 50, 40, 20],
        [15, 30, 40, 40, 30, 15],
        [15, 15, 20, 20, 15, 15]
    ],
    [PieceType.PAWN]: [
        [0, 0, 0, 0, 0, 0],      // Không thể thả tốt ở hàng cuối
        [60, 70, 80, 80, 70, 60], // Giá trị cao khi thả tốt gần phong cấp
        [40, 50, 60, 60, 50, 40],
        [30, 40, 50, 50, 40, 30],
        [15, 20, 30, 30, 20, 15],
        [0, 0, 0, 0, 0, 0]       // Không thể thả tốt ở hàng cuối
    ],
    [PieceType.KING]: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0]
    ]
};

// Trọng số chiến lược được tối ưu hóa cho bàn 6x6
const STRATEGIC_WEIGHTS = {
    opening: {
        PIECE_VALUE: 1.0,
        PIECE_POSITION: 0.7,       // Tăng tầm quan trọng của vị trí trên bàn nhỏ
        MOBILITY: 0.9,             // Tăng vì tính cơ động quan trọng hơn trên bàn 6x6
        CENTER_CONTROL: 1.3,       // Tăng tầm quan trọng kiểm soát trung tâm
        KING_SAFETY: 1.6,          // Tăng vì vua dễ bị tấn công hơn
        PIECE_DEVELOPMENT: 1.0,
        KING_ATTACK: 0.6,          // Tăng nhẹ
        PAWN_STRUCTURE: 0.6,       // Tăng nhẹ
        THREAT: 0.8,               // Tăng nhẹ
        ATTACK_PATTERNS: 0.7,
        PIECE_DROPS: 0.9           // Thêm trọng số cho việc thả quân
    },
    middlegame: {
        PIECE_VALUE: 1.0,
        PIECE_POSITION: 0.8,       // Tăng tầm quan trọng của vị trí
        MOBILITY: 1.2,             // Tăng vì tính cơ động quan trọng hơn
        CENTER_CONTROL: 1.1,
        KING_SAFETY: 2.1,          // Tăng vì vua dễ bị tấn công hơn
        PIECE_DEVELOPMENT: 0.6,
        KING_ATTACK: 1.6,          // Tăng vì tấn công vua quan trọng hơn
        PAWN_STRUCTURE: 0.8,
        THREAT: 1.1,
        ATTACK_PATTERNS: 0.9,
        PIECE_DROPS: 1.2           // Thêm trọng số cho việc thả quân
    },
    endgame: {
        PIECE_VALUE: 1.0,
        PIECE_POSITION: 0.6,
        MOBILITY: 1.3,             // Tăng vì tính cơ động rất quan trọng trong tàn cuộc
        CENTER_CONTROL: 0.7,
        KING_SAFETY: 0.8,          // Giảm vì vua cần năng động hơn trong tàn cuộc
        PIECE_DEVELOPMENT: 0.3,
        KING_ATTACK: 2.0,
        PAWN_STRUCTURE: 1.1,       // Tăng tầm quan trọng của tốt trong tàn cuộc
        THREAT: 1.7,               // Tăng tầm quan trọng của đe dọa
        ATTACK_PATTERNS: 1.3,
        PIECE_DROPS: 1.5           // Thêm trọng số cho việc thả quân
    }
};

// Hằng số
const CHECKMATE_SCORE = 100000;
const DRAW_SCORE = 0;
const DEFAULT_DEPTH = 2; // Giảm độ sâu mặc định
const MAX_QUIESCENCE_DEPTH = 4; // Giảm độ sâu quiescence search để đánh giá tốt hơn
const MAX_TRANSPOSITION_TABLE_SIZE = 500000; // Giảm kích thước bảng chuyển vị

// Hệ số khi đánh giá thả quân
const DROP_SCORE_MULTIPLIER = 1.5; // Đánh giá cao hơn việc thả quân so với di chuyển quân

// Thêm hệ số thông minh cho chiến thuật thả quân
const DROP_TACTICS = {
    BLOCK_CHECK: 200,           // Thưởng cho việc thả quân để chặn chiếu
    ATTACK_KING: 250,           // Thưởng cho việc thả quân tạo ra tình huống chiếu
    FORK_OPPORTUNITY: 180,      // Thưởng cho việc thả quân tạo cơ hội fork (2 đường tấn công)
    PROTECT_PIECE: 120,         // Thưởng cho việc thả quân để bảo vệ quân quan trọng
    GAIN_CENTER_CONTROL: 100,   // Thưởng cho việc thả quân để kiểm soát trung tâm
    ATTACK_UNDEFENDED: 150,     // Thưởng cho việc thả quân tấn công quân không được bảo vệ
    ADVANCED_POSITION: 80,      // Thưởng cho vị trí thả quân tiến tiến
    ENDGAME_PAWN_DROP: 200      // Thưởng đặc biệt cho việc thả tốt trong tàn cuộc
};

interface AIMove {
    from?: Position;
    to: Position;
    piece?: ChessPiece;
    score: number;
    capturedPiece?: ChessPiece;
    isDropMove?: boolean; // Đánh dấu đây là nước thả quân
}

interface TTEntry {
    depth: number;
    score: number;
    type: 'exact' | 'upperbound' | 'lowerbound';
    bestDepth: number;
    bestMove?: AIMove;
}

export class ChessAI {
    private transpositionTable: Map<string, TTEntry> = new Map();
    private killerMoves: AIMove[][] = Array(100).fill(0).map(() => []);
    private historyTable: Map<string, number> = new Map();
    private openingBook: Record<string, Position[]>;
    private zobristKeys: number[][][];
    private whiteKingPos: Position | null = null;
    private blackKingPos: Position | null = null;
    private searchDepth: number = DEFAULT_DEPTH;
    private useHybridMode: boolean = true; // Sử dụng cả đánh giá thả quân và di chuyển

    constructor() {
        this.initializeOpeningBook();
        this.zobristKeys = Array(6).fill(0).map(() =>
            Array(6).fill(0).map(() =>
                Array(12).fill(0).map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
            )
        );
    }

    // Khởi tạo sách khai cuộc
    private initializeOpeningBook(): void {
        this.openingBook = {
            'initial': [
                { row: 1, col: 2 },
                { row: 1, col: 3 },
                { row: 0, col: 1 },
                { row: 0, col: 4 }
            ],
            'e5': [
                { row: 0, col: 2 },
                { row: 0, col: 4 },
                { row: 1, col: 3 }
            ],
            'Nc6': [
                { row: 0, col: 1 },
                { row: 1, col: 2 },
                { row: 0, col: 2 }
            ],
            'd5': [
                { row: 1, col: 3 },
                { row: 0, col: 4 },
                { row: 0, col: 2 }
            ]
        };
    }

    // Xác định giai đoạn của ván cờ (khai cuộc, trung cuộc, tàn cuộc)
    private getGamePhase(gameState: GameState): 'opening' | 'middlegame' | 'endgame' {
        let totalMaterialValue = 0;
        let piecesOnBoard = 0;
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                const piece = gameState.board[row][col];
                if (piece) {
                    piecesOnBoard++;
                    if (piece.type !== PieceType.KING) {
                        totalMaterialValue += PIECE_VALUES[piece.type];
                    }
                }
            }
        }
        if (piecesOnBoard > 20 && totalMaterialValue > 2000) return 'opening';
        if (piecesOnBoard < 10 || totalMaterialValue < 1000) return 'endgame';
        return 'middlegame';
    }

    // Cập nhật vị trí của các vua
    private updateKingPositions(gameState: GameState): void {
        this.whiteKingPos = this.findKingPosition(gameState, PieceColor.WHITE);
        this.blackKingPos = this.findKingPosition(gameState, PieceColor.BLACK);
    }

    // Tìm vị trí của vua
    private findKingPosition(gameState: GameState, color: PieceColor): Position | null {
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece.type === PieceType.KING && piece.color === color) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    // Lấy nước đi từ sách khai cuộc
    private getOpeningMove(gameState: GameState): AIMove | null {
        if (gameState.moveHistory.length < 2) {
            // Nước đầu tiên, chọn một nước mở đầu tốt
            const openingMoves = this.openingBook['initial'];
            if (openingMoves && openingMoves.length > 0) {
                const randomIndex = Math.floor(Math.random() * openingMoves.length);
                const to = openingMoves[randomIndex];

                // Tìm quân cờ để đi đến vị trí này
                for (let row = 0; row < 6; row++) {
                    for (let col = 0; col < 6; col++) {
                        const piece = gameState.board[row][col];
                        if (piece && piece.color === gameState.currentPlayer) {
                            const validMoves = getValidMoves(gameState, { row, col });
                            const matchingMove = validMoves.find(move => move.row === to.row && move.col === to.col);
                            if (matchingMove) {
                                return {
                                    from: { row, col },
                                    to: matchingMove,
                                    piece,
                                    score: 0,
                                    capturedPiece: gameState.board[to.row][to.col] || undefined
                                };
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    // Áp dụng một nước đi vào trạng thái ván cờ
    private applyMove(gameState: GameState, move: AIMove): GameState {
        if (move.from && move.to) {
            return makeMove(gameState, move.from, move.to);
        } else if (move.piece && move.to) {
            return dropPiece(gameState, move.piece, move.to);
        }
        return gameState; // Trả về trạng thái hiện tại nếu không thể thực hiện nước đi
    }

    // Phiên bản nhanh hơn của Minimax
    private minimax(
        gameState: GameState,
        depth: number,
        alpha: number,
        beta: number,
        maximizingPlayer: boolean
    ): number {
        // Dừng sớm hơn để tăng tốc độ
        if (depth === 0 || gameState.isCheckmate || gameState.isStalemate) {
            return this.evaluateBoard(gameState);
        }

        // Tối ưu hóa: Chỉ tạo và sắp xếp nước đi khi cần thiết
        // Giảm số lượng nước đi khi ở độ sâu lớn để tăng tốc độ
        const getMovesForDepth = () => {
            let allMoves = this.getAllValidMoves(gameState, gameState.currentPlayer);

            // Ở độ sâu lớn, chỉ xem xét nước ăn quân, chiếu và các nước tốt tiềm năng
            if (depth <= 2 && allMoves.length > 10) {
                const importantMoves = allMoves.filter(move =>
                    move.capturedPiece || // Nước ăn quân
                    this.isCheckMove(gameState, move) || // Nước chiếu
                    (move.from && (move.from.row >= 2 && move.from.row <= 3 && move.from.col >= 2 && move.from.col <= 3)) // Từ trung tâm
                );

                if (importantMoves.length > 0) {
                    return this.orderMoves(importantMoves, gameState);
                }
            }

            return this.orderMoves(allMoves, gameState);
        };

        if (maximizingPlayer) {
            let maxEval = -Infinity;
            const moves = getMovesForDepth();

            for (const move of moves) {
                const newState = this.applyMove(gameState, move);
                const evalScore = this.minimax(newState, depth - 1, alpha, beta, false);
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) {
                    break;
                }
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            const moves = getMovesForDepth();

            for (const move of moves) {
                const newState = this.applyMove(gameState, move);
                const evalScore = this.minimax(newState, depth - 1, alpha, beta, true);
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) {
                    break;
                }
            }
            return minEval;
        }
    }

    // Kiểm tra nhanh xem nước đi có phải là nước chiếu không
    private isCheckMove(gameState: GameState, move: AIMove): boolean {
        if (!move.from || !move.to) return false;

        const newState = this.applyMove(gameState, move);
        return isKingInCheck(newState);
    }

    // Đánh giá vị trí của bàn cờ
    private evaluateBoard(gameState: GameState): number {
        if (gameState.isCheckmate) {
            return gameState.currentPlayer === PieceColor.WHITE ? -CHECKMATE_SCORE : CHECKMATE_SCORE;
        }

        if (gameState.isStalemate) {
            return DRAW_SCORE;
        }

        let score = 0;
        const phase = this.getGamePhase(gameState);
        const weights = STRATEGIC_WEIGHTS[phase];

        // Đánh giá các quân cờ trên bàn
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                const piece = gameState.board[row][col];
                if (piece) {
                    const pieceValue = PIECE_VALUES[piece.type];
                    const positionValue = PIECE_SQUARE_TABLES[piece.type][piece.color === PieceColor.WHITE ? row : 5 - row][col];

                    // Cộng hoặc trừ điểm tùy thuộc vào màu quân
                    const valueMultiplier = piece.color === PieceColor.WHITE ? 1 : -1;
                    score += valueMultiplier * (pieceValue * weights.PIECE_VALUE + positionValue * weights.PIECE_POSITION);
                }
            }
        }

        // Đánh giá các quân trong ngân hàng
        score += this.evaluatePieceBank(gameState);

        // Đánh giá khả năng kiểm soát trung tâm
        score += this.evaluateCenterControl(gameState, PieceColor.WHITE) * weights.CENTER_CONTROL;
        score -= this.evaluateCenterControl(gameState, PieceColor.BLACK) * weights.CENTER_CONTROL;

        // Đánh giá an toàn của vua
        score += this.evaluateKingSafety(gameState, PieceColor.WHITE) * weights.KING_SAFETY;
        score -= this.evaluateKingSafety(gameState, PieceColor.BLACK) * weights.KING_SAFETY;

        return score;
    }

    // Đánh giá khả năng kiểm soát trung tâm
    private evaluateCenterControl(gameState: GameState, color: PieceColor): number {
        let control = 0;
        const centerRows = [2, 3];
        const centerCols = [2, 3];

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece.color === color) {
                    const validMoves = getValidMoves(gameState, { row, col });

                    for (const move of validMoves) {
                        // Kiểm tra xem nước đi có vào trung tâm không
                        if (centerRows.includes(move.row) && centerCols.includes(move.col)) {
                            control += 2;
                        }
                    }

                    // Thêm điểm nếu quân đã ở trong trung tâm
                    if (centerRows.includes(row) && centerCols.includes(col)) {
                        control += 5;
                    }
                }
            }
        }

        return control;
    }

    // Đánh giá an toàn của vua
    private evaluateKingSafety(gameState: GameState, color: PieceColor): number {
        const kingPos = color === PieceColor.WHITE ? this.whiteKingPos : this.blackKingPos;
        if (!kingPos) return 0;

        let safety = 0;

        // Kiểm tra số lượng quân bảo vệ xung quanh vua
        for (let r = kingPos.row - 1; r <= kingPos.row + 1; r++) {
            for (let c = kingPos.col - 1; c <= kingPos.col + 1; c++) {
                if (r >= 0 && r < 6 && c >= 0 && c < 6 && !(r === kingPos.row && c === kingPos.col)) {
                    const piece = gameState.board[r][c];
                    if (piece && piece.color === color) {
                        safety += 10; // Quân đồng minh bảo vệ
                    }
                }
            }
        }

        // Kiểm tra các quân tấn công vua
        const opponentColor = color === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;
        let attackers = 0;

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece.color === opponentColor) {
                    const moves = getValidMoves(gameState, { row, col });
                    if (moves.some(move => move.row === kingPos.row && move.col === kingPos.col)) {
                        attackers++;
                    }
                }
            }
        }

        safety -= attackers * 30; // Trừ điểm cho mỗi quân tấn công vua

        return safety;
    }

    // Phương thức đánh giá quân trong ngân hàng
    private evaluatePieceBank(gameState: GameState): number {
        let score = 0;
        const phase = this.getGamePhase(gameState);
        const weights = STRATEGIC_WEIGHTS[phase];

        // Đánh giá quân trắng
        for (const piece of gameState.pieceBank[PieceColor.WHITE]) {
            score += PIECE_VALUES[piece.type] * 0.7 * weights.PIECE_DROPS;
        }

        // Đánh giá quân đen
        for (const piece of gameState.pieceBank[PieceColor.BLACK]) {
            score -= PIECE_VALUES[piece.type] * 0.7 * weights.PIECE_DROPS;
        }

        return score;
    }

    // Đánh giá chiến thuật đặc biệt cho nước thả quân
    private evaluateDropMove(gameState: GameState, move: AIMove): number {
        if (!move.isDropMove || !move.piece || !move.to) return 0;

        const { to, piece } = move;
        const { row, col } = to;
        let score = 0;
        const phase = this.getGamePhase(gameState);
        const opponentColor = piece.color === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;

        // 1. Kiểm tra xem có chặn chiếu không
        if (isKingInCheck(gameState)) {
            // Mô phỏng nước thả
            const tempBoard = gameState.board.map(r => [...r]);
            tempBoard[row][col] = piece;
            const tempGameState = { ...gameState, board: tempBoard };

            if (!isKingInCheck(tempGameState, gameState.currentPlayer)) {
                score += DROP_TACTICS.BLOCK_CHECK;
            }
        }

        // 2. Kiểm tra xem thả quân có tạo ra nước chiếu không
        const newState = this.applyMove(gameState, move);
        if (isKingInCheck(newState)) {
            score += DROP_TACTICS.ATTACK_KING;
        }

        // 3. Kiểm tra thả quân có tạo fork không (kiểm tra nhiều mục tiêu)
        if (piece.type === PieceType.KNIGHT || piece.type === PieceType.QUEEN || piece.type === PieceType.BISHOP) {
            let targetCount = 0;
            const piecesAttacked = new Set<string>();

            // Lấy các nước đi giả định sau khi thả quân
            const tempBoard = gameState.board.map(r => [...r]);
            tempBoard[row][col] = piece;
            const tempGameState = { ...gameState, board: tempBoard, currentPlayer: piece.color };

            const potentialMoves = getValidMoves(tempGameState, { row, col });

            // Đếm số quân có thể tấn công
            for (const potentialMove of potentialMoves) {
                const targetPiece = gameState.board[potentialMove.row][potentialMove.col];
                if (targetPiece && targetPiece.color === opponentColor) {
                    piecesAttacked.add(`${potentialMove.row}-${potentialMove.col}`);
                }
            }

            if (piecesAttacked.size >= 2) {
                score += DROP_TACTICS.FORK_OPPORTUNITY;
                // Thêm điểm cho mỗi mục tiêu giá trị cao
                for (const pos of piecesAttacked) {
                    const [r, c] = pos.split('-').map(Number);
                    const targetPiece = gameState.board[r][c];
                    if (targetPiece && PIECE_VALUES[targetPiece.type] >= PIECE_VALUES[PieceType.ROOK]) {
                        score += 50; // Thêm điểm cho fork nhắm vào quân giá trị cao
                    }
                }
            }
        }

        // 4. Kiểm tra thả quân có bảo vệ quân đang bị tấn công không
        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 6; c++) {
                const boardPiece = gameState.board[r][c];
                if (boardPiece && boardPiece.color === piece.color) {
                    // Kiểm tra xem quân này có đang bị đe dọa không
                    let isUnderThreat = false;

                    // Tìm các quân của đối thủ có thể tấn công quân này
                    for (let attackerRow = 0; attackerRow < 6; attackerRow++) {
                        for (let attackerCol = 0; attackerCol < 6; attackerCol++) {
                            const attacker = gameState.board[attackerRow][attackerCol];
                            if (attacker && attacker.color === opponentColor) {
                                const attackerMoves = getValidMoves(gameState, { row: attackerRow, col: attackerCol });
                                if (attackerMoves.some(m => m.row === r && m.col === c)) {
                                    isUnderThreat = true;
                                    break;
                                }
                            }
                        }
                        if (isUnderThreat) break;
                    }

                    if (isUnderThreat) {
                        // Kiểm tra nếu quân được thả có thể bảo vệ quân đang bị đe dọa
                        // Mô phỏng nước thả
                        const tempBoard = gameState.board.map(r => [...r]);
                        tempBoard[row][col] = piece;
                        const tempGameState = { ...gameState, board: tempBoard, currentPlayer: opponentColor };

                        // Kiểm tra xem quân tấn công còn có thể ăn quân đó không
                        let stillUnderThreat = false;
                        for (let attackerRow = 0; attackerRow < 6; attackerRow++) {
                            for (let attackerCol = 0; attackerCol < 6; attackerCol++) {
                                const attacker = tempBoard[attackerRow][attackerCol];
                                if (attacker && attacker.color === opponentColor) {
                                    const attackerMoves = getValidMoves(tempGameState, { row: attackerRow, col: attackerCol });
                                    if (attackerMoves.some(m => m.row === r && m.col === c)) {
                                        // Nếu vẫn bị tấn công nhưng quân tấn công có giá trị thấp hơn
                                        if (PIECE_VALUES[attacker.type] < PIECE_VALUES[boardPiece.type]) {
                                            score += DROP_TACTICS.PROTECT_PIECE / 2;
                                        }
                                        stillUnderThreat = true;
                                        break;
                                    }
                                }
                            }
                            if (stillUnderThreat) break;
                        }

                        if (!stillUnderThreat) {
                            // Quân không còn bị đe dọa sau khi thả quân
                            score += DROP_TACTICS.PROTECT_PIECE;

                            // Ưu tiên cao hơn cho bảo vệ xe và quân giá trị cao
                            if (boardPiece.type === PieceType.ROOK) {
                                // Thưởng đặc biệt cho việc bảo vệ xe
                                score += DROP_TACTICS.PROTECT_PIECE * 1.5;
                                console.log("Ưu tiên bảo vệ XE");
                            }
                            else if (PIECE_VALUES[boardPiece.type] >= PIECE_VALUES[PieceType.BISHOP]) {
                                // Thưởng cao cho việc bảo vệ quân giá trị cao khác
                                score += DROP_TACTICS.PROTECT_PIECE * 1.2;
                            }
                        }
                    }
                }
            }
        }

        // 5. Thưởng cho thả quân ở vị trí chiến lược (trung tâm)
        const centerRows = [2, 3];
        const centerCols = [2, 3];
        if (centerRows.includes(row) && centerCols.includes(col)) {
            score += DROP_TACTICS.GAIN_CENTER_CONTROL;
        }

        // 6. Thưởng cho thả quân tấn công quân không được bảo vệ
        let attacksUndefended = false;
        // Mô phỏng nước thả
        const tempBoard = gameState.board.map(r => [...r]);
        tempBoard[row][col] = piece;
        const tempGameState = { ...gameState, board: tempBoard, currentPlayer: piece.color };

        const movesAfterDrop = getValidMoves(tempGameState, { row, col });

        for (const potentialAttack of movesAfterDrop) {
            const targetPiece = gameState.board[potentialAttack.row][potentialAttack.col];
            if (targetPiece && targetPiece.color === opponentColor) {
                // Kiểm tra xem quân này có được bảo vệ không
                let isDefended = false;
                for (let defenderRow = 0; defenderRow < 6; defenderRow++) {
                    for (let defenderCol = 0; defenderCol < 6; defenderCol++) {
                        const defender = gameState.board[defenderRow][defenderCol];
                        if (defender && defender.color === opponentColor &&
                            !(defenderRow === potentialAttack.row && defenderCol === potentialAttack.col)) {
                            const defenderMoves = getValidMoves(gameState, { row: defenderRow, col: defenderCol });
                            if (defenderMoves.some(m => m.row === potentialAttack.row && m.col === potentialAttack.col)) {
                                isDefended = true;
                                break;
                            }
                        }
                    }
                    if (isDefended) break;
                }

                if (!isDefended) {
                    attacksUndefended = true;
                    score += DROP_TACTICS.ATTACK_UNDEFENDED;
                    // Thêm điểm cho tấn công quân giá trị cao không được bảo vệ
                    score += Math.min(PIECE_VALUES[targetPiece.type] * 0.2, 100);
                }
            }
        }

        // 7. Thưởng cho vị trí tiến xa trên bàn cờ
        if (piece.color === PieceColor.WHITE) {
            // Quân trắng thưởng cho vị trí tiến về phía trên
            score += row * DROP_TACTICS.ADVANCED_POSITION / 6;
        } else {
            // Quân đen thưởng cho vị trí tiến về phía dưới
            score += (5 - row) * DROP_TACTICS.ADVANCED_POSITION / 6;
        }

        // 8. Điều chỉnh điểm cho tàn cuộc - thả tốt
        if (phase === 'endgame' && piece.type === PieceType.PAWN) {
            if (piece.color === PieceColor.WHITE && row >= 3) {
                score += DROP_TACTICS.ENDGAME_PAWN_DROP * (row - 2) / 3;
            } else if (piece.color === PieceColor.BLACK && row <= 2) {
                score += DROP_TACTICS.ENDGAME_PAWN_DROP * (3 - row) / 3;
            }
        }

        return score;
    }

    // Thêm chiến thuật thả quân thông minh đặc biệt cho bàn 6x6
    private getTacticalDropMove(gameState: GameState): AIMove | null {
        const currentPlayer = gameState.currentPlayer;
        const pieceBank = gameState.pieceBank[currentPlayer];

        if (pieceBank.length === 0) return null;

        // Chiến thuật 1: Thả quân tạo pin (ghim) một quân của đối thủ
        const pinMove = this.findPinningDropMove(gameState);
        if (pinMove) return pinMove;

        // Chiến thuật 2: Thả quân tạo vị trí outpost trên bàn 6x6
        const outpostMove = this.findOutpostDropMove(gameState);
        if (outpostMove) return outpostMove;

        // Chiến thuật 3: Tạo battery (pin cùng chiều) với quân cùng loại
        const batteryMove = this.findBatteryDropMove(gameState);
        if (batteryMove) return batteryMove;

        // Chiến thuật 4: Thả quân để khóa quân đối phương
        const blockingMove = this.findBlockingDropMove(gameState);
        if (blockingMove) return blockingMove;

        // Tìm chiến thuật thả quân đặc biệt cho tàn cuộc
        if (this.getGamePhase(gameState) === 'endgame') {
            const endgameMove = this.getEndgameDropStrategy(gameState);
            if (endgameMove) return endgameMove;
        }

        return null;
    }

    // Tìm nước thả ghim (pin) quân đối thủ
    private findPinningDropMove(gameState: GameState): AIMove | null {
        const currentPlayer = gameState.currentPlayer;
        const opponentColor = currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;
        const pieceBank = gameState.pieceBank[currentPlayer];

        // Tìm vị trí vua đối thủ
        const opponentKingPos = opponentColor === PieceColor.WHITE ? this.whiteKingPos : this.blackKingPos;
        if (!opponentKingPos) return null;

        // Chỉ tượng, xe và hậu có thể tạo pin
        const longRangePieces = pieceBank.filter(p =>
            p.type === PieceType.QUEEN || p.type === PieceType.ROOK || p.type === PieceType.BISHOP
        );

        if (longRangePieces.length === 0) return null;

        for (const piece of longRangePieces) {
            const validDropSquares = getValidDropSquares(gameState, piece);

            for (const dropPos of validDropSquares) {
                // Kiểm tra xem dropPos có tạo pin không
                const direction = this.getDirection(dropPos, opponentKingPos);
                if (!direction) continue; // Không cùng hướng

                // Kiểm tra xem có đúng một quân của đối thủ nằm giữa không
                const piecesInBetween = this.getPiecesInDirection(gameState, dropPos, direction);

                if (piecesInBetween.length === 1 &&
                    piecesInBetween[0].piece &&
                    piecesInBetween[0].piece.color === opponentColor &&
                    piecesInBetween[0].piece.type !== PieceType.KING) {
                    // Tìm thấy nước thả ghim
                    return {
                        piece,
                        to: dropPos,
                        score: 600, // Điểm cao vì đây là nước thả chiến thuật tốt
                        isDropMove: true
                    };
                }
            }
        }

        return null;
    }

    // Kiểm tra xem hai vị trí có cùng hướng (ngang, dọc, chéo) không
    private getDirection(pos1: Position, pos2: Position): { rowDir: number, colDir: number } | null {
        const rowDiff = pos2.row - pos1.row;
        const colDiff = pos2.col - pos1.col;

        // Kiểm tra xem có nằm trên cùng một đường thẳng không
        if (rowDiff === 0) return { rowDir: 0, colDir: Math.sign(colDiff) }; // Ngang
        if (colDiff === 0) return { rowDir: Math.sign(rowDiff), colDir: 0 }; // Dọc
        if (Math.abs(rowDiff) === Math.abs(colDiff)) {
            return {
                rowDir: Math.sign(rowDiff),
                colDir: Math.sign(colDiff)
            }; // Chéo
        }

        return null; // Không cùng hướng
    }

    // Lấy danh sách quân cờ nằm trên cùng một đường từ vị trí pos theo hướng dir
    private getPiecesInDirection(gameState: GameState, pos: Position, dir: { rowDir: number, colDir: number }): { piece: ChessPiece | null, position: Position }[] {
        const pieces: { piece: ChessPiece | null, position: Position }[] = [];
        let row = pos.row + dir.rowDir;
        let col = pos.col + dir.colDir;

        // Duyệt theo hướng đã cho cho đến khi gặp biên bàn cờ
        while (row >= 0 && row < 6 && col >= 0 && col < 6) {
            pieces.push({
                piece: gameState.board[row][col],
                position: { row, col }
            });

            // Nếu gặp quân cờ, chỉ tìm thêm một quân nữa
            if (gameState.board[row][col]) {
                row += dir.rowDir;
                col += dir.colDir;

                // Kiểm tra nếu vẫn còn trong bàn cờ
                if (row >= 0 && row < 6 && col >= 0 && col < 6) {
                    pieces.push({
                        piece: gameState.board[row][col],
                        position: { row, col }
                    });
                }
                break;
            }

            row += dir.rowDir;
            col += dir.colDir;
        }

        return pieces;
    }

    // Tìm nước thả quân tạo outpost (vị trí tiền đồn) - đặc biệt hiệu quả trên bàn 6x6
    private findOutpostDropMove(gameState: GameState): AIMove | null {
        const currentPlayer = gameState.currentPlayer;
        const pieceBank = gameState.pieceBank[currentPlayer];

        // Ưu tiên thả mã tạo outpost
        const knights = pieceBank.filter(p => p.type === PieceType.KNIGHT);
        if (knights.length === 0) return null;

        const knight = knights[0];
        const centerRows = currentPlayer === PieceColor.WHITE ? [3, 4] : [2, 1];
        const validDropSquares = getValidDropSquares(gameState, knight);

        // Tìm các ô trống ở trung tâm bàn cờ để thả mã
        const centerSquares = validDropSquares.filter(pos =>
            centerRows.includes(pos.row) && pos.col >= 1 && pos.col <= 4
        );

        if (centerSquares.length === 0) return null;

        // Tìm ô tốt nhất để thả mã tạo outpost
        for (const square of centerSquares) {
            // Kiểm tra xem ô này có được bảo vệ không
            let isProtected = false;

            // Kiểm tra bảo vệ từ các quân khác
            for (let row = 0; row < 6; row++) {
                for (let col = 0; col < 6; col++) {
                    const piece = gameState.board[row][col];
                    if (piece && piece.color === currentPlayer && !(row === square.row && col === square.col)) {
                        const validMoves = getValidMoves(gameState, { row, col });
                        if (validMoves.some(m => m.row === square.row && m.col === square.col)) {
                            isProtected = true;
                            break;
                        }
                    }
                }
                if (isProtected) break;
            }

            if (isProtected) {
                // Đây là một outpost tốt
                return {
                    piece: knight,
                    to: square,
                    score: 500,
                    isDropMove: true
                };
            }
        }

        // Nếu không tìm thấy outpost được bảo vệ, chọn vị trí trung tâm tốt nhất
        if (centerSquares.length > 0) {
            // Ưu tiên các ô ở hàng giữa (2-3)
            const bestSquares = centerSquares.filter(s => s.row === 2 || s.row === 3);
            if (bestSquares.length > 0) {
                return {
                    piece: knight,
                    to: bestSquares[0],
                    score: 400,
                    isDropMove: true
                };
            }

            return {
                piece: knight,
                to: centerSquares[0],
                score: 350,
                isDropMove: true
            };
        }

        return null;
    }

    // Tìm nước thả quân tạo battery (pin cùng chiều) - hiệu quả cao trên bàn 6x6
    private findBatteryDropMove(gameState: GameState): AIMove | null {
        const currentPlayer = gameState.currentPlayer;
        const opponentColor = currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;
        const pieceBank = gameState.pieceBank[currentPlayer];

        // Quân dài tầm có thể tạo battery
        const longRangePieces = pieceBank.filter(p =>
            p.type === PieceType.QUEEN || p.type === PieceType.ROOK || p.type === PieceType.BISHOP
        );

        if (longRangePieces.length === 0) return null;

        // Tìm các quân cờ cùng loại trên bàn
        for (const piece of longRangePieces) {
            const validDropSquares = getValidDropSquares(gameState, piece);

            // Tìm các quân cùng loại trên bàn
            for (let row = 0; row < 6; row++) {
                for (let col = 0; col < 6; col++) {
                    const boardPiece = gameState.board[row][col];

                    // Kiểm tra nếu là quân cùng loại và cùng màu
                    if (boardPiece && boardPiece.color === currentPlayer &&
                        (boardPiece.type === piece.type ||
                            (boardPiece.type === PieceType.QUEEN &&
                                (piece.type === PieceType.ROOK || piece.type === PieceType.BISHOP))
                        )) {

                        // Tìm các ô có thể thả để tạo battery
                        for (const dropPos of validDropSquares) {
                            // Tạo battery theo hàng ngang
                            if (dropPos.row === row) {
                                // Kiểm tra xem có quân của đối thủ trên cùng hàng không
                                let hasTarget = false;
                                const minCol = Math.min(col, dropPos.col);
                                const maxCol = Math.max(col, dropPos.col);

                                for (let c = 0; c < 6; c++) {
                                    // Kiểm tra các cột ngoài đoạn giữa hai quân
                                    if (c < minCol || c > maxCol) {
                                        const targetPiece = gameState.board[row][c];
                                        if (targetPiece && targetPiece.color === opponentColor) {
                                            hasTarget = true;
                                            break;
                                        }
                                    }
                                }

                                if (hasTarget) {
                                    return {
                                        piece,
                                        to: dropPos,
                                        score: 400,
                                        isDropMove: true
                                    };
                                }
                            }

                            // Tạo battery theo hàng dọc
                            if (dropPos.col === col) {
                                // Kiểm tra xem có quân của đối thủ trên cùng cột không
                                let hasTarget = false;
                                const minRow = Math.min(row, dropPos.row);
                                const maxRow = Math.max(row, dropPos.row);

                                for (let r = 0; r < 6; r++) {
                                    // Kiểm tra các hàng ngoài đoạn giữa hai quân
                                    if (r < minRow || r > maxRow) {
                                        const targetPiece = gameState.board[r][col];
                                        if (targetPiece && targetPiece.color === opponentColor) {
                                            hasTarget = true;
                                            break;
                                        }
                                    }
                                }

                                if (hasTarget) {
                                    return {
                                        piece,
                                        to: dropPos,
                                        score: 400,
                                        isDropMove: true
                                    };
                                }
                            }

                            // Tạo battery theo đường chéo (chỉ cho tượng và hậu)
                            if ((piece.type === PieceType.BISHOP || piece.type === PieceType.QUEEN) &&
                                (boardPiece.type === PieceType.BISHOP || boardPiece.type === PieceType.QUEEN)) {
                                const rowDiff = Math.abs(dropPos.row - row);
                                const colDiff = Math.abs(dropPos.col - col);

                                if (rowDiff === colDiff) {
                                    // Cùng đường chéo
                                    const rowDir = Math.sign(dropPos.row - row);
                                    const colDir = Math.sign(dropPos.col - col);

                                    // Kiểm tra các ô ngoài đoạn giữa hai quân
                                    let hasTarget = false;

                                    // Kiểm tra theo một hướng
                                    let r = row - rowDir;
                                    let c = col - colDir;
                                    while (r >= 0 && r < 6 && c >= 0 && c < 6) {
                                        const targetPiece = gameState.board[r][c];
                                        if (targetPiece && targetPiece.color === opponentColor) {
                                            hasTarget = true;
                                            break;
                                        }
                                        r -= rowDir;
                                        c -= colDir;
                                    }

                                    // Kiểm tra theo hướng còn lại
                                    r = dropPos.row + rowDir;
                                    c = dropPos.col + colDir;
                                    while (r >= 0 && r < 6 && c >= 0 && c < 6 && !hasTarget) {
                                        const targetPiece = gameState.board[r][c];
                                        if (targetPiece && targetPiece.color === opponentColor) {
                                            hasTarget = true;
                                            break;
                                        }
                                        r += rowDir;
                                        c += colDir;
                                    }

                                    if (hasTarget) {
                                        return {
                                            piece,
                                            to: dropPos,
                                            score: 400,
                                            isDropMove: true
                                        };
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return null;
    }

    // Tìm nước thả quân để khóa quân đối phương
    private findBlockingDropMove(gameState: GameState): AIMove | null {
        const currentPlayer = gameState.currentPlayer;
        const opponentColor = currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;
        const pieceBank = gameState.pieceBank[currentPlayer];

        if (pieceBank.length === 0) return null;

        // Ưu tiên thả mã vì mã có thể nhảy qua các quân khác
        const knights = pieceBank.filter(p => p.type === PieceType.KNIGHT);

        // Nếu không có mã, thử với các quân khác
        const pieces = knights.length > 0 ? knights : pieceBank;

        for (const piece of pieces) {
            const validDropSquares = getValidDropSquares(gameState, piece);

            // Đánh giá từng vị trí thả quân
            for (const dropPos of validDropSquares) {
                let blockingScore = 0;

                // Thử thả quân và kiểm tra ảnh hưởng đến quân đối phương
                const tempBoard = gameState.board.map(row => [...row]);
                tempBoard[dropPos.row][dropPos.col] = piece;

                // Đếm số quân bị hạn chế di chuyển sau khi thả
                for (let row = 0; row < 6; row++) {
                    for (let col = 0; col < 6; col++) {
                        const boardPiece = gameState.board[row][col];
                        if (boardPiece && boardPiece.color === opponentColor) {
                            // Đếm số nước đi trước khi thả
                            const movesBefore = getValidMoves(gameState, { row, col }).length;

                            // Đếm số nước đi sau khi thả
                            const tempGameState = {
                                ...gameState,
                                board: tempBoard,
                                currentPlayer: opponentColor
                            };
                            const movesAfter = getValidMoves(tempGameState, { row, col }).length;

                            // Tính điểm dựa trên số nước đi bị hạn chế
                            const diff = movesBefore - movesAfter;
                            if (diff > 0) {
                                // Thưởng nhiều hơn nếu khóa các quân giá trị cao
                                const pieceValue = PIECE_VALUES[boardPiece.type] / 100;
                                blockingScore += diff * pieceValue;
                            }
                        }
                    }
                }

                // Nếu tìm thấy vị trí thả quân làm hạn chế đáng kể đối thủ
                if (blockingScore >= 3) {
                    return {
                        piece,
                        to: dropPos,
                        score: 300 + blockingScore * 10,
                        isDropMove: true
                    };
                }
            }
        }

        return null;
    }

    // Thêm chiến lược thả quân đặc biệt cho tàn cuộc
    private getEndgameDropStrategy(gameState: GameState): AIMove | null {
        const phase = this.getGamePhase(gameState);
        if (phase !== 'endgame') return null;

        // Chỉ áp dụng trong tàn cuộc
        const currentPlayer = gameState.currentPlayer;
        const pieceBank = gameState.pieceBank[currentPlayer];
        const opponentColor = currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;

        // Tìm vị trí vua đối phương
        const opponentKingPos = opponentColor === PieceColor.WHITE ? this.whiteKingPos : this.blackKingPos;
        if (!opponentKingPos) return null;

        // 1. Kiểm tra xem có thể thả quân để tạo chiếu hết hay không
        const highValuePieces = pieceBank.filter(p =>
            p.type === PieceType.QUEEN || p.type === PieceType.ROOK || p.type === PieceType.KNIGHT
        );

        for (const piece of highValuePieces) {
            const validDropSquares = getValidDropSquares(gameState, piece);

            // Đánh giá từng ô có thể thả quân
            for (const dropPos of validDropSquares) {
                // Thử thả quân
                const tempBoard = gameState.board.map(row => [...row]);
                tempBoard[dropPos.row][dropPos.col] = piece;
                const tempGameState = {
                    ...gameState,
                    board: tempBoard,
                    currentPlayer: opponentColor, // Giả định lượt đối thủ
                    pieceBank: {
                        ...gameState.pieceBank,
                        [currentPlayer]: gameState.pieceBank[currentPlayer].filter(p => p !== piece)
                    }
                };

                // Kiểm tra xem đối thủ có bị chiếu hết không
                if (checkIfCheckmate(tempGameState)) {
                    return {
                        piece,
                        to: dropPos,
                        score: 10000,
                        isDropMove: true
                    };
                }
            }
        }

        // 2. Ưu tiên thả tốt ở vị trí có thể phong cấp
        const pawns = pieceBank.filter(p => p.type === PieceType.PAWN);
        if (pawns.length > 0) {
            const promotionRow = currentPlayer === PieceColor.WHITE ? 4 : 1; // Hàng trước khi phong cấp

            for (const pawn of pawns) {
                const validDropSquares = getValidDropSquares(gameState, pawn);

                // Tìm ô thuộc hàng trước khi phong cấp
                const promotionSquares = validDropSquares.filter(pos => pos.row === promotionRow);

                if (promotionSquares.length > 0) {
                    // Tìm ô an toàn nhất (không bị tấn công)
                    for (const square of promotionSquares) {
                        let isSafe = true;

                        // Kiểm tra xem ô này có bị tấn công không
                        for (let row = 0; row < 6; row++) {
                            for (let col = 0; col < 6; col++) {
                                const piece = gameState.board[row][col];
                                if (piece && piece.color === opponentColor) {
                                    const moves = getValidMoves(gameState, { row, col });
                                    if (moves.some(m => m.row === square.row && m.col === square.col)) {
                                        isSafe = false;
                                        break;
                                    }
                                }
                            }
                            if (!isSafe) break;
                        }

                        if (isSafe) {
                            return {
                                piece: pawn,
                                to: square,
                                score: 800,
                                isDropMove: true
                            };
                        }
                    }

                    // Nếu không có ô an toàn, vẫn thử thả tốt
                    return {
                        piece: pawn,
                        to: promotionSquares[0],
                        score: 500,
                        isDropMove: true
                    };
                }
            }
        }

        // 3. Thả quân để kiểm soát đường phong cấp của đối thủ
        const opponentPromotionRow = currentPlayer === PieceColor.WHITE ? 0 : 5;
        const opponentPrePromotionRow = currentPlayer === PieceColor.WHITE ? 1 : 4;

        // Tìm các ô trống ở hàng trước khi phong cấp của đối thủ
        const controlSquares = [];
        for (let col = 0; col < 6; col++) {
            if (gameState.board[opponentPrePromotionRow][col] === null) {
                controlSquares.push({ row: opponentPrePromotionRow, col });
            }
        }

        if (controlSquares.length > 0 && pieceBank.length > 0) {
            // Ưu tiên thả mã hoặc tượng để kiểm soát
            const controlPieces = pieceBank.filter(p =>
                p.type === PieceType.KNIGHT || p.type === PieceType.BISHOP || p.type === PieceType.QUEEN
            );

            if (controlPieces.length > 0) {
                const bestPiece = controlPieces[0];
                return {
                    piece: bestPiece,
                    to: controlSquares[0],
                    score: 300,
                    isDropMove: true
                };
            }
        }

        return null;
    }

    // Thêm phương thức cho phép tùy chỉnh hệ số thả quân từ bên ngoài
    public setDropTactics(tactics: Record<string, number>): void {
        // Cập nhật các hệ số DROP_TACTICS nếu được cung cấp
        for (const [key, value] of Object.entries(tactics)) {
            if (key in DROP_TACTICS) {
                (DROP_TACTICS as any)[key] = value;
            }
        }

        console.log('Đã cập nhật chiến thuật thả quân:', tactics);
    }

    // Thêm phương thức setDropPreference cho phép tùy chỉnh phong cách thả quân
    public setDropPreference(preference: 'normal' | 'aggressive' | 'defensive' | 'balanced'): void {
        switch (preference) {
            case 'aggressive':
                this.setDropTactics({
                    ATTACK_KING: 300,
                    ATTACK_UNDEFENDED: 250,
                    FORK_OPPORTUNITY: 280,
                    BLOCK_CHECK: 150,
                    GAIN_CENTER_CONTROL: 120,
                    PROTECT_PIECE: 80,
                    ADVANCED_POSITION: 120
                });
                break;

            case 'defensive':
                this.setDropTactics({
                    BLOCK_CHECK: 300,
                    PROTECT_PIECE: 280,
                    ATTACK_KING: 150,
                    ATTACK_UNDEFENDED: 120,
                    FORK_OPPORTUNITY: 130,
                    GAIN_CENTER_CONTROL: 200,
                    ADVANCED_POSITION: 70
                });
                break;

            case 'balanced':
                this.setDropTactics({
                    BLOCK_CHECK: 200,
                    PROTECT_PIECE: 180,
                    ATTACK_KING: 200,
                    ATTACK_UNDEFENDED: 180,
                    FORK_OPPORTUNITY: 190,
                    GAIN_CENTER_CONTROL: 170,
                    ADVANCED_POSITION: 100,
                    ENDGAME_PAWN_DROP: 200
                });
                break;

            case 'normal':
            default:
                // Sử dụng giá trị mặc định đã được định nghĩa
                this.setDropTactics(DROP_TACTICS);
                break;
        }

        console.log(`Đã thiết lập phong cách thả quân: ${preference}`);
    }

    // Thêm phương thức setHybridMode để bật/tắt chế độ hybrid
    public setHybridMode(enabled: boolean): void {
        this.useHybridMode = enabled;
        console.log(`Chế độ hybrid ${enabled ? 'đã được bật' : 'đã được tắt'}`);
    }

    // Phương thức cài đặt độ khó được tối ưu hóa
    setDifficulty(difficulty: 'easy' | 'medium' | 'hard' | 'grandmaster'): void {
        // Điều chỉnh độ sâu dựa trên độ khó
        switch (difficulty) {
            case 'easy':
                this.searchDepth = 1;
                break;
            case 'medium':
                this.searchDepth = 3; // Khớp với độ sâu 3 của Stockfish
                break;
            case 'hard':
                this.searchDepth = 4;
                break;
            case 'grandmaster':
                this.searchDepth = 5;
                break;
        }
        console.log(`Đã thiết lập độ khó cho ChessAI: ${difficulty}, độ sâu: ${this.searchDepth}`);
    }

    // Cải thiện findBestMove để tăng tốc phản hồi
    findBestMove(gameState: GameState): AIMove | null {
        this.updateKingPositions(gameState);
        if (gameState.moveHistory.length < 6) {
            const openingMove = this.getOpeningMove(gameState);
            if (openingMove) return openingMove;
        }

        this.transpositionTable.clear();
        this.killerMoves = Array(100).fill(0).map(() => []);

        // Lấy tất cả nước đi hợp lệ và sắp xếp chúng
        const moves = this.orderMoves(
            this.getAllValidMoves(gameState, gameState.currentPlayer),
            gameState
        );

        if (moves.length === 0) return null;

        // Giảm thời gian xử lý tối đa
        const MAX_TIME_MS = isKingInCheck(gameState) ? 800 : 500;
        const startTime = performance.now();

        // Đánh dấu trạng thái game đang được AI tính toán
        const aiGameState = {
            ...gameState,
            isAiCalculating: true
        };

        let bestMove: AIMove | null = null;
        let bestScore = gameState.currentPlayer === PieceColor.WHITE ? -Infinity : Infinity;

        // Sử dụng độ sâu tìm kiếm từ thuộc tính searchDepth
        let depth = this.searchDepth;

        // Tăng độ sâu trong các tình huống đặc biệt
        const hasHighValueCapture = moves.some(
            move => move.capturedPiece &&
                PIECE_VALUES[move.capturedPiece.type] >= PIECE_VALUES[PieceType.ROOK]
        );

        if (isKingInCheck(gameState) || hasHighValueCapture) {
            depth += 1; // Tăng độ sâu trong các tình huống quan trọng
        }

        // Tối ưu: Tạo điều kiện dừng sớm nếu chỉ có 1 nước có thể đi
        if (moves.length === 1) {
            console.log("Chỉ có 1 nước đi, trả về ngay lập tức");
            return moves[0];
        }

        // Tối ưu: Giảm độ sâu tìm kiếm khi có quá nhiều nước đi
        if (moves.length > 20) {
            depth = Math.max(1, depth - 1);
        }

        // Tối ưu hóa tìm kiếm lặp sâu dần với thời gian giới hạn
        let iterationDepth = 1;
        while (iterationDepth <= depth && performance.now() - startTime < MAX_TIME_MS) {
            let currentBestMove: AIMove | null = null;
            let currentBestScore = gameState.currentPlayer === PieceColor.WHITE ? -Infinity : Infinity;

            // Chỉ xem xét top 5 nước đi khi độ sâu > 2 để tăng tốc
            const movesToSearch = iterationDepth > 2 ? moves.slice(0, 5) : moves;

            for (const move of movesToSearch) {
                const newState = this.applyMove(aiGameState, move);
                const score = this.minimax(
                    newState,
                    iterationDepth - 1,
                    -Infinity,
                    Infinity,
                    gameState.currentPlayer === PieceColor.BLACK
                );

                if (gameState.currentPlayer === PieceColor.WHITE) {
                    if (score > currentBestScore) {
                        currentBestScore = score;
                        currentBestMove = move;
                    }
                } else {
                    if (score < currentBestScore) {
                        currentBestScore = score;
                        currentBestMove = move;
                    }
                }
            }

            if (currentBestMove) {
                bestMove = currentBestMove;
                bestScore = currentBestScore;
            }

            iterationDepth++;
        }

        const endTime = performance.now();
        console.log(`AI thinking time: ${Math.round(endTime - startTime)}ms, độ sâu đạt được: ${iterationDepth - 1}, chọn nước với điểm: ${bestScore}`);

        // Tối ưu: Nếu đã có nước tốt nhất và gần hết thời gian, trả về ngay
        if (bestMove && endTime - startTime > MAX_TIME_MS * 0.8) {
            return bestMove;
        }

        // Ưu tiên thả quân nếu có cùng điểm số (và chế độ hybrid được bật)
        if (this.useHybridMode && bestMove && bestMove.from) {
            const dropMoves = moves.filter(m => !m.from && m.piece);
            // Tìm nước thả quân trong top 3 nước
            const bestDropMove = dropMoves.find((m, index) => index < 3 &&
                Math.abs((m.score - bestScore) / bestScore) < 0.05 // Trong phạm vi 5% điểm tốt nhất
            );

            if (bestDropMove) {
                console.log("Chọn thả quân thay vì di chuyển quân do có điểm số tương đương");
                bestMove = bestDropMove;
            }
        }

        return bestMove || moves[0];
    }

    // Cải thiện getAllValidMoves để đánh dấu nước thả quân
    private getAllValidMoves(gameState: GameState, color: PieceColor): AIMove[] {
        const moves: AIMove[] = [];

        // Thêm tất cả nước đi thông thường
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece.color === color) {
                    const validMoves = getValidMoves(gameState, { row, col });
                    validMoves.forEach(to => {
                        moves.push({
                            from: { row, col },
                            to,
                            piece,
                            score: 0,
                            capturedPiece: gameState.board[to.row][to.col] || undefined,
                            isDropMove: false
                        });
                    });
                }
            }
        }

        // Thêm tất cả nước thả quân
        gameState.pieceBank[color].forEach(piece => {
            getValidDropSquares(gameState, piece).forEach(to => {
                moves.push({
                    to,
                    piece,
                    score: 0,
                    isDropMove: true
                });
            });
        });

        return moves;
    }

    // Cải thiện orderMoves để ưu tiên nước thả quân trong một số tình huống
    private orderMoves(moves: AIMove[], gameState: GameState): AIMove[] {
        return moves.map(move => {
            let score = 0;

            // Đánh giá nước đi thông thường
            if (move.capturedPiece) {
                const victimValue = PIECE_VALUES[move.capturedPiece.type];
                const aggressorValue = move.piece ? PIECE_VALUES[move.piece.type] : 0;
                score += victimValue * 100 - aggressorValue; // MVV-LVA
            }

            // Đánh giá nước thả quân
            if (move.isDropMove && move.piece) {
                // Áp dụng chiến thuật thả quân nâng cao
                score += this.evaluateDropMove(gameState, move);

                // Thêm điểm cho vị trí thả quân cơ bản
                score += DROP_POSITION_VALUES[move.piece.type][move.to.row][move.to.col] * 0.5;
            }

            // Đánh giá chung cho cả hai loại nước đi
            const newState = this.applyMove(gameState, move);
            if (isKingInCheck(newState)) {
                score += 100; // Thưởng cho nước chiếu vua
            }

            if (isKingInCheck(gameState) && !isKingInCheck(newState)) {
                score += 200; // Thưởng cho nước thoát chiếu
            }

            move.score = score;
            return move;
        }).sort((a, b) => b.score - a.score);
    }
}

export default ChessAI;