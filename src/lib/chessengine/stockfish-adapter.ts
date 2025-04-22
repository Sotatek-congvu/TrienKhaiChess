import { ChessPiece, GameState, PieceColor, PieceType, Position, algebraicToPosition, positionToAlgebraic } from "../chess-models";

// Interface mô tả bàn cờ 8x8 tiêu chuẩn cho Stockfish
interface StandardBoard {
    board: (ChessPiece | null)[][];
    currentPlayer: PieceColor;
    castlingRights: {
        whiteKingside: boolean;
        whiteQueenside: boolean;
        blackKingside: boolean;
        blackQueenside: boolean;
    };
    enPassantTarget: Position | null;
    halfMoveClock: number;
    fullMoveNumber: number;
}

// Interface cho các thông tin nước thả quân
interface DropInfo {
    piece: ChessPiece;
    to: Position;
}

// Interface cho các thông tin nước đi thông thường
interface MoveInfo {
    from: Position;
    to: Position;
}

// Lớp adapter giúp chuyển đổi giữa bàn cờ 6x6 và định dạng 8x8 tiêu chuẩn
export class StockfishAdapter {
    // Chuyển đổi bàn cờ 6x6 sang định dạng FEN cho bàn 8x8 mà Stockfish hiểu được
    static toFEN(gameState: GameState): string {
        const { board } = gameState;
        const rows = [];

        // Phần thêm vào: tạo phiên bản bàn cờ mở rộng 8x8 với biên trống
        const expandedBoard: (ChessPiece | null)[][] = Array(8).fill(0).map(() => Array(8).fill(null));

        // Sao chép bàn cờ 6x6 vào giữa bàn cờ 8x8
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                expandedBoard[row + 1][col + 1] = board[row][col];
            }
        }

        // Thêm thông tin về quân trong ngân hàng để Stockfish có thể đánh giá
        // Chúng ta đặt quân ảo ở hàng trên cùng và hàng dưới cùng với ký hiệu đặc biệt
        for (const piece of gameState.pieceBank[PieceColor.WHITE]) {
            // Tìm một ô trống ở hàng dưới
            for (let col = 0; col < 8; col++) {
                if (expandedBoard[7][col] === null) {
                    // Đặt quân trong ngân hàng trắng ở hàng dưới cùng
                    expandedBoard[7][col] = piece;
                    break;
                }
            }
        }

        for (const piece of gameState.pieceBank[PieceColor.BLACK]) {
            // Tìm một ô trống ở hàng trên
            for (let col = 0; col < 8; col++) {
                if (expandedBoard[0][col] === null) {
                    // Đặt quân trong ngân hàng đen ở hàng trên cùng
                    expandedBoard[0][col] = piece;
                    break;
                }
            }
        }

        // Tạo FEN từ bàn cờ mở rộng
        for (let row = 7; row >= 0; row--) {
            let rowString = '';
            let emptyCount = 0;

            for (let col = 0; col < 8; col++) {
                const piece = expandedBoard[row][col];

                if (piece) {
                    if (emptyCount > 0) {
                        rowString += emptyCount;
                        emptyCount = 0;
                    }

                    let pieceChar = '';
                    switch (piece.type) {
                        case PieceType.PAWN: pieceChar = 'p'; break;
                        case PieceType.KNIGHT: pieceChar = 'n'; break;
                        case PieceType.BISHOP: pieceChar = 'b'; break;
                        case PieceType.ROOK: pieceChar = 'r'; break;
                        case PieceType.QUEEN: pieceChar = 'q'; break;
                        case PieceType.KING: pieceChar = 'k'; break;
                    }

                    if (piece.color === PieceColor.WHITE) {
                        pieceChar = pieceChar.toUpperCase();
                    }

                    rowString += pieceChar;
                } else {
                    emptyCount++;
                }
            }

            if (emptyCount > 0) {
                rowString += emptyCount;
            }

            rows.push(rowString);
        }

        // Ghép thành FEN
        let fen = rows.join('/');

        // Thêm các thông tin khác trong FEN
        fen += ' ' + (gameState.currentPlayer === PieceColor.WHITE ? 'w' : 'b');
        fen += ' - - 0 1';

        return fen;
    }

    // Kiểm tra xem nước đi có phải là thả quân không
    static isDropMove(moveStr: string, gameState: GameState): boolean {
        const from = moveStr.substring(0, 2);
        const to = moveStr.substring(2, 4);

        // Nếu điểm xuất phát nằm ngoài bàn cờ 6x6 hoặc là ký hiệu thả quân
        if (from.includes('d') || from === 'a7' || from === 'a8' || from === 'a0' || from === 'h7' || from === 'h8') {
            return true;
        }

        // Chuyển đổi sang tọa độ bàn cờ để kiểm tra
        const fromRow = 8 - parseInt(from[1]);
        const fromCol = from.charCodeAt(0) - 'a'.charCodeAt(0);

        // Nếu vị trí xuất phát nằm ngoài phạm vi 6x6 của bàn cờ
        if (fromRow < 1 || fromRow > 6 || fromCol < 1 || fromCol > 6) {
            return true;
        }

        return false;
    }

    // Tìm quân thích hợp để thả
    static findPieceForDrop(moveStr: string, gameState: GameState): { piece: ChessPiece, to: Position } | null {
        const to = moveStr.substring(2, 4);
        const promotion = moveStr.length > 4 ? moveStr[4] : undefined;

        // Chuyển đổi "to" sang tọa độ bàn cờ
        const toRow = 8 - parseInt(to[1]) - 1; // Điều chỉnh để phù hợp với bàn cờ 6x6
        const toCol = to.charCodeAt(0) - 'a'.charCodeAt(0) - 1; // Điều chỉnh để phù hợp với bàn cờ 6x6

        // Kiểm tra xem tọa độ đích có hợp lệ không
        if (toRow < 0 || toRow >= 6 || toCol < 0 || toCol >= 6) {
            return null;
        }

        const pieceType = this.determinePieceTypeFromMove(moveStr);
        if (!pieceType) return null;

        // Tìm kiếm trong ngân hàng quân của người chơi hiện tại
        const playerBank = gameState.pieceBank[gameState.currentPlayer];
        for (const piece of playerBank) {
            if (piece.type === pieceType) {
                return {
                    piece,
                    to: { row: toRow, col: toCol }
                };
            }
        }

        return null;
    }

    // Xác định loại quân từ nước đi
    private static determinePieceTypeFromMove(moveStr: string): PieceType | null {
        // Lấy ký tự đầu tiên của vị trí xuất phát (có thể là ký hiệu quân cờ)
        const from = moveStr.substring(0, 2);
        const promotion = moveStr.length > 4 ? moveStr[4] : undefined;

        // Nếu có ký tự phong cấp, ưu tiên sử dụng nó
        if (promotion) {
            switch (promotion.toLowerCase()) {
                case 'q': return PieceType.QUEEN;
                case 'r': return PieceType.ROOK;
                case 'b': return PieceType.BISHOP;
                case 'n': return PieceType.KNIGHT;
                default: return PieceType.PAWN;
            }
        }

        // Phân tích ký tự đầu tiên để xác định loại quân
        if (from.startsWith('N') || from.startsWith('n')) return PieceType.KNIGHT;
        if (from.startsWith('B') || from.startsWith('b')) return PieceType.BISHOP;
        if (from.startsWith('R') || from.startsWith('r')) return PieceType.ROOK;
        if (from.startsWith('Q') || from.startsWith('q')) return PieceType.QUEEN;
        if (from.startsWith('K') || from.startsWith('k')) return PieceType.KING;

        // Mặc định là tốt nếu không xác định được
        return PieceType.PAWN;
    }

    // Xử lý nước đi từ Stockfish cho bàn cờ 6x6
    static processStockfishMove(moveStr: string, gameState: GameState): { from: Position, to: Position } | null {
        const from = moveStr.substring(0, 2);
        const to = moveStr.substring(2, 4);

        // Chuyển đổi sang tọa độ bàn cờ 6x6
        const fromRow = 8 - parseInt(from[1]) - 1;
        const fromCol = from.charCodeAt(0) - 'a'.charCodeAt(0) - 1;
        const toRow = 8 - parseInt(to[1]) - 1;
        const toCol = to.charCodeAt(0) - 'a'.charCodeAt(0) - 1;

        // Kiểm tra xem tọa độ có hợp lệ không
        if (fromRow < 0 || fromRow >= 6 || fromCol < 0 || fromCol >= 6 ||
            toRow < 0 || toRow >= 6 || toCol < 0 || toCol >= 6) {
            return null;
        }

        return {
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol }
        };
    }

    // Điều chỉnh độ sâu tìm kiếm cho bàn cờ 6x6
    static getAdjustedSearchDepth(originalDepth: number): number {
        // Tăng độ sâu cho bàn 6x6 vì ít phức tạp hơn
        return originalDepth + Math.floor(originalDepth / 5);
    }

    // Điều chỉnh thời gian tìm kiếm cho bàn cờ 6x6
    static getAdjustedSearchTime(originalTime: number): number {
        // Giảm thời gian cho bàn nhỏ hơn, nhưng bảo đảm tối thiểu 500ms
        return Math.max(500, Math.floor(originalTime * 0.8));
    }

    // PHẦN MỚI: Tính toán giá trị của việc thả quân cho Stockfish
    static evaluateDropValue(pieceType: PieceType, position: Position, gameState: GameState): number {
        let value = 0;

        // Giá trị cơ bản của quân
        switch (pieceType) {
            case PieceType.QUEEN: value = 900; break;
            case PieceType.ROOK: value = 500; break;
            case PieceType.BISHOP: value = 330; break;
            case PieceType.KNIGHT: value = 320; break;
            case PieceType.PAWN: value = 100; break;
            default: value = 0;
        }

        // Đánh giá vị trí (trung tâm tốt hơn)
        const centerBonus = this.calculateCenterBonus(position);
        value += centerBonus;

        // Đánh giá khả năng tấn công sau khi thả
        const attackBonus = this.calculateAttackPotential(pieceType, position);
        value += attackBonus;

        // Đánh giá gần vua đối phương
        const kingProximityBonus = this.calculateKingProximityBonus(position, gameState);
        value += kingProximityBonus;

        return value;
    }

    // Đánh giá vị trí so với trung tâm
    private static calculateCenterBonus(position: Position): number {
        // Tính khoảng cách Manhattan đến trung tâm (2.5, 2.5)
        const distanceToCenter = Math.abs(position.row - 2.5) + Math.abs(position.col - 2.5);

        // Vị trí càng gần trung tâm càng tốt
        return Math.max(0, 30 - distanceToCenter * 10);
    }

    // Đánh giá khả năng tấn công dựa trên loại quân và vị trí
    private static calculateAttackPotential(pieceType: PieceType, position: Position): number {
        let potential = 0;

        // Đánh giá khả năng di chuyển của quân trên bàn cờ từ vị trí này
        switch (pieceType) {
            case PieceType.QUEEN:
                // Hậu có nhiều hướng di chuyển và phạm vi rộng
                potential = 50;
                break;
            case PieceType.ROOK:
                // Xe kiểm soát hàng và cột tốt
                potential = 40;
                break;
            case PieceType.BISHOP:
                // Tượng di chuyển chéo
                potential = 30;
                break;
            case PieceType.KNIGHT:
                // Mã có thể nhảy qua quân khác
                potential = 35;

                // Mã ở trung tâm mạnh hơn nhiều
                if (position.row >= 1 && position.row <= 4 && position.col >= 1 && position.col <= 4) {
                    potential += 15;
                }
                break;
            case PieceType.PAWN:
                // Tốt ở hàng gần phong cấp có giá trị cao
                if (position.row === 1 || position.row === 4) {
                    potential = 25;
                } else {
                    potential = 15;
                }
                break;
        }

        return potential;
    }

    // Đánh giá vị trí tương đối với vua đối phương
    private static calculateKingProximityBonus(position: Position, gameState: GameState): number {
        let kingPos: Position | null = null;
        const currentPlayer = gameState.currentPlayer;
        const opponentColor = currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;

        // Tìm vị trí vua đối phương
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 6; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece.type === PieceType.KING && piece.color === opponentColor) {
                    kingPos = { row, col };
                    break;
                }
            }
            if (kingPos) break;
        }

        if (!kingPos) return 0;

        // Tính khoảng cách đến vua đối phương
        const distance = Math.max(
            Math.abs(position.row - kingPos.row),
            Math.abs(position.col - kingPos.col)
        );

        // Thưởng điểm cho vị trí gần vua đối phương
        return Math.max(0, 40 - distance * 10);
    }

    // Đánh giá có nên thả quân ở vị trí này hay không
    static shouldPreferDrop(pieceType: PieceType, position: Position, gameState: GameState): boolean {
        // Lấy giá trị của việc thả quân
        const dropValue = this.evaluateDropValue(pieceType, position, gameState);

        // Nếu giá trị cao, nên ưu tiên thả quân
        return dropValue > 300;
    }

    // Phần bổ sung: thêm các phương thức cần thiết cho tương thích interface 

    // Khởi tạo adapter
    initialize() {
        console.log('Initializing StockfishAdapter');
        // Khởi tạo các tài nguyên cần thiết
    }

    // Thực hiện nước đi sử dụng các phương thức tĩnh của lớp
    async makeMove(gameState: GameState): Promise<GameState> {
        try {
            // Tìm nước tốt nhất của AI
            const bestMove = await this.findBestMove(gameState);

            if (!bestMove) {
                console.warn('No valid move found');
                return gameState;
            }

            if (StockfishAdapter.isDropMove(bestMove, gameState)) {
                // Xử lý nước thả quân
                const dropInfo = StockfishAdapter.findPieceForDrop(bestMove, gameState);
                if (dropInfo && dropInfo.piece && dropInfo.to) {
                    // Sử dụng các hàm từ chess-logic
                    const { dropPiece } = await import('../chess-logic');
                    return dropPiece(gameState, dropInfo.piece, dropInfo.to);
                }
            } else {
                // Xử lý nước đi thông thường
                const moveInfo = StockfishAdapter.processStockfishMove(bestMove, gameState);
                if (moveInfo && moveInfo.from && moveInfo.to) {
                    // Sử dụng các hàm từ chess-logic
                    const { makeMove } = await import('../chess-logic');
                    return makeMove(gameState, moveInfo.from, moveInfo.to);
                }
            }

            return gameState;
        } catch (error) {
            console.error('Error in StockfishAdapter.makeMove:', error);
            return gameState;
        }
    }

    // Tìm kiếm nước đi tốt nhất (đây là một phương thức giả lập)
    private async findBestMove(gameState: GameState): Promise<string> {
        // Ở đây bạn có thể thêm logic liên kết với engine Stockfish thật sự
        // Hiện tại chúng ta chỉ trả về một giá trị giả để có thể biên dịch
        const from = positionToAlgebraic({ row: 0, col: 0 });
        const to = positionToAlgebraic({ row: 2, col: 0 });
        return from + to;
    }

    // Dừng adapter
    stop() {
        console.log('Stopping StockfishAdapter');
        // Giải phóng tài nguyên nếu cần
    }
}