import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '@/context/SocketContext';
import { toast } from 'sonner';

export const useChallenge = () => {
    const navigate = useNavigate();
    const { socket, isConnected } = useSocket();
    const [isLoading, setIsLoading] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

    // Hàm xử lý chuyển hướng
    const handleNavigation = useCallback((route: string) => {
        console.log('Attempting navigation to:', route);
        try {
            navigate(route);
            setPendingNavigation(null);
        } catch (error) {
            console.error('Navigation failed:', error);
            setPendingNavigation(route);
        }
    }, [navigate]);

    useEffect(() => {
        if (!socket) return;

        // Lắng nghe sự kiện game bắt đầu
        const handleGameStarted = (gameData: any) => {
            console.log('Game started:', gameData);
            toast.success('Game is starting!');

            // Lưu route cần chuyển hướng và thực hiện chuyển hướng
            const gameRoute = `/game/${gameData.roomId}`;
            console.log('Setting game route:', gameRoute);

            // Đợi một chút để đảm bảo socket đã sẵn sàng
            setTimeout(() => {
                if (isConnected) {
                    console.log('Connected, navigating immediately');
                    handleNavigation(gameRoute);
                } else {
                    console.log('Not connected, setting pending navigation');
                    setPendingNavigation(gameRoute);
                }
            }, 1000);
        };

        // Xử lý kết nối
        const handleConnect = () => {
            console.log('Connected to server');
            toast.success('Connected to server');

            // Nếu có pending navigation, thực hiện chuyển hướng sau một khoảng thời gian
            if (pendingNavigation) {
                console.log('Executing pending navigation:', pendingNavigation);
                setTimeout(() => {
                    handleNavigation(pendingNavigation);
                }, 1000);
            }
        };

        // Xử lý ngắt kết nối
        const handleDisconnect = () => {
            console.log('Disconnected from server');
            toast.error('Disconnected from server. Attempting to reconnect...');
        };

        // Xử lý kết nối lại
        const handleReconnect = () => {
            console.log('Reconnected to server');
            toast.success('Reconnected to server');

            // Nếu có pending navigation, thực hiện chuyển hướng sau một khoảng thời gian
            if (pendingNavigation) {
                console.log('Executing pending navigation after reconnect:', pendingNavigation);
                setTimeout(() => {
                    handleNavigation(pendingNavigation);
                }, 1000);
            }
        };

        // Lắng nghe sự kiện thách đấu
        const handleChallengeReceived = (challenge: any) => {
            console.log('Challenge received:', challenge);
            toast.info(`${challenge.challenger.displayName} has challenged you to a game!`);
        };

        // Lắng nghe sự kiện thách đấu bị từ chối
        const handleChallengeDeclined = (challenge: any) => {
            console.log('Challenge declined:', challenge);
            toast.info(`${challenge.challenged.displayName} declined your challenge`);
        };

        // Lắng nghe sự kiện thách đấu bị hủy
        const handleChallengeCancelled = (challenge: any) => {
            console.log('Challenge cancelled:', challenge);
            toast.info(`${challenge.challenger.displayName} cancelled the challenge`);
        };

        // Lắng nghe sự kiện thách đấu hết hạn
        const handleChallengeExpired = (challenge: any) => {
            console.log('Challenge expired:', challenge);
            toast.info('Challenge has expired');
        };

        // Đăng ký các event listeners
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('reconnect', handleReconnect);
        socket.on('game:started', handleGameStarted);
        socket.on('challenge:received', handleChallengeReceived);
        socket.on('challenge:declined', handleChallengeDeclined);
        socket.on('challenge:cancelled', handleChallengeCancelled);
        socket.on('challenge:expired', handleChallengeExpired);

        // Cleanup
        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('reconnect', handleReconnect);
            socket.off('game:started', handleGameStarted);
            socket.off('challenge:received', handleChallengeReceived);
            socket.off('challenge:declined', handleChallengeDeclined);
            socket.off('challenge:cancelled', handleChallengeCancelled);
            socket.off('challenge:expired', handleChallengeExpired);
        };
    }, [socket, navigate, isConnected, pendingNavigation, handleNavigation]);

    // Hàm gửi thách đấu
    const sendChallenge = async (challengedUserId: string) => {
        if (!socket || !isConnected) {
            toast.error('Not connected to server');
            return;
        }
        setIsLoading(true);
        try {
            socket.emit('challenge:send', { challengedUserId });
        } catch (error) {
            console.error('Failed to send challenge:', error);
            toast.error('Failed to send challenge');
        } finally {
            setIsLoading(false);
        }
    };

    // Hàm chấp nhận thách đấu
    const acceptChallenge = async (challengeId: string) => {
        if (!socket || !isConnected) {
            toast.error('Not connected to server');
            return;
        }
        setIsLoading(true);
        try {
            console.log('Accepting challenge:', challengeId);
            socket.emit('challenge:accept', { challengeId });
        } catch (error) {
            console.error('Failed to accept challenge:', error);
            toast.error('Failed to accept challenge');
        } finally {
            setIsLoading(false);
        }
    };

    // Hàm từ chối thách đấu
    const declineChallenge = async (challengeId: string) => {
        if (!socket || !isConnected) {
            toast.error('Not connected to server');
            return;
        }
        setIsLoading(true);
        try {
            socket.emit('challenge:decline', { challengeId });
        } catch (error) {
            console.error('Failed to decline challenge:', error);
            toast.error('Failed to decline challenge');
        } finally {
            setIsLoading(false);
        }
    };

    // Hàm hủy thách đấu
    const cancelChallenge = async (challengeId: string) => {
        if (!socket || !isConnected) {
            toast.error('Not connected to server');
            return;
        }
        setIsLoading(true);
        try {
            socket.emit('challenge:cancel', { challengeId });
        } catch (error) {
            console.error('Failed to cancel challenge:', error);
            toast.error('Failed to cancel challenge');
        } finally {
            setIsLoading(false);
        }
    };

    return {
        sendChallenge,
        acceptChallenge,
        declineChallenge,
        cancelChallenge,
        isLoading,
        isConnected
    };
}; 