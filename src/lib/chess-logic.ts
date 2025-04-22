import {
  ChessPiece,
  GameState,
  PieceColor,
  PieceType,
  Position,
  isValidPosition,
  Move
} from './chess-models';

// Get all valid moves for a piece
// Get all valid moves for a piece
// Get all valid moves for a piece
export const getValidMoves = (gameState: GameState, position: Position): Position[] => {
  const { board, currentPlayer } = gameState;
  const piece = board[position.row][position.col];

  if (!piece || piece.color !== currentPlayer) {
    return [];
  }

  let validMoves: Position[] = [];

  // Nếu vua đang bị chiếu, xử lý đặc biệt
  if (isKingInCheck(gameState)) {
    return getValidMovesWhenInCheck(gameState, position);
  }

  // Tính toán nước đi thông thường
  switch (piece.type) {
    case PieceType.PAWN:
      validMoves = getValidPawnMoves(gameState, position);
      break;
    case PieceType.ROOK:
      validMoves = getValidRookMoves(gameState, position);
      break;
    case PieceType.KNIGHT:
      validMoves = getValidKnightMoves(gameState, position);
      break;
    case PieceType.BISHOP:
      validMoves = getValidBishopMoves(gameState, position);
      break;
    case PieceType.QUEEN:
      validMoves = getValidQueenMoves(gameState, position);
      break;
    case PieceType.KING:
      validMoves = getValidKingMoves(gameState, position);
      break;
    default:
      return [];
  }

  // Lọc các nước đi không để vua bị chiếu
  validMoves = validMoves.filter(move => {
    return isMoveSafeForKing(gameState, position, move);
  });

  return validMoves;
};

// Hàm kiểm tra xem nước đi có an toàn cho vua không
const isMoveSafeForKing = (gameState: GameState, from: Position, to: Position): boolean => {
  const { board, currentPlayer } = gameState;

  // Create a temporary board to test the move
  const tempBoard = board.map(row => [...row]);
  const movingPiece = tempBoard[from.row][from.col];

  // Make the move on the temporary board
  tempBoard[to.row][to.col] = movingPiece;
  tempBoard[from.row][from.col] = null;

  // Create a temporary game state
  const tempGameState: GameState = {
    ...gameState,
    board: tempBoard
  };

  // Check if the king is still in check after this move
  return !isKingInCheck(tempGameState, currentPlayer);
};

