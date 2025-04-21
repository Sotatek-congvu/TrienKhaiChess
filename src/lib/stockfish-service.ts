import { GameState, PieceType, PieceColor, Position, positionToAlgebraic, algebraicToPosition, ChessPiece } from './chess-models';
import { makeMove, dropPiece, isKingInCheck } from './chess-logic';
import ChessAI from './chess-ai'; // Import the existing AI as fallback
import { createStockfishWorker } from './stockfish-worker';
import { StockfishAdapter } from './stockfish-adapter';

export interface StockfishMove {
    from: string; // algebraic notation (e.g., 'e2')
    to: string;   // algebraic notation (e.g., 'e4')
    promotion?: string; // e.g., 'q' for queen
}

// Định nghĩa các cấp độ khó
export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'grandmaster';

type DropPreference = 'normal' | 'aggressive' | 'defensive' | 'balanced';

export class StockfishService {
    private engine: Worker | null = null;
    private isReady: boolean = false;
    private moveTimeout: number = 1500; // Giảm từ 10000ms xuống 1500ms
    private searchDepth: number = 18;  // Giảm từ 40 xuống 18
    private resolveMove: ((move: StockfishMove | null) => void) | null = null;
    private skillLevel: number = 20; // Mức kỹ năng cao nhất
    private fallbackAI: ChessAI | null = null; // Add fallback AI property
    private multiPV: number = 4; // Giảm từ 8 xuống 4
    private contempt: number = 0; // Chơi khách quan nhất
    private threads: number = Math.max(navigator.hardwareConcurrency || 4, 6); // Giảm số luồng tối thiểu
    private hashSize: number = 512; // Giảm từ 1024MB xuống 512MB
    private useAdaptedBoard: boolean = true; // Sử dụng StockfishAdapter cho bàn 6x6
    private dropPreference: DropPreference = 'balanced';
    private adapter: StockfishAdapter;
    private chessAI: ChessAI;

    constructor() {
        this.adapter = new StockfishAdapter();
        this.chessAI = new ChessAI();
        this.initEngine();
        this.adapter.initialize();
    }

    private async initEngine() {
        try {
            console.log('Initializing Stockfish engine...');
            // Try to initialize Stockfish as a WebWorker
            this.engine = await createStockfishWorker().catch(err => {
                console.error('Failed to initialize Stockfish worker:', err);
                return null;
            });

            if (this.engine) {
                console.log('Stockfish engine created successfully, setting up...');
                this.setupEngine();
            } else {
                console.warn('Stockfish is not available, using fallback AI');
                this.fallbackAI = new ChessAI();
                this.isReady = true; // Mark as ready even though using fallback
            }
        } catch (error) {
            console.error('Lỗi khởi tạo Stockfish, using fallback AI:', error);
            this.fallbackAI = new ChessAI();
            this.isReady = true; // Mark as ready even though using fallback
        }
    }

    private setupEngine(): void {
        if (!this.engine) return;

        this.engine.onmessage = (event: MessageEvent) => {
            const message = event.data;
            console.log('Stockfish:', message);

            if (message === 'readyok') {
                this.isReady = true;
                console.log('Stockfish engine is ready');
            }

            // Xử lý best move từ Stockfish
            if (message.startsWith('bestmove')) {
                const moveStr = message.split(' ')[1];
                if (moveStr && this.resolveMove) {
                    const from = moveStr.substring(0, 2);
                    const to = moveStr.substring(2, 4);
                    const promotion = moveStr.length > 4 ? moveStr.substring(4, 5) : undefined;

                    this.resolveMove({ from, to, promotion });
                    this.resolveMove = null;
                }
            }
        };

        // Khởi tạo engine với cấu hình nâng cao
        this.sendCommand('uci');

        // Cấu hình nâng cao
        this.sendCommand('setoption name MultiPV value ' + this.multiPV);
        this.sendCommand('setoption name Contempt value ' + this.contempt);
        this.sendCommand('setoption name Threads value ' + this.threads);
        this.sendCommand('setoption name Hash value ' + this.hashSize);

        // Cấu hình chơi thông minh nhưng không hoàn hảo
        this.sendCommand('setoption name Skill Level value ' + this.skillLevel);
        this.sendCommand('setoption name Slow Mover value 80'); // Cẩn thận hơn, ít sai sót hơn

        this.sendCommand('isready');
        this.setMaxDifficulty(); // Luôn sử dụng độ khó cao nhất
    }

