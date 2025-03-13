
import { CSSProperties, FC } from 'react';
import { ChessPiece as ChessPieceType, PieceColor, PieceType } from '@/lib/chess-models';
import { cn } from '@/lib/utils';

interface ChessPieceProps {
  piece: ChessPieceType;
  isDragging?: boolean;
  isSelected?: boolean;
  className?: string;
  style?: CSSProperties;
}

const ChessPiece: FC<ChessPieceProps> = ({ 
  piece, 
  isDragging = false,
  isSelected = false,
  className,
  style
}) => {
  return (
    <div 
      className={cn(
        "chess-piece select-none",
        isSelected && "selected",
        className
      )}
      style={{
        ...style
      }}
    >
      {renderPiece(piece.type, piece.color)}
    </div>
  );
};

// Export the function to get piece symbols
export const getPieceSymbol = (type: PieceType, color: PieceColor): string => {
  switch (type) {
    case PieceType.KING:
      return color === PieceColor.WHITE ? '♔' : '♚';
    case PieceType.QUEEN:
      return color === PieceColor.WHITE ? '♕' : '♛';
    case PieceType.ROOK:
      return color === PieceColor.WHITE ? '♖' : '♜';
    case PieceType.KNIGHT:
      return color === PieceColor.WHITE ? '♘' : '♞';
    case PieceType.BISHOP:
      return color === PieceColor.WHITE ? '♗' : '♝';
    case PieceType.PAWN:
      return color === PieceColor.WHITE ? '♙' : '♟';
    default:
      return '';
  }
};

const renderPiece = (type: PieceType, color: PieceColor): JSX.Element => {
  const isWhite = color === PieceColor.WHITE;
  const fillColor = isWhite ? "#FFFFFF" : "#4A4A4A";
  const strokeColor = isWhite ? "#000000" : "#000000";
  const strokeWidth = isWhite ? 1.5 : 1;
  const className = "w-full h-full";

  switch (type) {
    case PieceType.KING:
      return isWhite ? (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22.5 11.63V6M20 8h5" strokeLinecap="round"/>
            <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="butt" strokeLinejoin="miter"/>
            <path d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth}/>
            <path d="M12.5 30c5.5-3 14.5-3 20 0M12.5 33.5c5.5-3 14.5-3 20 0M12.5 37c5.5-3 14.5-3 20 0" fill="none" stroke={strokeColor} strokeWidth={strokeWidth}/>
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22.5 11.63V6M20 8h5" strokeLinecap="round"/>
            <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="butt" strokeLinejoin="miter"/>
            <path d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth}/>
            <path d="M12.5 30c5.5-3 14.5-3 20 0M12.5 33.5c5.5-3 14.5-3 20 0M12.5 37c5.5-3 14.5-3 20 0" fill="none" stroke={strokeColor} strokeWidth={strokeWidth}/>
          </g>
        </svg>
      );
    case PieceType.QUEEN:
      return isWhite ? (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12z" strokeLinecap="butt" fill={fillColor}/>
            <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1 2.5-1 2.5-1.5 1.5 0 2.5 0 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" strokeLinecap="butt"/>
            <path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0" fill="none"/>
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12z" strokeLinecap="butt"/>
            <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1 2.5-1 2.5-1.5 1.5 0 2.5 0 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" strokeLinecap="butt"/>
            <path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0" fill="none"/>
            <circle cx="6" cy="12" r="2"/>
            <circle cx="14" cy="9" r="2"/>
            <circle cx="22.5" cy="8" r="2"/>
            <circle cx="31" cy="9" r="2"/>
            <circle cx="39" cy="12" r="2"/>
          </g>
        </svg>
      );
    case PieceType.ROOK:
      return isWhite ? (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 39h27v-3H9v3zm3.5-7l1.5-2.5h17l1.5 2.5h-20zm-.5 4v-4h21v4H12z" strokeLinecap="butt"/>
            <path d="M14 29.5v-13h17v13H14z" strokeLinecap="butt" strokeLinejoin="miter"/>
            <path d="M14 16.5L11 14h23l-3 2.5H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z" strokeLinecap="butt"/>
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm-1-22V9h4v2h5V9h5v2h5V9h4v5" strokeLinecap="butt"/>
            <path d="M34 14l-3 3H14l-3-3"/>
            <path d="M31 17v12.5H14V17" strokeLinecap="butt" strokeLinejoin="miter"/>
            <path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/>
          </g>
        </svg>
      );
    case PieceType.BISHOP:
      return isWhite ? (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <g fill={fillColor} stroke={strokeColor}>
              <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z"/>
              <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>
              <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/>
            </g>
            <path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke={strokeColor} strokeWidth={strokeWidth} fill="none"/>
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <g fill={fillColor} stroke={strokeColor}>
              <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z"/>
              <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>
              <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/>
            </g>
            <path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke={strokeColor} strokeWidth={strokeWidth} fill="none"/>
          </g>
        </svg>
      );
    case PieceType.KNIGHT:
      return isWhite ? (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill={fillColor}/>
            <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill={fillColor}/>
            <path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill={strokeColor} stroke="none"/>
            <path d="M14.933 15.75a.5 1.5 0 1 1-1 0 .5 1.5 0 1 1 1 0z" fill={strokeColor} stroke="none" transform="rotate(30 14.433 15.75)"/>
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 45 45" className={className}>
          <g fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill={fillColor}/>
            <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill={fillColor}/>
            <path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill="#ececec" stroke="none"/>
            <path d="M14.933 15.75a.5 1.5 0 1 1-1 0 .5 1.5 0 1 1 1 0z" fill="#ececec" stroke="none" transform="rotate(30 14.433 15.75)"/>
          </g>
        </svg>
      );
    case PieceType.PAWN:
      return isWhite ? (
        <svg viewBox="0 0 45 45" className={className}>
          <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" fill={fillColor}/>
        </svg>
      ) : (
        <svg viewBox="0 0 45 45" className={className}>
          <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" fill={fillColor}/>
        </svg>
      );
    default:
      return <div></div>;
  }
};

export default ChessPiece;