// Get valid moves for a pawn
const getValidPawnMoves = (gameState: GameState, position: Position): Position[] => {
  const { board, currentPlayer } = gameState;
  const { row, col } = position;
  const validMoves: Position[] = [];

  // Direction is different for white and black pawns
  const direction = currentPlayer === PieceColor.WHITE ? 1 : -1;

  // One square forward
  const oneSquareForward: Position = { row: row + direction, col };
  if (isValidPosition(oneSquareForward) && !board[oneSquareForward.row][oneSquareForward.col]) {
    validMoves.push(oneSquareForward);

    // Two squares forward from starting position
    if ((currentPlayer === PieceColor.WHITE && row === 1) ||
      (currentPlayer === PieceColor.BLACK && row === 4)) {
      const twoSquaresForward: Position = { row: row + 2 * direction, col };
      if (isValidPosition(twoSquaresForward) && !board[twoSquaresForward.row][twoSquaresForward.col]) {
        validMoves.push(twoSquaresForward);
      }
    }
  }

  // Capture diagonally
  const capturePositions: Position[] = [
    { row: row + direction, col: col - 1 },
    { row: row + direction, col: col + 1 }
  ];

  capturePositions.forEach(capturePos => {
    if (isValidPosition(capturePos)) {
      const targetPiece = board[capturePos.row][capturePos.col];
      if (targetPiece && targetPiece.color !== currentPlayer) {
        validMoves.push(capturePos);
      }
    }
  });

  return validMoves;
};
const getAttackingPieces = (gameState: GameState): Position[] => {
  const { board, currentPlayer } = gameState;
  const attackingPieces: Position[] = [];

  // Tìm vị trí vua
  let kingPosition: Position | null = null;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const piece = board[row][col];
      if (piece?.type === PieceType.KING && piece?.color === currentPlayer) {
        kingPosition = { row, col };
        break;
      }
    }
    if (kingPosition) break;
  }

  if (!kingPosition) {
    console.error('Không tìm thấy vua');
    return attackingPieces;
  }

  // Tạo trạng thái tạm thời với người chơi là đối phương
  const opponentColor = currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;
  const tempGameState: GameState = {
    ...gameState,
    currentPlayer: opponentColor
  };

  // Kiểm tra từng quân cờ của đối phương
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const piece = board[row][col];
      if (piece && piece.color === opponentColor) {
        const position: Position = { row, col };
        const validMoves = getPseudoLegalMoves(tempGameState, position);
        if (validMoves.some(move => move.row === kingPosition!.row && move.col === kingPosition!.col)) {
          attackingPieces.push(position);
        }
      }
    }
  }

  return attackingPieces;
};
const getPseudoLegalMoves = (gameState: GameState, position: Position): Position[] => {
  const { board, currentPlayer } = gameState;
  const piece = board[position.row][position.col];

  if (!piece || piece.color !== currentPlayer) {
    return [];
  }

  switch (piece.type) {
    case PieceType.PAWN:
      return getValidPawnMoves(gameState, position);
    case PieceType.ROOK:
      return getValidRookMoves(gameState, position);
    case PieceType.KNIGHT:
      return getValidKnightMoves(gameState, position);
    case PieceType.BISHOP:
      return getValidBishopMoves(gameState, position);
    case PieceType.QUEEN:
      return getValidQueenMoves(gameState, position);
    case PieceType.KING:
      return getValidKingMoves(gameState, position);
    default:
      return [];
  }
};
// Get valid moves for a rook
const getValidRookMoves = (gameState: GameState, position: Position): Position[] => {
  const { board, currentPlayer } = gameState;
  const { row, col } = position;
  const validMoves: Position[] = [];

  const directions = [
    { row: 1, col: 0 },  // Down
    { row: -1, col: 0 }, // Up
    { row: 0, col: 1 },  // Right
    { row: 0, col: -1 }   // Left
  ];

  directions.forEach(dir => {
    for (let i = 1; i < 6; i++) {
      const newPos: Position = { row: row + i * dir.row, col: col + i * dir.col };
      if (!isValidPosition(newPos)) break;

      const targetPiece = board[newPos.row][newPos.col];
      if (!targetPiece) {
        validMoves.push(newPos);
      } else {
        if (targetPiece.color !== currentPlayer) {
          validMoves.push(newPos);
        }
        break;
      }
    }
  });

  return validMoves;
};
const findBlockingPath = (from: Position, to: Position): Position[] => {
  const path: Position[] = [];
  const rowDiff = to.row - from.row;
  const colDiff = to.col - from.col;

  // Determine direction of movement
  const rowStep = rowDiff === 0 ? 0 : (rowDiff > 0 ? 1 : -1);
  const colStep = colDiff === 0 ? 0 : (colDiff > 0 ? 1 : -1);

  // Check if this is a valid line (straight or diagonal)
  const isDiagonal = Math.abs(rowDiff) === Math.abs(colDiff);
  const isStraight = rowDiff === 0 || colDiff === 0;

  // If not a valid line, return empty path
  if (!isDiagonal && !isStraight) {
    return path;
  }

  let currentRow = from.row + rowStep;
  let currentCol = from.col + colStep;

  // Collect all positions between 'from' and 'to' (not including endpoints)
  while (currentRow !== to.row || currentCol !== to.col) {
    path.push({ row: currentRow, col: currentCol });
    currentRow += rowStep;
    currentCol += colStep;
  }

  return path;
};

