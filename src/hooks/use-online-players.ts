import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel, User } from '@supabase/supabase-js';
import { useAuth } from '@/context/AuthContext';
import { Profile } from '@/types/database.types';

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
    updatePresence: () => Promise<void>;
}

/**
 * Hook to track online players in the system using Supabase Presence
 */
export const useOnlinePlayers = (): OnlinePlayersState => {
    const [state, setState] = useState<OnlinePlayersState>({
        count: 0,
        players: [],
        loading: true,
        updatePresence: async () => { }
    });
    const [channel, setChannel] = useState<RealtimeChannel | null>(null);
    const { user, profile } = useAuth();

    // Helper to get a display name from various sources
    const getDisplayName = (user: User | null, profile: Profile | null): string => {
        if (profile?.display_name) return profile.display_name;
        if (profile?.username) return profile.username;
        if (user?.email) return user.email.split('@')[0];
        return 'User';
    };

    // Function to update presence status
    const updatePresence = useCallback(async () => {
        if (channel && user) {
            try {
                // Create a presence payload with all necessary user info
                const presenceData = {
                    user_id: user.id,
                    username: profile?.username || (user.email ? user.email.split('@')[0] : 'user'),
                    display_name: profile?.display_name || profile?.username || (user.email ? user.email.split('@')[0] : 'user'),
                    avatar_url: profile?.avatar_url || null,
                    rating: profile?.rating || 1200,
                    last_active: new Date().toISOString(),
                };

                await channel.track(presenceData);
                console.log("Presence updated successfully:", presenceData);
            } catch (error) {
                console.error('Error updating presence:', error);
            }
        } else {
            console.log("Cannot update presence - missing user or channel connection");
        }
    }, [channel, user, profile]);

    useEffect(() => {
        // Update the updatePresence function whenever it changes
        setState(prev => ({
            ...prev,
            updatePresence
        }));
    }, [updatePresence]);

    useEffect(() => {
        let presenceChannel: RealtimeChannel | null = null;

        const setupPresenceChannel = async () => {
            try {
                // If no user, set empty state and return
                if (!user) {
                    setState(prev => ({
                        ...prev,
                        loading: false,
                        count: 0,
                        players: []
                    }));
                    return;
                }

                // Create a channel name based on the environment for isolation
                const channelName = window.location.hostname.includes('github.io')
                    ? `online-players-${window.location.pathname.split('/')[1]}`
                    : 'online-players';

                console.log(`Setting up presence channel: ${channelName}`);

                // Create a realtime channel to track online users
                presenceChannel = supabase.channel(channelName, {
                    config: {
                        presence: {
                            key: user.id,
                        },
                    },
                });

                // Set up handlers for presence events
                presenceChannel
                    .on('presence', { event: 'sync' }, () => {
                        try {
                            if (!presenceChannel) return;

                            const presenceState = presenceChannel.presenceState();
                            const playersList: OnlinePlayer[] = [];
                            let totalPlayers = 0;

                            // Convert presenceState data into an array of players
                            Object.keys(presenceState).forEach((presenceId) => {
                                const playerInfoArray = presenceState[presenceId];
                                playerInfoArray.forEach((playerInfo: any) => {
                                    totalPlayers++;
                                    if (playerInfo.user_id) {
                                        playersList.push({
                                            id: playerInfo.user_id,
                                            username: playerInfo.username || 'User',
                                            display_name: playerInfo.display_name,
                                            avatar_url: playerInfo.avatar_url,
                                            rating: playerInfo.rating || 1200,
                                            last_active: playerInfo.last_active,
                                        });
                                    }
                                });
                            });

                            // Make sure we don't have duplicate players (same user ID)
                            const uniquePlayers = playersList.reduce((acc: OnlinePlayer[], current) => {
                                const x = acc.find(item => item.id === current.id);
                                if (!x) {
                                    return acc.concat([current]);
                                } else {
                                    return acc;
                                }
                            }, []);

                            // Sort players by rating (high to low)
                            uniquePlayers.sort((a, b) => {
                                const ratingA = a.rating || 1200;
                                const ratingB = b.rating || 1200;
                                return ratingB - ratingA;
                            });

                            console.log(`Presence sync: ${totalPlayers} players online`);

                            // Update state with online player information
                            setState(prev => ({
                                ...prev,
                                count: uniquePlayers.length,
                                players: uniquePlayers,
                                loading: false
                            }));
                        } catch (error) {
                            console.error('Error processing presence state:', error);
                        }
                    })
                    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                        console.log('Player joined:', newPresences);
                    })
                    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                        console.log('Player left:', leftPresences);
                    })
                    .subscribe(async (status) => {
                        console.log('Presence channel status:', status);
                        if (status === 'SUBSCRIBED') {
                            // Once connected, send own status
                            if (user) {
                                const userInfo = {
                                    user_id: user.id,
                                    username: profile?.username || (user.email ? user.email.split('@')[0] : 'user'),
                                    display_name: profile?.display_name || profile?.username || (user.email ? user.email.split('@')[0] : 'user'),
                                    avatar_url: profile?.avatar_url || null,
                                    rating: profile?.rating || 1200,
                                    online_at: new Date().toISOString(),
                                    last_active: new Date().toISOString(),
                                };

                                await presenceChannel.track(userInfo);
                                console.log('Initial presence tracked:', userInfo);
                            }
                        }
                    });

                setChannel(presenceChannel);
            } catch (error) {
                console.error('Error setting up presence channel:', error);
                setState(prev => ({
                    ...prev,
                    loading: false
                }));
            }
        };

        setupPresenceChannel();

        // Cleanup when component unmounts
        return () => {
            if (presenceChannel) {
                console.log('Unsubscribing from presence channel');
                presenceChannel.unsubscribe();
            }
        };
    }, [user?.id]); // Only re-run if user ID changes

    return state;
};