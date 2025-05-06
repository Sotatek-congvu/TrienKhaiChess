// Chess piece types
export enum PieceType {
  KING = 'king',
  QUEEN = 'queen',
  ROOK = 'rook',
  KNIGHT = 'knight',
  BISHOP = 'bishop',
  PAWN = 'pawn'
}

// Chess piece colors
export enum PieceColor {
  WHITE = 'white',
  BLACK = 'black'
}

// Chess piece representation
export interface ChessPiece {
  id: string;
  type: PieceType;
  color: PieceColor;
  hasMoved: boolean;
}

// Position on the board
export interface Position {
  row: number;
  col: number;
}

// Represent a move
export interface Move {
  from: Position;
  to: Position;
  piece: ChessPiece;
  capturedPiece?: ChessPiece;
  isPromotion?: boolean;
  promoteTo?: PieceType;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isDropped?: boolean;
  notation?: string; // Adding notation property for move history display
}

// Store captured pieces that can be dropped back
export interface PieceBank {
  [PieceColor.WHITE]: ChessPiece[];
  [PieceColor.BLACK]: ChessPiece[];
}

// Game state
export interface GameState {
  board: (ChessPiece | null)[][];
  currentPlayer: PieceColor;
  moveHistory: Move[];
  selectedPiece: Position | null;
  validMoves: Position[];
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  lastMove: Move | null;
  pieceBank: PieceBank;
  isDroppingPiece?: boolean;
}

// Game initialization with 6x6 board and pieces as per the provided image
export const createInitialBoard = (): (ChessPiece | null)[][] => {
  // Create 6x6 board
  const board: (ChessPiece | null)[][] = Array(6).fill(null).map(() => Array(6).fill(null));

  // White pieces in bottom-left corner (rows 0-1, columns 0-3)
  board[0][0] = { id: 'white-king', type: PieceType.KING, color: PieceColor.WHITE, hasMoved: false };
  board[0][1] = { id: 'white-rook', type: PieceType.ROOK, color: PieceColor.WHITE, hasMoved: false };
  board[0][2] = { id: 'white-knight', type: PieceType.KNIGHT, color: PieceColor.WHITE, hasMoved: false };
  board[0][3] = { id: 'white-bishop', type: PieceType.BISHOP, color: PieceColor.WHITE, hasMoved: false };

  // White pawn in position (1,0)
  board[1][0] = { id: 'white-pawn-0', type: PieceType.PAWN, color: PieceColor.WHITE, hasMoved: false };

  // Black pieces in top-right corner (rows 4-5, columns 2-5)
  board[5][5] = { id: 'black-king', type: PieceType.KING, color: PieceColor.BLACK, hasMoved: false };
  board[5][4] = { id: 'black-rook', type: PieceType.ROOK, color: PieceColor.BLACK, hasMoved: false };
  board[5][3] = { id: 'black-knight', type: PieceType.KNIGHT, color: PieceColor.BLACK, hasMoved: false };
  board[5][2] = { id: 'black-bishop', type: PieceType.BISHOP, color: PieceColor.BLACK, hasMoved: false };

  // Black pawn in position (4,5)
  board[4][5] = { id: 'black-pawn-0', type: PieceType.PAWN, color: PieceColor.BLACK, hasMoved: false };

  return board;
};

export const createInitialGameState = (): GameState => {
  return {
    board: createInitialBoard(),
    currentPlayer: PieceColor.WHITE,
    moveHistory: [],
    selectedPiece: null,
    validMoves: [],
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    lastMove: null,
    pieceBank: {
      [PieceColor.WHITE]: [],
      [PieceColor.BLACK]: []
    }
  };
};

// Check if a position is within the board bounds
export const isValidPosition = (pos: Position): boolean => {
  return pos.row >= 0 && pos.row < 6 && pos.col >= 0 && pos.col < 6;
};

// Convert algebraic notation (e.g., "a1") to a Position object
export const algebraicToPosition = (algebraic: string): Position => {
  const col = algebraic.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = parseInt(algebraic.charAt(1)) - 1;
  return { row, col };
};

// Convert a Position object to algebraic notation
export const positionToAlgebraic = (pos: Position): string => {
  const colChar = String.fromCharCode('a'.charCodeAt(0) + pos.col);
  return `${colChar}${pos.row + 1}`;
};
