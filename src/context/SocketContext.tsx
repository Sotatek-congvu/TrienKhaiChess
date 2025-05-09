import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// Define the server URL - adjust based on your deployment
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

    const initializeSocket = useCallback(() => {
        if (!user) return;

        console.log('Initializing socket connection');
        const socket = io(SOCKET_SERVER_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            forceNew: true,
            auth: {
                userId: user.id,
                username: profile?.username || user.email,
                displayName: profile?.display_name || profile?.username || user.email,
                avatarUrl: profile?.avatar_url
            }
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to game server');
            setIsConnected(true);
            setSocket(socket);
            reconnectAttempts.current = 0;
            toast.success('Đã kết nối với máy chủ game');
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            setIsConnected(false);
            reconnectAttempts.current += 1;

            if (reconnectAttempts.current <= MAX_RECONNECT_ATTEMPTS) {
                toast.error(`Không thể kết nối với máy chủ. Đang thử lại... (${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);
                // Clear any existing timeout
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }
                // Set new timeout for reconnection
                reconnectTimeoutRef.current = setTimeout(() => {
                    if (socket.disconnected) {
                        socket.connect();
                    }
                }, 2000);
            } else {
                toast.error('Không thể kết nối với máy chủ. Vui lòng thử lại sau.');
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('Disconnected from game server:', reason);
            setIsConnected(false);

            // Only attempt to reconnect if it wasn't a server-initiated disconnect
            if (reason !== 'io server disconnect' && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
                toast.warning('Mất kết nối với máy chủ. Đang thử kết nối lại...');
                // Clear any existing timeout
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }
                // Set new timeout for reconnection
                reconnectTimeoutRef.current = setTimeout(() => {
                    if (socket.disconnected) {
                        socket.connect();
                    }
                }, 2000);
            }
        });

        // Challenge related event handlers
        socket.on('challenge:received', (challenge: Challenge) => {
            setReceivedChallenges(prev => [...prev, challenge]);
            toast.info(`${challenge.challenger.displayName} đã thách đấu bạn!`);
        });

        socket.on('challenge:sent', (challenge: Challenge) => {
            setPendingChallenges(prev => [...prev, challenge]);
            toast.success(`Đã gửi lời thách đấu đến ${challenge.challenged.displayName}`);
        });

        socket.on('challenge:accepted', (challenge: Challenge) => {
            setPendingChallenges(prev => prev.filter(c => c.id !== challenge.id));
            toast.success(`${challenge.challenged.displayName} đã chấp nhận thách đấu!`);
        });

        // Handle direct game room navigation for both players
        socket.on('game:directStart', async (data: { roomId: string, gameState: any }) => {
            console.log('Game direct start:', data);
            try {
                // First join the room and wait for confirmation
                await new Promise<void>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Join room timeout'));
                    }, 5000);

                    socket.emit('joinRoom', { roomId: data.roomId }, (response: any) => {
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

        socket.on('challenge:declined', (challenge: Challenge) => {
            setPendingChallenges(prev => prev.filter(c => c.id !== challenge.id));
            toast.info(`${challenge.challenged.displayName} đã từ chối thách đấu`);
        });

        socket.on('challenge:cancelled', (challenge: Challenge) => {
            setReceivedChallenges(prev => prev.filter(c => c.id !== challenge.id));
            toast.info(`${challenge.challenger.displayName} đã hủy thách đấu`);
        });

        socket.on('challenge:expired', (challenge: Challenge) => {
            setPendingChallenges(prev => prev.filter(c => c.id !== challenge.id));
            setReceivedChallenges(prev => prev.filter(c => c.id !== challenge.id));
            toast.info('Thách đấu đã hết hạn');
        });

        return socket;
    }, [user, profile, navigate]);

    useEffect(() => {
        const socket = initializeSocket();

        return () => {
            console.log('Cleaning up socket connection');
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (socket) {
                socket.off('connect');
                socket.off('disconnect');
                socket.off('connect_error');
                socket.disconnect();
            }
        };
    }, [initializeSocket]);

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