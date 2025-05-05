import { useEffect, useState, useCallback } from 'react';
import { PieceColor } from '@/lib/chess-models';
import { Button } from '@/components/ui/button';
import { HelpCircle, Users, LogOut, UserPlus, RefreshCw, Clock, Trophy } from 'lucide-react';
import { toast } from "sonner";
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import OnlinePlayersIndicator from '@/components/OnlinePlayersIndicator';
import { supabase } from '@/lib/supabase';
import { useOnlineGame } from '@/hooks/use-online-game';
import { useOnlinePlayers } from '@/hooks/use-online-players';
import GameRules from '@/components/GameRules';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";

// Kiểu dữ liệu cho một trận đấu đang diễn ra
interface ActiveGame {
    id: string;
    white_player: {
        id: string;
        username: string;
        display_name?: string;
        avatar_url?: string;
        rating: number;
    };
    black_player: {
        id: string;
        username: string;
        display_name?: string;
        avatar_url?: string;
        rating: number;
    };
    created_at: string;
    status: 'waiting' | 'pending' | 'active' | 'completed' | 'abandoned';
    time_control: number;
    increment_time: number;
}

const Lobby = () => {
    const navigate = useNavigate();
    const { signOut, profile, user } = useAuth();
    const [showRules, setShowRules] = useState<boolean>(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isCreatingGame, setIsCreatingGame] = useState<boolean>(false);

    // Sử dụng hook theo dõi người chơi online
    const { players, count } = useOnlinePlayers();

    const { createGame } = useOnlineGame({});

    const handleSignOut = async () => {
        try {
            setIsLoggingOut(true);
            console.log("Đang đăng xuất...");
            await signOut();
            console.log("Đăng xuất thành công");
            toast.success("Đăng xuất thành công");
        } catch (error) {
            console.error("Lỗi khi đăng xuất:", error);
            toast.error("Đã xảy ra lỗi khi đăng xuất");
        } finally {
            setIsLoggingOut(false);
        }
    };

    // Lấy danh sách trận đấu đang diễn ra
    const fetchActiveGames = useCallback(async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('games')
                .select(`
                    id,
                    created_at,
                    status,
                    time_control,
                    increment_time,
                    white_player:white_player_id(id, username, display_name, avatar_url, rating),
                    black_player:black_player_id(id, username, display_name, avatar_url, rating)
                `)
                .in('status', ['active', 'waiting'])
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                throw error;
            }

            // Type assertion to ensure compatibility
            setActiveGames(data as unknown as ActiveGame[]);
        } catch (error) {
            console.error("Lỗi khi lấy danh sách trận đấu:", error);
            toast.error("Không thể tải danh sách trận đấu");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchActiveGames();

        // Đăng ký kênh realtime để lắng nghe thay đổi từ bảng games
        const gamesChannel = supabase
            .channel('public:games')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'games' },
                () => {
                    fetchActiveGames(); // Cập nhật danh sách trò chơi khi có thay đổi
                }
            )
            .subscribe();

        return () => {
            // Hủy đăng ký kênh khi component unmount
            gamesChannel.unsubscribe();
        };
    }, [fetchActiveGames]);

    // Xử lý tạo trò chơi mới
    const handleCreateGame = async (opponentId?: string) => {
        if (isCreatingGame) return; // Prevent multiple clicks

        try {
            setIsCreatingGame(true);
            // Tạo thông báo đang thực hiện
            const toastId = toast.loading("Đang tạo trận đấu mới...");

            const gameId = await createGame();
            if (gameId) {
                toast.dismiss(toastId);
                toast.success("Đã tạo trận đấu thành công");

                // Nếu có người chơi được mời, gửi thông báo
                if (opponentId) {
                    await supabase
                        .from('messages')
                        .insert({
                            user_id: opponentId,
                            content: `${profile?.display_name || profile?.username} đã mời bạn vào một trận đấu mới`,
                            type: 'game_invite',
                            game_id: gameId,
                            created_at: new Date().toISOString(),
                            read: false
                        });
                }

                navigate(`/game/${gameId}`);
            }
        } catch (error) {
            console.error("Error creating game:", error);
            toast.error("Không thể tạo trận đấu");
        } finally {
            setIsCreatingGame(false);
        }
    };

    // Tham gia một trận đấu đang diễn ra
    const joinGame = (gameId: string) => {
        navigate(`/game/${gameId}`);
    };

    // Mời người chơi vào trận đấu mới
    const invitePlayer = async (playerId: string) => {
        try {
            toast.loading(`Đang mời người chơi...`);
            await handleCreateGame(playerId);
        } catch (error) {
            console.error("Lỗi khi mời người chơi:", error);
            toast.error("Không thể mời người chơi");
        }
    };

    return (
        <div className="min-h-screen bg-[#312e2b] text-white p-4 sm:p-6">
            <div className="max-w-6xl mx-auto">
                <motion.header
                    className="mb-6 relative flex flex-wrap items-center justify-between gap-4"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="flex flex-col items-start">
                        <h1 className="text-2xl md:text-3xl font-bold text-white">
                            Phòng chờ Chessmihouse
                        </h1>
                        <p className="text-gray-400 text-sm">
                            Tìm đối thủ và thách đấu trong cờ vua 6x6 với luật Crazyhouse
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {profile && (
                            <div className="flex items-center gap-2 mr-2 bg-[#3a3633] px-4 py-2 rounded-lg border border-amber-500/50 shadow-lg">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={profile.avatar_url || ''} alt={profile.username} />
                                    <AvatarFallback>{(profile.username || '').substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="text-gray-300 text-xs">Đang đăng nhập với</span>
                                    <span className="font-medium text-amber-400 text-sm">{profile.display_name || profile.username}</span>
                                </div>
                            </div>
                        )}

                        <OnlinePlayersIndicator className="mr-2" showList={true} onChallengePlayer={invitePlayer} />

                        <div className="flex items-center gap-1">
                            <Button
                                variant="default"
                                size="sm"
                                className="flex items-center gap-1"
                                onClick={() => navigate('/')}
                            >
                                <Users size={16} />
                                <span className="hidden sm:inline">Trang chủ</span>
                            </Button>

                            <Button
                                variant="secondary"
                                size="sm"
                                className="flex items-center gap-1"
                                onClick={() => handleCreateGame()}
                                disabled={isCreatingGame}
                            >
                                {isCreatingGame ? (
                                    <>
                                        <div className="h-4 w-4 border-t-2 border-r-2 border-current rounded-full animate-spin mr-1"></div>
                                        <span className="hidden sm:inline">Đang tạo...</span>
                                    </>
                                ) : (
                                    <>
                                        <UserPlus size={16} />
                                        <span className="hidden sm:inline">Tạo trận mới</span>
                                    </>
                                )}
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-300 hover:text-white hover:bg-gray-700"
                                onClick={() => setShowRules(true)}
                            >
                                <HelpCircle size={16} />
                                <span className="hidden sm:inline">Luật chơi</span>
                            </Button>

                            <Button
                                variant="destructive"
                                size="sm"
                                className="flex items-center gap-1"
                                onClick={handleSignOut}
                                disabled={isLoggingOut}
                            >
                                {isLoggingOut ? (
                                    <>
                                        <div className="h-4 w-4 border-t-2 border-r-2 border-white rounded-full animate-spin mr-1" />
                                        <span className="hidden sm:inline">Đang đăng xuất...</span>
                                    </>
                                ) : (
                                    <>
                                        <LogOut size={16} />
                                        <span className="hidden sm:inline">Đăng xuất</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </motion.header>

                <Tabs defaultValue="games" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="games" className="text-lg">Trận đấu đang diễn ra</TabsTrigger>
                        <TabsTrigger value="players" className="text-lg">Người chơi trực tuyến</TabsTrigger>
                    </TabsList>

                    <TabsContent value="games">
                        <Card className="bg-[#272522] border-gray-700">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Trận đấu đang diễn ra</CardTitle>
                                    <CardDescription className="text-gray-400">
                                        Tham gia hoặc theo dõi các trận đấu
                                    </CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={fetchActiveGames}
                                    disabled={isLoading}
                                >
                                    <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex justify-center py-8">
                                        <div className="w-8 h-8 border-t-2 border-l-2 border-blue-500 rounded-full animate-spin"></div>
                                    </div>
                                ) : activeGames.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Người chơi</TableHead>
                                                <TableHead>Đối thủ</TableHead>
                                                <TableHead className="hidden md:table-cell">Thời gian</TableHead>
                                                <TableHead className="hidden md:table-cell">Trạng thái</TableHead>
                                                <TableHead className="text-right">Hành động</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activeGames.map((game) => (
                                                <TableRow key={game.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarImage src={game.white_player?.avatar_url || ''} alt={game.white_player?.username} />
                                                                <AvatarFallback>{game.white_player?.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <div className="font-medium">{game.white_player?.display_name || game.white_player?.username}</div>
                                                                <div className="text-xs text-gray-400">{game.white_player?.rating} Elo</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarImage src={game.black_player?.avatar_url || ''} alt={game.black_player?.username || 'Chờ'} />
                                                                <AvatarFallback>{game.black_player ? game.black_player.username.substring(0, 2).toUpperCase() : '?'}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <div className="font-medium">{game.black_player?.display_name || game.black_player?.username || 'Đang chờ đối thủ...'}</div>
                                                                <div className="text-xs text-gray-400">{game.black_player?.rating ? `${game.black_player.rating} Elo` : ''}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        <div className="flex items-center gap-1">
                                                            <Clock size={14} />
                                                            <span>{Math.floor(game.time_control / 60)}:{(game.time_control % 60).toString().padStart(2, '0')}</span>
                                                            {game.increment_time > 0 && <span>+{game.increment_time}s</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${game.status === 'active'
                                                            ? 'bg-green-900/30 text-green-400'
                                                            : 'bg-yellow-900/30 text-yellow-400'
                                                            }`}>
                                                            {game.status === 'active' ? 'Đang chơi' : 'Chờ người tham gia'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => joinGame(game.id)}
                                                        >
                                                            {!game.black_player && game.white_player?.id !== user?.id ? 'Tham gia' : 'Xem'}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="text-center py-8 text-gray-400">
                                        <Trophy size={40} className="mx-auto mb-2 opacity-50" />
                                        <p>Không có trận đấu nào đang diễn ra</p>
                                        <p className="text-sm mt-2">
                                            Hãy tạo một trận đấu mới để bắt đầu!
                                        </p>
                                        <Button
                                            variant="default"
                                            className="mt-4"
                                            onClick={() => handleCreateGame()}
                                            disabled={isCreatingGame}
                                        >
                                            {isCreatingGame ? "Đang tạo..." : "Tạo trận đấu mới"}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="players">
                        <Card className="bg-[#272522] border-gray-700">
                            <CardHeader>
                                <CardTitle>Người chơi trực tuyến ({count})</CardTitle>
                                <CardDescription className="text-gray-400">
                                    Tìm và thách đấu người chơi khác
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {players.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {players.map((player) => (
                                            <div
                                                key={player.id}
                                                className="flex items-center justify-between p-4 rounded-lg bg-[#3a3633] border border-gray-700"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border border-gray-600">
                                                        <AvatarImage src={player.avatar_url || ''} alt={player.username} />
                                                        <AvatarFallback>{player.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{player.display_name || player.username}</div>
                                                        <div className="text-xs text-gray-400">{player.rating || 1200} Elo</div>
                                                    </div>
                                                </div>

                                                {player.id !== user?.id && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => invitePlayer(player.id)}
                                                    >
                                                        Thách đấu
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400">
                                        <Users size={40} className="mx-auto mb-2 opacity-50" />
                                        <p>Không có người chơi trực tuyến</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            <AnimatePresence>
                {showRules && <GameRules onClose={() => setShowRules(false)} />}
            </AnimatePresence>
        </div>
    );
};

export default Lobby;