// Get valid moves for a knight
const getValidKnightMoves = (gameState: GameState, position: Position): Position[] => {
  const { board, currentPlayer } = gameState;
  const { row, col } = position;
  const validMoves: Position[] = [];

  const knightMoves = [
    { row: 2, col: 1 },
    { row: 2, col: -1 },
    { row: -2, col: 1 },
    { row: -2, col: -1 },
    { row: 1, col: 2 },
    { row: 1, col: -2 },
    { row: -1, col: 2 },
    { row: -1, col: -2 }
  ];

  knightMoves.forEach(move => {
    const newPos: Position = { row: row + move.row, col: col + move.col };
    if (isValidPosition(newPos)) {
      const targetPiece = board[newPos.row][newPos.col];
      if (!targetPiece || targetPiece.color !== currentPlayer) {
        validMoves.push(newPos);
      }
    }
  });

  return validMoves;
};

// Get valid moves for a bishop
const getValidBishopMoves = (gameState: GameState, position: Position): Position[] => {
  const { board, currentPlayer } = gameState;
  const { row, col } = position;
  const validMoves: Position[] = [];

  const directions = [
    { row: 1, col: 1 },  // Down-Right
    { row: 1, col: -1 }, // Down-Left
    { row: -1, col: 1 }, // Up-Right
    { row: -1, col: -1 }  // Up-Left
  ];

  directions.forEach(dir => {
    for (let i = 1; i < 6; i++) {
      const newPos: Position = { row: row + i * dir.row, col: col + i * dir.col };
      if (!isValidPosition(newPos)) break;

      const targetPiece = board[newPos.row][newPos.col];
      if (!targetPiece) {
        validMoves.push(newPos);
      } else {
        if (targetPiece.color !== currentPlayer) {
          validMoves.push(newPos);
        }
        break;
      }
    }
  });

  return validMoves;
};

// Get valid moves for a queen
const getValidQueenMoves = (gameState: GameState, position: Position): Position[] => {
  const rookMoves = getValidRookMoves(gameState, position);
  const bishopMoves = getValidBishopMoves(gameState, position);

  return [...rookMoves, ...bishopMoves];
};

const getValidKingMoves = (gameState: GameState, position: Position): Position[] => {
  const { board, currentPlayer } = gameState;
  const { row, col } = position;
  const validMoves: Position[] = [];

  const kingMoves = [
    { row: 1, col: 0 },
    { row: -1, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: -1 },
    { row: 1, col: 1 },
    { row: 1, col: -1 },
    { row: -1, col: 1 },
    { row: -1, col: -1 }
  ];

  // Collect all potential moves
  kingMoves.forEach(move => {
    const newPos: Position = { row: row + move.row, col: col + move.col };
    if (isValidPosition(newPos)) {
      const targetPiece = board[newPos.row][newPos.col];
      if (!targetPiece || targetPiece.color !== currentPlayer) {
        validMoves.push(newPos);
      }
    }
  });

  // Filter out moves that would put the king in check - without causing recursion
  return validMoves.filter(move => {
    // Create a temporary board for testing
    const tempBoard = board.map(r => [...r]);

    // Move the king on the temp board
    tempBoard[move.row][move.col] = tempBoard[row][col];
    tempBoard[row][col] = null;

    // Check if any opponent piece can attack the king's new position
    const opponentColor = currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;

    // Check all opponent pieces
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const piece = tempBoard[r][c];
        if (piece && piece.color === opponentColor) {
          // Create a temporary game state
          const tempGameState = { ...gameState, board: tempBoard, currentPlayer: opponentColor };

          // Get pseudo-legal moves (without checking for king safety)
          const opponentMoves = getPseudoLegalMovesDirectly(tempGameState, { row: r, col: c }, piece.type);

          // If any opponent piece can attack the new king position, this move is not valid
          if (opponentMoves.some(m => m.row === move.row && m.col === move.col)) {
            return false;
          }
        }
      }
    }

    // If no opponent piece can attack the king, this move is valid
    return true;
  });
};

