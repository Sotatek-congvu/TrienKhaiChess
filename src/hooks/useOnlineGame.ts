import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Socket } from 'socket.io-client';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface GameState {
    whitePlayer?: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl?: string;
    };
    blackPlayer?: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl?: string;
    };
    currentTurn: string;
}

interface GameUser {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
}

const useOnlineGame = (gameId: string, user: SupabaseUser) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [playerColor, setPlayerColor] = useState<string>('white');
    const [opponent, setOpponent] = useState<GameUser | null>(null);
    const [isMyTurn, setIsMyTurn] = useState<boolean>(false);
    const [hasJoinedRoom, setHasJoinedRoom] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    useEffect(() => {
        if (!socket || !gameId) return;

        console.log('Setting up game room listeners for game:', gameId);
        setIsLoading(true);

        const handleGameState = (data: any) => {
            console.log('Received game state:', data);
            setGameState(data);
            setPlayerColor(data.whitePlayer?.id === user?.id ? 'white' : 'black');
            setOpponent(data.whitePlayer?.id === user?.id ? data.blackPlayer : data.whitePlayer);
            setIsMyTurn(data.currentTurn === (data.whitePlayer?.id === user?.id ? 'white' : 'black'));
            setIsLoading(false);
        };

        const handleError = (error: any) => {
            console.error('Game room error:', error);
            toast.error('Failed to join game room');
            setIsLoading(false);
        };

        // Join room and get initial state
        socket.emit('joinRoom', { roomId: gameId }, (response: any) => {
            if (response.success) {
                console.log('Successfully joined room:', gameId);
                setHasJoinedRoom(true);
                // Get initial game state
                socket.emit('getGameState', { roomId: gameId }, handleGameState);
            } else {
                console.error('Failed to join room:', response.error);
                handleError(response.error);
            }
        });

        // Listen for game state updates
        socket.on('gameState', handleGameState);
        socket.on('gameError', handleError);

        return () => {
            console.log('Cleaning up game room listeners');
            socket.off('gameState');
            socket.off('gameError');
            socket.emit('leaveRoom', { roomId: gameId });
        };
    }, [socket, gameId, user?.id]);

    return {
        socket,
        gameState,
        playerColor,
        opponent,
        isMyTurn,
        hasJoinedRoom,
        isLoading
    };
};

export default useOnlineGame; 