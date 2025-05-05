import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/context/AuthContext';

interface OnlinePlayer {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string | null;
    rating?: number;
    last_active?: string;
}

interface OnlinePlayersState {
    count: number;
    players: OnlinePlayer[];
    loading: boolean;
}

/**
 * Hook to track online players in the system using Supabase Presence
 */
export const useOnlinePlayers = () => {
    const [state, setState] = useState<OnlinePlayersState>({
        count: 0,
        players: [],
        loading: true,
    });
    const [channel, setChannel] = useState<RealtimeChannel | null>(null);
    const { user, profile } = useAuth();

    useEffect(() => {
        if (!user || !profile) return;

        // Create a realtime channel to track online users
        const presenceChannel = supabase.channel('online-players', {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        // Set up handlers for presence events
        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const presenceState = presenceChannel.presenceState();
                const playersList: OnlinePlayer[] = [];
                let totalPlayers = 0;

                // Convert presenceState data into an array of players
                Object.keys(presenceState).forEach((presenceId) => {
                    const playerInfoArray = presenceState[presenceId];
                    playerInfoArray.forEach((playerInfo: any) => {
                        totalPlayers++;
                        if (playerInfo.username) {
                            playersList.push({
                                id: playerInfo.user_id,
                                username: playerInfo.username,
                                display_name: playerInfo.display_name,
                                avatar_url: playerInfo.avatar_url,
                                rating: playerInfo.rating || 1200,
                                last_active: playerInfo.last_active,
                            });
                        }
                    });
                });

                // Sort players by rating (high to low)
                playersList.sort((a, b) => {
                    const ratingA = a.rating || 1200;
                    const ratingB = b.rating || 1200;
                    return ratingB - ratingA;
                });

                // Update state with online player information
                setState({
                    count: totalPlayers,
                    players: playersList,
                    loading: false,
                });
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('Player joined:', newPresences);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('Player left:', leftPresences);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Once connected, send own status
                    await presenceChannel.track({
                        user_id: user.id,
                        username: profile.username,
                        display_name: profile.display_name,
                        avatar_url: profile.avatar_url,
                        rating: profile.rating || 1200,
                        online_at: new Date().toISOString(),
                        last_active: new Date().toISOString(),
                    });
                }
            });

        setChannel(presenceChannel);

        // Cleanup when component unmounts
        return () => {
            if (presenceChannel) {
                presenceChannel.unsubscribe();
            }
        };
    }, [user, profile]);

    // Update presence status when the user is active (e.g., interacting with the page)
    const updatePresence = async () => {
        if (channel && user && profile) {
            try {
                await channel.track({
                    user_id: user.id,
                    username: profile.username,
                    display_name: profile.display_name,
                    avatar_url: profile.avatar_url,
                    rating: profile.rating || 1200,
                    last_active: new Date().toISOString(),
                });
            } catch (error) {
                console.error('Error updating presence:', error);
            }
        }
    };

    return {
        ...state,
        updatePresence,
    };
};