// New function to get moves directly without causing recursion
const getPseudoLegalMovesDirectly = (gameState: GameState, position: Position, pieceType: PieceType): Position[] => {
  switch (pieceType) {
    case PieceType.PAWN:
      return getValidPawnMoves(gameState, position);
    case PieceType.ROOK:
      return getValidRookMoves(gameState, position);
    case PieceType.KNIGHT:
      return getValidKnightMoves(gameState, position);
    case PieceType.BISHOP:
      return getValidBishopMoves(gameState, position);
    case PieceType.QUEEN:
      return [...getValidRookMoves(gameState, position), ...getValidBishopMoves(gameState, position)];
    case PieceType.KING:
      // For kings, only check adjacent squares without checking king safety
      const { board, currentPlayer } = gameState;
      const { row, col } = position;
      const kingMoves = [
        { row: 1, col: 0 }, { row: -1, col: 0 },
        { row: 0, col: 1 }, { row: 0, col: -1 },
        { row: 1, col: 1 }, { row: 1, col: -1 },
        { row: -1, col: 1 }, { row: -1, col: -1 }
      ];

      return kingMoves
        .map(move => ({ row: row + move.row, col: col + move.col }))
        .filter(pos =>
          isValidPosition(pos) &&
          (!board[pos.row][pos.col] || board[pos.row][pos.col]?.color !== currentPlayer)
        );
    default:
      return [];
  }
}

const getValidMovesForPiece = (gameState: GameState, position: Position, pieceType: PieceType): Position[] => {
  switch (pieceType) {
    case PieceType.PAWN:
      return getValidPawnMoves(gameState, position);
    case PieceType.ROOK:
      return getValidRookMoves(gameState, position);
    case PieceType.KNIGHT:
      return getValidKnightMoves(gameState, position);
    case PieceType.BISHOP:
      return getValidBishopMoves(gameState, position);
    case PieceType.QUEEN:
      return [...getValidRookMoves(gameState, position), ...getValidBishopMoves(gameState, position)];
    case PieceType.KING:
      // Đối với vua, chỉ kiểm tra các ô liền kề mà không kiểm tra lại việc chiếu
      // để tránh đệ quy vô hạn
      const { board, currentPlayer } = gameState;
      const { row, col } = position;
      const validMoves: Position[] = [];

      const kingMoves = [
        { row: 1, col: 0 },
        { row: -1, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: -1 },
        { row: 1, col: 1 },
        { row: 1, col: -1 },
        { row: -1, col: 1 },
        { row: -1, col: -1 }
      ];

      kingMoves.forEach(move => {
        const newPos: Position = { row: row + move.row, col: col + move.col };
        if (isValidPosition(newPos)) {
          const targetPiece = board[newPos.row][newPos.col];
          if (!targetPiece || targetPiece.color !== currentPlayer) {
            validMoves.push(newPos);
          }
        }
      });

      return validMoves;
    default:
      return [];
  }
};

export const isKingInCheck = (gameState: GameState, playerToCheck?: PieceColor): boolean => {
  const { board } = gameState;
  const currentPlayer = playerToCheck || gameState.currentPlayer;

  // Tìm vị trí vua
  let kingPosition: Position | null = null;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const piece = board[row][col];
      if (piece?.type === PieceType.KING && piece?.color === currentPlayer) {
        kingPosition = { row, col };
        break;
      }
    }
    if (kingPosition) break;
  }

  if (!kingPosition) {
    console.error('Không tìm thấy vua');
    return false;
  }

  // Tạo trạng thái tạm thời với người chơi là đối phương
  const opponentColor = currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;
  const tempGameState: GameState = {
    ...gameState,
    currentPlayer: opponentColor
  };

  // Kiểm tra nước đi giả hợp lệ của quân đối phương
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const piece = board[row][col];
      if (piece && piece.color === opponentColor) {
        const position: Position = { row, col };
        const pseudoLegalMoves = getPseudoLegalMoves(tempGameState, position);
        if (pseudoLegalMoves.some(move => move.row === kingPosition!.row && move.col === kingPosition!.col)) {
          return true;
        }
      }
    }
  }

  return false;
};

