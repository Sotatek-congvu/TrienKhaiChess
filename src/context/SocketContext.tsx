import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 'http://localhost:3005';

interface Challenge {
    id: string;
    challenger: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl?: string;
    };
    challenged: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl?: string;
    };
    status: 'pending' | 'accepted' | 'declined';
    timestamp: number;
}

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    createRoom: (gameOptions?: any) => void;
    joinRoom: (roomId: string, asSpectator?: boolean) => void;
    leaveRoom: (roomId: string) => void;
    makeMove: (data: { roomId: string; from: string; to: string; promoteTo?: string }) => void;
    playerReady: (data: { roomId: string; ready: boolean }) => void;
    // Challenge related methods
    sendChallenge: (challengedUserId: string) => void;
    acceptChallenge: (challengeId: string) => void;
    declineChallenge: (challengeId: string) => void;
    cancelChallenge: (challengeId: string) => void;
    // Challenge state
    pendingChallenges: Challenge[];
    receivedChallenges: Challenge[];
}

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [pendingChallenges, setPendingChallenges] = useState<Challenge[]>([]);
    const [receivedChallenges, setReceivedChallenges] = useState<Challenge[]>([]);
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const socketRef = useRef<Socket | null>(null);
    const reconnectAttempts = useRef(0);
    const MAX_RECONNECT_ATTEMPTS = 5;
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [gameData, setGameData] = useState<any>(null);

    const initializeSocket = useCallback(() => {
        if (!user) return;

        console.log('Initializing socket connection...');
        const newSocket = io(SOCKET_SERVER_URL, {
            auth: {
                userId: user.id,
                username: profile?.username || user.email,
                displayName: profile?.display_name,
                avatarUrl: profile?.avatar_url
            },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        setSocket(newSocket);
        socketRef.current = newSocket;

        // Connection event handlers
        newSocket.on('connect', () => {
            console.log('Socket connected successfully');
            setIsConnected(true);
            setError(null);

            // If a room ID was provided, join that room
            if (roomId) {
                console.log('Joining room:', roomId);
                newSocket.emit('joinRoom', { roomId });
            } else {
                // Otherwise, get the list of available rooms
                console.log('Getting available rooms');
                newSocket.emit('getRooms');
            }
        });

        newSocket.on('connect_error', (err) => {
            console.error('Socket connection error:', err);
            setIsConnected(false);
            setError('Failed to connect to game server');
            toast.error('Failed to connect to game server');
        });

        newSocket.on('disconnect', () => {
            console.log('Socket disconnected');
            setIsConnected(false);
        });

        // Handle game start event
        newSocket.on('game:start', (gameData) => {
            console.log('Game started:', gameData);
            // Store game data
            setGameData(gameData);
            // Navigate to game page
            navigate(`/game/${gameData.gameId}`);
        });

        // Handle challenge events
        newSocket.on('challenge:received', (challenge) => {
            console.log('Received challenge:', challenge);
            setReceivedChallenges(prev => [...prev, challenge]);
            toast.info(`${challenge.challenger.username} đã thách đấu bạn!`);
        });

        newSocket.on('challenge:sent', (challenge) => {
            console.log('Challenge sent:', challenge);
            setPendingChallenges(prev => [...prev, challenge]);
            toast.success(`Đã gửi lời thách đấu đến ${challenge.challenged.username}`);
        });

        newSocket.on('challenge:error', (error) => {
            console.error('Challenge error:', error);
            toast.error(error.message || 'Có lỗi xảy ra khi xử lý thách đấu');
        });

        newSocket.on('challenge:accepted', (challenge: Challenge) => {
            setPendingChallenges(prev => prev.filter(c => c.id !== challenge.id));
            toast.success(`${challenge.challenged.displayName} đã chấp nhận thách đấu!`);
        });

        // Handle direct game room navigation for both players
        newSocket.on('game:directStart', async (data: { roomId: string, gameState: any }) => {
            console.log('Game direct start:', data);
            try {
                // First join the room and wait for confirmation
                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Join room timeout'));
                    }, 5000);

                    newSocket.emit('joinRoom', { roomId: data.roomId }, (response: any) => {
                        clearTimeout(timeout);
                        if (response.success) {
                            resolve();
                        } else {
                            reject(new Error(response.error || 'Failed to join room'));
                        }
                    });
                });

                // Only navigate after successfully joining the room
                navigate(`/game/${data.roomId}`, { replace: true });
            } catch (error) {
                console.error('Error joining game room:', error);
                toast.error('Không thể tham gia phòng game');
            }
        });

        newSocket.on('challenge:declined', (challenge: Challenge) => {
            setPendingChallenges(prev => prev.filter(c => c.id !== challenge.id));
            toast.info(`${challenge.challenged.displayName} đã từ chối thách đấu`);
        });

        newSocket.on('challenge:cancelled', (challenge: Challenge) => {
            setReceivedChallenges(prev => prev.filter(c => c.id !== challenge.id));
            toast.info(`${challenge.challenger.displayName} đã hủy thách đấu`);
        });

        newSocket.on('challenge:expired', (challenge: Challenge) => {
            setPendingChallenges(prev => prev.filter(c => c.id !== challenge.id));
            setReceivedChallenges(prev => prev.filter(c => c.id !== challenge.id));
            toast.info('Thách đấu đã hết hạn');
        });

        return newSocket;
    }, [user, profile, navigate, roomId]);

    useEffect(() => {
        if (!user) return;

        const newSocket = initializeSocket();

        // Cleanup on unmount
        return () => {
            console.log('Cleaning up socket connection');
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, [user, initializeSocket]);

    const createRoom = (gameOptions = {}) => {
        if (!socket || !isConnected) {
            toast.error('Không kết nối được với máy chủ game');
            return;
        }
        socket.emit('createRoom', gameOptions);
    };

    const joinRoom = (roomId: string, asSpectator = false) => {
        if (!socket || !isConnected) {
            toast.error('Không kết nối được với máy chủ game');
            return;
        }
        socket.emit('joinRoom', { roomId, asSpectator });
    };

    const leaveRoom = (roomId: string) => {
        if (!socket || !isConnected) {
            toast.error('Không kết nối được với máy chủ game');
            return;
        }
        socket.emit('leaveRoom', { roomId });
    };

    const makeMove = (data: { roomId: string; from: string; to: string; promoteTo?: string }) => {
        if (!socket || !isConnected) {
            toast.error('Không kết nối được với máy chủ game');
            return;
        }
        socket.emit('makeMove', data);
    };

    const playerReady = (data: { roomId: string; ready: boolean }) => {
        if (!socket || !isConnected) {
            toast.error('Không kết nối được với máy chủ game');
            return;
        }
        socket.emit('playerReady', data);
    };

    // Challenge related methods
    const sendChallenge = (challengedUserId: string) => {
        if (!socket || !isConnected) {
            toast.error('Không kết nối được với máy chủ game');
            return;
        }
        socket.emit('challenge:send', { challengedUserId });
    };

    const acceptChallenge = useCallback((challengeId: string) => {
        if (!socket) return;
        // Emit accept event - server will handle direct game creation and navigation
        socket.emit('challenge:accept', { challengeId });
    }, [socket]);

    const declineChallenge = (challengeId: string) => {
        if (!socket || !isConnected) {
            toast.error('Không kết nối được với máy chủ game');
            return;
        }
        socket.emit('challenge:decline', { challengeId });
    };

    const cancelChallenge = (challengeId: string) => {
        if (!socket || !isConnected) {
            toast.error('Không kết nối được với máy chủ game');
            return;
        }
        socket.emit('challenge:cancel', { challengeId });
    };

    const value = {
        socket,
        isConnected,
        createRoom,
        joinRoom,
        leaveRoom,
        makeMove,
        playerReady,
        // Challenge related values
        sendChallenge,
        acceptChallenge,
        declineChallenge,
        cancelChallenge,
        pendingChallenges,
        receivedChallenges
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
}; 