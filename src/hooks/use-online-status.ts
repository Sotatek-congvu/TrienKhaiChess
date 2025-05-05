import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface User {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
    rating?: number;
}

export const useOnlineStatus = (user: User | null) => {
    useEffect(() => {
        if (!user) return;

        // Hàm cập nhật trạng thái trực tuyến
        const updatePresence = async () => {
            await supabase
                .from('online_players')
                .upsert({
                    id: user.id,
                    username: user.username,
                    display_name: user.display_name || user.username,
                    avatar_url: user.avatar_url || '',
                    rating: user.rating || 1200,
                    last_seen: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });
        };

        // Cập nhật ngay khi user đăng nhập
        updatePresence();

        // Cập nhật định kỳ mỗi 10 giây (heartbeat)
        const interval = setInterval(updatePresence, 10000);

        // Xóa trạng thái khi người chơi rời đi (ngắt kết nối)
        const handleDisconnect = async () => {
            await supabase
                .from('online_players')
                .delete()
                .eq('id', user.id);
        };

        // Thiết lập các sự kiện tương tác người dùng để cập nhật presence
        const handleActivity = () => {
            updatePresence();
        };

        // Lắng nghe các sự kiện tương tác người dùng
        window.addEventListener('click', handleActivity);
        window.addEventListener('keypress', handleActivity);
        window.addEventListener('mousemove', handleActivity);

        // Gọi hàm xóa khi component unmount
        return () => {
            clearInterval(interval);
            window.removeEventListener('click', handleActivity);
            window.removeEventListener('keypress', handleActivity);
            window.removeEventListener('mousemove', handleActivity);
            handleDisconnect();
        };
    }, [user]);
};