// Improved checkmate detection
export const checkIfCheckmate = (gameState: GameState): boolean => {
  const { currentPlayer, board } = gameState;

  // First, check if the king is in check
  if (!isKingInCheck(gameState)) {
    return false;
  }

  // Find the king's position
  let kingPosition: Position | null = null;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const piece = board[row][col];
      if (piece?.type === PieceType.KING && piece?.color === currentPlayer) {
        kingPosition = { row, col };
        break;
      }
    }
    if (kingPosition) break;
  }

  if (!kingPosition) {
    console.error('Không tìm thấy vua trong kiểm tra chiếu hết');
    return false;
  }

  // 1. Kiểm tra xem vua có thể di chuyển để thoát khỏi chiếu không
  const kingValidMoves = getValidMoves(gameState, kingPosition);
  for (const move of kingValidMoves) {
    // Tạo một bàn cờ tạm thời để thử nước đi
    const tempBoard = board.map(row => [...row]);
    const piece = tempBoard[kingPosition.row][kingPosition.col];

    // Di chuyển vua
    tempBoard[move.row][move.col] = piece;
    tempBoard[kingPosition.row][kingPosition.col] = null;

    // Kiểm tra xem vua còn bị chiếu không sau nước đi này
    const tempGameState = { ...gameState, board: tempBoard };
    const kingStillInCheck = isKingInCheck(tempGameState, currentPlayer);

    if (!kingStillInCheck) {
      // Nếu có bất kỳ nước đi nào thoát chiếu, thì không phải chiếu hết
      return false;
    }
  }

  // 2. Kiểm tra xem bất kỳ quân cờ nào khác có thể chặn chiếu hoặc bắt quân đang tấn công không
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const piece = board[row][col];
      if (piece && piece.color === currentPlayer && piece.type !== PieceType.KING) {
        const position: Position = { row, col };
        const validMoves = getValidMoves(gameState, position);

        // Với mỗi nước đi hợp lệ, mô phỏng nước đi và kiểm tra xem nó có thoát chiếu không
        for (const move of validMoves) {
          // Tạo một bàn cờ tạm thời để thử nước đi
          const tempBoard = board.map(row => [...row]);
          const movingPiece = tempBoard[position.row][position.col];

          // Di chuyển quân cờ
          tempBoard[move.row][move.col] = movingPiece;
          tempBoard[position.row][position.col] = null;

          // Kiểm tra xem vua còn bị chiếu không sau nước đi này
          const tempGameState = { ...gameState, board: tempBoard };
          const kingStillInCheck = isKingInCheck(tempGameState, currentPlayer);

          if (!kingStillInCheck) {
            // Nếu có bất kỳ nước đi nào thoát chiếu, thì không phải chiếu hết
            return false;
          }
        }
      }
    }
  }

  // 3. Kiểm tra xem có bất kỳ quân cờ nào trong ngân hàng quân cờ có thể giúp thoát chiếu không
  const pieceBank = gameState.pieceBank[currentPlayer];
  if (pieceBank.length > 0) {
    for (const piece of pieceBank) {
      const validDropSquares = getValidDropSquares(gameState, piece);

      for (const dropPosition of validDropSquares) {
        // Tạo một bàn cờ tạm thời để thử thả quân
        const tempBoard = board.map(row => [...row]);
        tempBoard[dropPosition.row][dropPosition.col] = piece;

        // Kiểm tra xem vua còn bị chiếu không sau khi thả
        const tempGameState = { ...gameState, board: tempBoard };
        const kingStillInCheck = isKingInCheck(tempGameState, currentPlayer);

        if (!kingStillInCheck) {
          // Nếu có bất kỳ việc thả nào thoát chiếu, thì không phải chiếu hết
          return false;
        }
      }
    }
  }

  // Nếu không có nước đi hoặc thả nào thoát chiếu, thì đó là chiếu hết
  // Only log checkmate when not checking internally during AI move calculation

  return true;
};
export const getValidMovesWhenInCheck = (gameState: GameState, position: Position): Position[] => {
  const { board, currentPlayer } = gameState;
  const piece = board[position.row][position.col];

  // Kiểm tra quân cờ có tồn tại và thuộc về người chơi hiện tại không
  if (!piece || piece.color !== currentPlayer) {
    return [];
  }

  // Tìm vị trí vua
  const kingPos = findKingPosition(board, currentPlayer);
  if (!kingPos) {
    console.error('King not found');
    return [];
  }

  // Lấy danh sách các quân đang tấn công vua
  const attackingPieces = getAttackingPieces(gameState);

  // Trường hợp 1: Nếu quân được chọn là vua
  if (piece.type === PieceType.KING) {
    const kingMoves = getValidKingMoves(gameState, position);
    return kingMoves.filter(move => {
      const tempBoard = board.map(row => [...row]);
      tempBoard[move.row][move.col] = piece;
      tempBoard[position.row][position.col] = null;

      const tempGameState = {
        ...gameState,
        board: tempBoard
      };
      return !isKingInCheck(tempGameState, currentPlayer);
    });
  }

  // Trường hợp 2: Nhiều quân tấn công - chỉ vua có thể di chuyển
  if (attackingPieces.length > 1) {
    return []; // Không có nước đi nào cho các quân khác
  }

  // Trường hợp 3: Một quân tấn công - có thể ăn quân tấn công hoặc chặn đường tấn công
  const attackerPos = attackingPieces[0];
  const attacker = board[attackerPos.row][attackerPos.col];

  // Lấy tất cả các nước đi giả hợp lệ cho quân cờ bằng getPseudoLegalMoves
  const normalMoves = getPseudoLegalMoves(gameState, position);

  // Lọc các nước đi để chỉ giữ lại những nước đi giúp thoát chiếu
  return normalMoves.filter(move => {
    // Lựa chọn 1: Ăn quân tấn công
    if (move.row === attackerPos.row && move.col === attackerPos.col) {
      return isMoveSafeForKing(gameState, position, move);
    }

    // Lựa chọn 2: Chặn đường tấn công (không áp dụng cho mã)
    if (attacker.type !== PieceType.KNIGHT) {
      const blockingPath = findBlockingPath(attackerPos, kingPos);
      const isBlocking = blockingPath.some(pathPos =>
        pathPos.row === move.row && pathPos.col === move.col
      );
      if (isBlocking) {
        return isMoveSafeForKing(gameState, position, move);
      }
    }

    return false;
  });
};

