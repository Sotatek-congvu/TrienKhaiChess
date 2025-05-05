import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Player {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    rating: number;
}

interface OnlinePlayers {
    players: Player[];
    count: number;
}

export const useOnlinePlayers = (): OnlinePlayers => {
    const [players, setPlayers] = useState<Player[]>([]);
    const [count, setCount] = useState(0);

    useEffect(() => {
        // Lấy danh sách người chơi trực tuyến
        const fetchOnlinePlayers = async () => {
            const { data, error } = await supabase
                .from('online_players')
                .select(`
                    id,
                    last_seen,
                    profiles(
                        id,
                        username,
                        display_name,
                        avatar_url,
                        rating
                    )
                `)
                .gt('last_seen', new Date(Date.now() - 15000).toISOString()); // Lấy người chơi có last_seen trong 15 giây qua

            if (error) {
                console.error('Lỗi khi lấy danh sách người chơi trực tuyến:', error);
                return;
            }

            // Chuyển đổi dữ liệu từ join query sang định dạng Player
            const formattedPlayers: Player[] = data?.map(item => {
                // Check if profiles exists and contains data
                if (item.profiles) {
                    const profile = item.profiles;
                    return {
                        id: profile.id,
                        username: profile.username,
                        display_name: profile.display_name,
                        avatar_url: profile.avatar_url,
                        rating: profile.rating || 1200 // Mặc định rating 1200 nếu không có
                    };
                }
                // Fallback if profile is missing
                return {
                    id: item.id,
                    username: "Unknown",
                    rating: 1200
                };
            }) || [];

            setPlayers(formattedPlayers);
            setCount(formattedPlayers.length);
        };

        fetchOnlinePlayers();

        // Đăng ký kênh Realtime để lắng nghe thay đổi
        const channel = supabase
            .channel('public:online_players')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'online_players' },
                () => {
                    fetchOnlinePlayers(); // Cập nhật danh sách khi có thay đổi
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, []);

    return { players, count };
};