    private sendCommand(command: string): void {
        if (this.engine) {
            console.log('Gửi lệnh:', command);
            this.engine.postMessage(command);
        }
    }

    // Chuyển đổi bàn cờ của chúng ta sang định dạng FEN cho Stockfish
    private boardToFen(gameState: GameState): string {
        if (this.useAdaptedBoard) {
            // Sử dụng StockfishAdapter để chuyển đổi bàn cờ 6x6 thành FEN tối ưu hơn
            return StockfishAdapter.toFEN(gameState);
        }

        // Phương thức cũ nếu không sử dụng adapter (chỉ dành cho tương thích ngược)
        const { board } = gameState;
        const rows = [];

        // Chuyển đổi bàn cờ 6x6 thành ký hiệu FEN
        for (let row = 5; row >= 0; row--) {
            let rowString = '';
            let emptyCount = 0;

            for (let col = 0; col < 6; col++) {
                const piece = board[row][col];

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
        fen += ' - - 0 1'; // Không hỗ trợ nhập thành, no en passant, halfmove clock, fullmove number

        return fen;
    }

    // Chỉ giữ một cấp độ khó nhất với tất cả thông số được tối ưu hóa
    public setMaxDifficulty(): void {
        this.skillLevel = 20;
        this.moveTimeout = 1500;
        this.searchDepth = 18;
        this.multiPV = 4;
        this.contempt = 0;
        this.threads = Math.max(navigator.hardwareConcurrency || 4, 6);
        this.hashSize = 512;

        this.sendCommand(`setoption name Skill Level value ${this.skillLevel}`);
        this.sendCommand(`setoption name MultiPV value ${this.multiPV}`);
        this.sendCommand(`setoption name Contempt value ${this.contempt}`);
        this.sendCommand(`setoption name Threads value ${this.threads}`);
        this.sendCommand(`setoption name Hash value ${this.hashSize}`);

        this.sendCommand('setoption name Ponder value false');
        this.sendCommand('setoption name Slow Mover value 70');
        this.sendCommand('setoption name Move Overhead value 30');
        this.sendCommand('setoption name Minimum Thinking Time value 200');

        console.log(`Đã thiết lập AI ở tốc độ tối ưu: độ sâu ${this.searchDepth}, thời gian ${this.moveTimeout}ms, ${this.threads} luồng`);

        if (this.fallbackAI) {
            this.fallbackAI.setDifficulty('grandmaster');
            this.fallbackAI.setHybridMode(true);
        }

        this.chessAI.setDifficulty('grandmaster');
    }

    // Lấy nước đi tốt nhất từ Stockfish
    public getBestMove(gameState: GameState): Promise<StockfishMove | null> {
        return new Promise((resolve, reject) => {
            if (!this.isReady) {
                console.error('Stockfish chưa sẵn sàng');
                resolve(null);
                return;
            }

            this.resolveMove = resolve;

            const fen = this.boardToFen(gameState);

            const piecesOnBoard = this.countPiecesOnBoard(gameState.board);

            let adjustedDepth = this.searchDepth;
            let adjustedTime = this.moveTimeout;

            if (piecesOnBoard <= 6) {
                adjustedDepth = Math.min(22, this.searchDepth + 4);
                adjustedTime = this.moveTimeout * 0.8;
            } else if (piecesOnBoard >= 12) {
                adjustedDepth = Math.max(12, this.searchDepth - 6);
                adjustedTime = this.moveTimeout * 0.7;
            }

            if (isKingInCheck(gameState)) {
                adjustedTime = Math.min(1000, adjustedTime);
            }

            const colorToMove = gameState.currentPlayer === PieceColor.WHITE ? 'w' : 'b';
            const timeRemaining = adjustedTime * 2;
            const movesToGo = 10;

            this.sendCommand(
                `go depth ${adjustedDepth} ` +
                `movetime ${adjustedTime} ` +
                `${colorToMove}time ${timeRemaining} ` +
                `${colorToMove === 'w' ? 'b' : 'w'}time ${timeRemaining} ` +
                `movestogo ${movesToGo} ` +
                `nodes 3000000`
            );

            setTimeout(() => {
                if (this.resolveMove) {
                    this.sendCommand('stop');
                }
            }, adjustedTime + 500);
        });
    }

    private countPiecesOnBoard(board: (ChessPiece | null)[][]): number {
        let count = 0;
        for (let row = 0; row < board.length; row++) {
            for (let col = 0; col < board[row].length; col++) {
                if (board[row][col] !== null) {
                    count++;
                }
            }
        }
        return count;
    }

    public async makeMove(gameState: GameState): Promise<GameState> {
        try {
            if (this.useAdaptedBoard) {
                const move = this.chessAI.findBestMove(gameState);
                if (move) {
                    if (move.from && move.to) {
                        const { makeMove } = await import('./chess-logic');
                        return makeMove(gameState, move.from, move.to);
                    } else if (move.piece && move.to) {
                        const { dropPiece } = await import('./chess-logic');
                        return dropPiece(gameState, move.piece, move.to);
                    }
                }
            } else {
                return await this.adapter.makeMove(gameState);
            }

            console.warn('No valid move found, returning current game state');
            return gameState;
        } catch (error) {
            console.error('Error making AI move:', error);
            return gameState;
        }
    }

    public setUseAdaptedBoard(enabled: boolean): void {
        this.useAdaptedBoard = enabled;
        console.log(`${enabled ? 'Bật' : 'Tắt'} chế độ chuyển đổi bàn cờ 6x6->8x8`);
    }

    public setDropPreference(preference: DropPreference): void {
        this.dropPreference = preference;

        switch (preference) {
            case 'aggressive':
                this.configureAggressiveDrops();
                break;
            case 'defensive':
                this.configureDefensiveDrops();
                break;
            case 'balanced':
                this.configureBalancedDrops();
                break;
            default:
                break;
        }
    }

    private configureAggressiveDrops(): void {
        // Cấu hình cho chiến thuật thả quân tấn công
        if (this.fallbackAI) {
            // Điều chỉnh hệ số cho AI dự phòng
            try {
                // Ưu tiên thả quân để tạo đe dọa và tấn công
                const DROP_TACTICS = {
                    ATTACK_KING: 300,         // Tăng mạnh ưu tiên thả quân để tấn công vua
                    ATTACK_UNDEFENDED: 250,    // Tăng mạnh ưu tiên tấn công quân không được bảo vệ
                    FORK_OPPORTUNITY: 280,     // Tăng ưu tiên thả quân tạo fork
                    BLOCK_CHECK: 150,          // Giảm ưu tiên chặn chiếu (vẫn cần để phòng thủ)
                    GAIN_CENTER_CONTROL: 120,  // Tăng nhẹ kiểm soát trung tâm
                    PROTECT_PIECE: 80,         // Giảm ưu tiên bảo vệ quân
                    ADVANCED_POSITION: 120     // Tăng ưu tiên thả quân ở vị trí tiến sâu
                };

                // Áp dụng cấu hình (chúng ta giả định fallbackAI có phương thức setDropTactics)
                // Trong thực tế, cần thêm phương thức này vào ChessAI
                if ('setDropTactics' in this.fallbackAI) {
                    (this.fallbackAI as any).setDropTactics(DROP_TACTICS);
                }

                // Đặt chế độ hybrid thành true để đảm bảo sử dụng thả quân
                this.fallbackAI.setHybridMode(true);
            } catch (error) {
                console.error('Lỗi khi cấu hình aggressive drops:', error);
            }
        }

        // Áp dụng cấu hình tương tự cho AI chính
        try {
            // Đặt chế độ hybrid thành true và tăng tỉ lệ ưu tiên thả quân
            this.chessAI.setHybridMode(true);

            // Trong thực tế, chúng ta cần thêm setDropPreference vào ChessAI
            if ('setDropPreference' in this.chessAI) {
                (this.chessAI as any).setDropPreference('aggressive');
            }
        } catch (error) {
            console.error('Lỗi khi cấu hình aggressive drops cho AI chính:', error);
        }

        console.log("Đã cấu hình AI cho chiến thuật thả quân tấn công");
    }

    private configureDefensiveDrops(): void {
        // Cấu hình cho chiến thuật thả quân phòng thủ
        if (this.fallbackAI) {
            try {
                // Ưu tiên thả quân để phòng thủ
                const DROP_TACTICS = {
                    BLOCK_CHECK: 300,          // Tăng mạnh ưu tiên chặn chiếu
                    PROTECT_PIECE: 280,        // Tăng mạnh ưu tiên bảo vệ quân
                    ATTACK_KING: 150,          // Giảm ưu tiên tấn công vua
                    ATTACK_UNDEFENDED: 120,    // Giảm ưu tiên tấn công quân không được bảo vệ 
                    FORK_OPPORTUNITY: 130,     // Giảm ưu tiên thả quân tạo fork
                    GAIN_CENTER_CONTROL: 200,  // Tăng kiểm soát trung tâm để kiểm soát bàn cờ
                    ADVANCED_POSITION: 70      // Giảm ưu tiên thả quân ở vị trí tiến sâu
                };

                // Áp dụng cấu hình
                if ('setDropTactics' in this.fallbackAI) {
                    (this.fallbackAI as any).setDropTactics(DROP_TACTICS);
                }

                this.fallbackAI.setHybridMode(true);
            } catch (error) {
                console.error('Lỗi khi cấu hình defensive drops:', error);
            }
        }

        // Áp dụng cấu hình tương tự cho AI chính
        try {
            this.chessAI.setHybridMode(true);
            if ('setDropPreference' in this.chessAI) {
                (this.chessAI as any).setDropPreference('defensive');
            }
        } catch (error) {
            console.error('Lỗi khi cấu hình defensive drops cho AI chính:', error);
        }

        console.log("Đã cấu hình AI cho chiến thuật thả quân phòng thủ");
    }

    private configureBalancedDrops(): void {
        // Cấu hình cho chiến thuật thả quân cân bằng
        if (this.fallbackAI) {
            try {
                // Cân bằng giữa tấn công và phòng thủ
                const DROP_TACTICS = {
                    BLOCK_CHECK: 200,          // Cân bằng thả quân để chặn chiếu
                    PROTECT_PIECE: 180,        // Cân bằng ưu tiên bảo vệ quân
                    ATTACK_KING: 200,          // Cân bằng ưu tiên tấn công vua
                    ATTACK_UNDEFENDED: 180,    // Cân bằng ưu tiên tấn công quân không được bảo vệ
                    FORK_OPPORTUNITY: 190,     // Cân bằng ưu tiên thả quân tạo fork
                    GAIN_CENTER_CONTROL: 170,  // Cân bằng kiểm soát trung tâm
                    ADVANCED_POSITION: 100,    // Cân bằng ưu tiên thả quân ở vị trí tiến sâu
                    ENDGAME_PAWN_DROP: 200     // Giữ nguyên ưu tiên thả tốt trong tàn cuộc
                };

                // Áp dụng cấu hình
                if ('setDropTactics' in this.fallbackAI) {
                    (this.fallbackAI as any).setDropTactics(DROP_TACTICS);
                }

                this.fallbackAI.setHybridMode(true);
            } catch (error) {
                console.error('Lỗi khi cấu hình balanced drops:', error);
            }
        }

        // Áp dụng cấu hình tương tự cho AI chính
        try {
            this.chessAI.setHybridMode(true);
            if ('setDropPreference' in this.chessAI) {
                (this.chessAI as any).setDropPreference('balanced');
            }
        } catch (error) {
            console.error('Lỗi khi cấu hình balanced drops cho AI chính:', error);
        }

        console.log("Đã cấu hình AI cho chiến thuật thả quân cân bằng");
    }

    // Thiết lập chế độ hybrid (kết hợp thả quân và di chuyển)
    public setHybridMode(enabled: boolean): void {
        if (this.fallbackAI) {
            this.fallbackAI.setHybridMode(enabled);
        }
        this.chessAI.setHybridMode(enabled);
        console.log(`${enabled ? 'Bật' : 'Tắt'} chế độ hybrid (kết hợp thả quân và di chuyển)`);
    }

    public stop(): void {
        if (this.engine) {
            this.sendCommand('quit');
            this.engine.terminate();
            this.engine = null;
            this.isReady = false;
        }
        this.adapter.stop();
    }
}

// Singleton instance
let stockfishInstance: StockfishService | null = null;

export const getStockfishService = (): StockfishService => {
    if (!stockfishInstance) {
        stockfishInstance = new StockfishService();
    }
    return stockfishInstance;
};