// Hàm hỗ trợ tìm vị trí vua
const findKingPosition = (board: (ChessPiece | null)[][], color: PieceColor): Position | null => {
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const piece = board[row][col];
      if (piece?.type === PieceType.KING && piece?.color === color) {
        return { row, col };
      }
    }
  }
  return null;
};

// Check if the current player is in stalemate
export const checkIfStalemate = (gameState: GameState): boolean => {
  const { currentPlayer, board } = gameState;

  // Iterate through all pieces of the current player
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 6; col++) {
      const piece = board[row][col];
      if (piece && piece.color === currentPlayer) {
        const position: Position = { row, col };
        const validMoves = getValidMoves(gameState, position);

        // If there's any valid move, it's not stalemate
        if (validMoves.length > 0) {
          return false;
        }
      }
    }
  }

  // If the king is not in check and there are no valid moves, it's stalemate
  return !isKingInCheck(gameState);
};

// Make a move
export const makeMove = (
  gameState: GameState,
  from: Position,
  to: Position,
  promoteTo?: PieceType
): GameState => {
  const { board, currentPlayer, pieceBank } = gameState;

  // Copy the board to create a new board state
  const newBoard = board.map(row => [...row]);

  // Get the moving piece and the target piece
  const movingPiece = newBoard[from.row][from.col];
  const targetPiece = newBoard[to.row][to.col];

  if (!movingPiece) {
    console.error('No piece at source position');
    return gameState;
  }

  // Move the piece
  newBoard[to.row][to.col] = { ...movingPiece, hasMoved: true };
  newBoard[from.row][from.col] = null;

  // Handle pawn promotion
  if (movingPiece.type === PieceType.PAWN) {
    const promotionRow = movingPiece.color === PieceColor.WHITE ? 5 : 0; // Hàng 5 cho trắng, hàng 0 cho đen
    if (to.row === promotionRow) {
      // Kiểm tra loại quân được chọn để phong cấp
      let promotionType = promoteTo || PieceType.ROOK; // Mặc định phong thành Xe

      // Giới hạn phong cấp cho cả tốt đen và tốt trắng chỉ còn mã, tượng và xe
      if (promotionType === PieceType.QUEEN) {
        promotionType = PieceType.ROOK; // Nếu chọn Hậu, đổi thành Xe
      }

      newBoard[to.row][to.col] = {
        ...movingPiece,
        type: promotionType,
        hasMoved: true
      };
    }
  }

  // Handle capturing a piece
  let updatedPieceBank = { ...pieceBank };
  if (targetPiece) {
    const capturedPiece = {
      ...targetPiece,
      color: currentPlayer,
      id: `captured-${targetPiece.type}-${Date.now()}`,
      hasMoved: true
    };
    updatedPieceBank = {
      ...pieceBank,
      [currentPlayer]: [...pieceBank[currentPlayer], capturedPiece]
    };
  }

  // Create the move record
  const move: Move = {
    from,
    to,
    piece: movingPiece,
    capturedPiece: targetPiece,
    isPromotion: movingPiece.type === PieceType.PAWN && to.row === (movingPiece.color === PieceColor.WHITE ? 5 : 0),
    promoteTo: promoteTo || (movingPiece.type === PieceType.PAWN && to.row === (movingPiece.color === PieceColor.WHITE ? 5 : 0) ? PieceType.ROOK : undefined),
  };

  // Switch the current player
  const nextPlayer = currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;

  // Update game state
  const newGameState: GameState = {
    ...gameState,
    board: newBoard,
    currentPlayer: nextPlayer,
    moveHistory: [...gameState.moveHistory, move],
    selectedPiece: null,
    validMoves: [],
    pieceBank: updatedPieceBank,
    lastMove: move,
  };

  // Check if the opponent is in check after the move
  const isCheck = isKingInCheck(newGameState);
  newGameState.isCheck = isCheck;

  // Check if the opponent is in checkmate
  const isCheckmate = isCheck && checkIfCheckmate(newGameState);
  newGameState.isCheckmate = isCheckmate;

  // Check if the opponent is in stalemate
  const isStalemate = !isCheck && checkIfStalemate(newGameState);
  newGameState.isStalemate = isStalemate;

  return newGameState;
};

