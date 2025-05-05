import React, { useEffect, useState } from 'react';
import { useOnlinePlayers } from '@/hooks/use-online-players';
import { UserPlus, Users, Trophy, ChevronDown } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';
import {
    Badge
} from '@/components/ui/badge';
import {
    Avatar,
    AvatarFallback,
    AvatarImage
} from '@/components/ui/avatar';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger
} from '@/components/ui/sheet';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Importing proper types for Supabase User
import { User } from '@supabase/supabase-js';

interface OnlinePlayersIndicatorProps {
    showList?: boolean;
    className?: string;
    onChallengePlayer?: (playerId: string) => void;
}

export const OnlinePlayersIndicator: React.FC<OnlinePlayersIndicatorProps> = ({
    showList = false,
    className,
    onChallengePlayer,
}) => {
    const { count, players, loading, updatePresence } = useOnlinePlayers();
    const { user, profile } = useAuth();
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    // Cập nhật presence khi người dùng tương tác
    useEffect(() => {
        // Cập nhật presence mỗi khi component mount
        updatePresence();

        // Thiết lập interval để cập nhật định kỳ (tránh bị coi là không hoạt động)
        const interval = setInterval(() => {
            updatePresence();
        }, 30000); // Cập nhật 30s một lần

        // Thiết lập listener cho các sự kiện tương tác
        const handleActivity = () => {
            updatePresence();
        };

        // Lắng nghe các sự kiện tương tác người dùng
        window.addEventListener('click', handleActivity);
        window.addEventListener('keypress', handleActivity);
        window.addEventListener('scroll', handleActivity);
        window.addEventListener('mousemove', handleActivity);

        // Cleanup
        return () => {
            clearInterval(interval);
            window.removeEventListener('click', handleActivity);
            window.removeEventListener('keypress', handleActivity);
            window.removeEventListener('scroll', handleActivity);
            window.removeEventListener('mousemove', handleActivity);
        };
    }, [updatePresence]);

    // Xử lý challenge người chơi
    const handleChallenge = (playerId: string) => {
        if (!user) {
            toast.error('Vui lòng đăng nhập để thách đấu');
            return;
        }

        if (playerId === user.id) {
            toast.error('Bạn không thể thách đấu chính mình');
            return;
        }

        if (onChallengePlayer) {
            toast.loading('Đang gửi lời thách đấu...');
            onChallengePlayer(playerId);
        } else {
            toast.info('Vui lòng vào phòng chờ để thách đấu người chơi');
        }

        // Đóng Sheet sau khi thách đấu
        setIsSheetOpen(false);
    };

    // Lấy chữ cái đầu của tên người dùng
    const getInitials = (name: string) => {
        if (!name) return '?';
        return name.charAt(0).toUpperCase();
    };

    // Helper to get a display name from various sources
    const getDisplayName = (user: User | null, profile: any | null): string => {
        if (profile?.display_name) return profile.display_name;
        if (profile?.username) return profile.username;
        if (user?.email) return user.email.split('@')[0];
        return 'User';
    };

    if (loading) {
        return (
            <div className={cn("flex items-center text-gray-400 text-sm", className)}>
                <Users size={18} className="mr-1 animate-pulse" />
                <span>Đang kết nối...</span>
            </div>
        );
    }

    // Loại bỏ người dùng hiện tại khỏi danh sách (nếu có)
    const filteredPlayers = user ? players.filter(player => player.id !== user.id) : players;

    // Đảm bảo count hiển thị chính xác
    const displayCount = Math.max(filteredPlayers.length + (user ? 1 : 0), count);

    return (
        <>
            <TooltipProvider>
                <Tooltip>
                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <SheetTrigger asChild>
                            <TooltipTrigger asChild>
                                <div className={cn("flex items-center text-green-400 cursor-pointer", className)}>
                                    <Badge variant="secondary" className="flex items-center gap-1 py-0.5 px-2">
                                        <Users size={16} className="text-green-500" />
                                        <span className="font-medium">{displayCount}</span>
                                    </Badge>
                                </div>
                            </TooltipTrigger>
                        </SheetTrigger>

                        <TooltipContent className="bg-gray-900 p-2 border-gray-800 max-w-[300px]">
                            <div>
                                <div className="font-medium mb-1 text-green-400">{displayCount} người chơi đang trực tuyến</div>
                                {showList && players.length > 0 && (
                                    <div className="max-h-[150px] overflow-y-auto">
                                        <ul className="text-xs space-y-0.5">
                                            {players.map((player) => (
                                                <li key={player.id} className="flex items-center gap-1">
                                                    <Users size={12} className="text-green-500" />
                                                    <span>{player.display_name || player.username}</span>
                                                </li>
                                            ))}
                                            {user && !players.some(p => p.id === user.id) && (
                                                <li className="flex items-center gap-1">
                                                    <Users size={12} className="text-blue-500" />
                                                    <span>{getDisplayName(user, profile)} (Bạn)</span>
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                                <div className="mt-1 text-xs text-gray-400">Nhấn để xem danh sách chi tiết</div>
                            </div>
                        </TooltipContent>

                        <SheetContent className="w-[320px] sm:w-[440px] p-0">
                            <SheetHeader className="p-4 border-b border-gray-800">
                                <SheetTitle className="flex items-center gap-2 text-green-400">
                                    <Users size={20} className="text-green-500" />
                                    <span>Người chơi trực tuyến ({displayCount})</span>
                                </SheetTitle>
                            </SheetHeader>
                            <div className="p-4">
                                {filteredPlayers.length === 0 && !user ? (
                                    <div className="text-center py-6 text-gray-400">
                                        Không có người chơi trực tuyến
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredPlayers.map(player => (
                                            <div key={player.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-800/50">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border border-gray-700">
                                                        <AvatarImage src={player.avatar_url || undefined} alt={player.display_name || player.username} />
                                                        <AvatarFallback className="bg-gray-800">
                                                            {getInitials(player.display_name || player.username)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{player.display_name || player.username}</div>
                                                        <div className="flex items-center text-sm text-gray-400">
                                                            <Trophy size={14} className="mr-1 text-yellow-500" />
                                                            <span>{player.rating || 1200}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {user && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm">
                                                                <ChevronDown size={16} />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleChallenge(player.id)}>
                                                                <UserPlus className="mr-2 h-4 w-4" />
                                                                <span>Thách đấu</span>
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        ))}

                                        {user && !players.some(p => p.id === user.id) && (
                                            <div className="flex items-center justify-between p-2 rounded-md bg-blue-900/20 border border-blue-800/30">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border border-blue-700">
                                                        <AvatarImage src={profile?.avatar_url || undefined} alt="Bạn" />
                                                        <AvatarFallback className="bg-blue-800">
                                                            {getInitials(getDisplayName(user, profile))}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium flex items-center">
                                                            {getDisplayName(user, profile)}
                                                            <Badge variant="outline" className="ml-2 text-xs bg-blue-800/30 border-blue-700">Bạn</Badge>
                                                        </div>
                                                        {profile && (
                                                            <div className="flex items-center text-sm text-gray-400">
                                                                <Trophy size={14} className="mr-1 text-yellow-500" />
                                                                <span>{profile.rating || 1200}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>
                </Tooltip>
            </TooltipProvider>
        </>
    );
};

export default OnlinePlayersIndicator;