// Add these functions to support the piece dropping feature
export const getValidDropSquares = (gameState: GameState, piece: ChessPiece): Position[] => {
  const { board, currentPlayer } = gameState;
  const validSquares: Position[] = [];

  // Nếu vua không bị chiếu, thả quân vào bất kỳ ô trống nào
  if (!isKingInCheck(gameState)) {
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        if (board[row][col] === null) {
          // Tốt không được thả vào hàng đầu hoặc cuối
          if (piece.type === PieceType.PAWN && (row === 0 || row === 5)) {
            continue;
          }
          validSquares.push({ row, col });
        }
      }
    }
    return validSquares;
  }

  // Nếu vua bị chiếu, xác định các quân tấn công
  const attackingPieces = getAttackingPieces(gameState);

  // Nếu có hơn một quân tấn công, không cho phép thả quân
  if (attackingPieces.length > 1) {
    return [];
  }

  // Chỉ có một quân tấn công
  const attackerPos = attackingPieces[0];
  const attacker = board[attackerPos.row][attackerPos.col];
  if (!attacker) return [];

  // Tìm vị trí vua
  const kingPos = findKingPosition(board, currentPlayer);
  if (!kingPos) return [];

  // Nếu quân tấn công là mã, không thể chặn bằng cách thả quân
  if (attacker.type === PieceType.KNIGHT) {
    return [];
  }

  // Với xe, tượng, hậu: thả quân vào các ô trống trên đường chặn
  const blockingPath = findBlockingPath(attackerPos, kingPos);
  blockingPath.forEach(pos => {
    if (board[pos.row][pos.col] === null) {
      validSquares.push(pos);
    }
  });

  // Lọc các vị trí để đảm bảo sau khi thả quân, vua không còn bị chiếu
  return validSquares.filter(pos => {
    const tempBoard = board.map(row => [...row]);
    tempBoard[pos.row][pos.col] = piece;
    const tempGameState = { ...gameState, board: tempBoard };
    return !isKingInCheck(tempGameState, currentPlayer);
  });
};
export const dropPiece = (gameState: GameState, piece: ChessPiece, position: Position): GameState => {
  const newGameState = { ...gameState };
  const { board, pieceBank, currentPlayer } = newGameState;

  // Kiểm tra ô đích phải trống
  if (board[position.row][position.col] !== null) {
    console.error('Không thể thả quân vào ô đã có quân');
    return gameState;
  }

  // Tạo bản sao bàn cờ mới
  const newBoard = board.map(row => [...row]);

  // Tạo ID duy nhất cho quân cờ được thả
  const uniqueId = `${piece.color}-${piece.type}-${Date.now()}`;
  const droppedPiece: ChessPiece = {
    ...piece,
    id: uniqueId,
    hasMoved: true,
  };

  // Đặt quân cờ vào ô trống
  newBoard[position.row][position.col] = droppedPiece;

  // Cập nhật ngân hàng quân cờ
  const newPieceBank = { ...pieceBank };
  const pieceBankForCurrentPlayer = [...newPieceBank[currentPlayer]];
  const pieceIndex = pieceBankForCurrentPlayer.findIndex(p => p.type === piece.type);

  if (pieceIndex !== -1) {
    pieceBankForCurrentPlayer.splice(pieceIndex, 1);
    newPieceBank[currentPlayer] = pieceBankForCurrentPlayer;
  }

  // Ghi lại nước đi
  const move: Move = {
    from: { row: -1, col: -1 }, // Đánh dấu đặc biệt cho quân được thả
    to: position,
    piece: droppedPiece,
    isDropped: true,
  };

  // Chuyển lượt người chơi
  const nextPlayer = currentPlayer === PieceColor.WHITE ? PieceColor.BLACK : PieceColor.WHITE;

  // Cập nhật trạng thái trò chơi
  const newState = {
    ...newGameState,
    board: newBoard,
    pieceBank: newPieceBank,
    currentPlayer: nextPlayer,
    moveHistory: [...newGameState.moveHistory, move],
    selectedPiece: null,
    validMoves: [],
    lastMove: move,
    isDroppingPiece: false,
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
  };

  // Kiểm tra xem đối thủ có bị chiếu không
  const isCheck = isKingInCheck(newState);
  newState.isCheck = isCheck;

  // Nếu bị chiếu, kiểm tra chiếu hết
  if (isCheck) {
    const isCheckmate = checkIfCheckmate(newState);
    newState.isCheckmate = isCheckmate;
  } else {
    // Nếu không bị chiếu, kiểm tra hòa cờ
    const isStalemate = checkIfStalemate(newState);
    newState.isStalemate = isStalemate;
  }

  return newState;
};