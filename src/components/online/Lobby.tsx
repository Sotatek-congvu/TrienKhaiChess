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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

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

// Kiểu dữ liệu cho lời mời thách đấu qua WebSocket
interface GameInvitation {
    type: 'invite';
    gameId: string;
    inviterId: string;
    invitedId: string;
    inviterName: string;
    time_control: number;
    timestamp: number;
}

// Kiểu dữ liệu cho phản hồi lời mời
interface InviteResponse {
    type: 'accept' | 'decline';
    gameId: string;
    inviterId: string;
    invitedId: string;
}

const Lobby = () => {
    const navigate = useNavigate();
    const { signOut, profile, user } = useAuth();
    const [showRules, setShowRules] = useState<boolean>(false);
    const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
    const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isCreatingGame, setIsCreatingGame] = useState<boolean>(false);
    const [invitation, setInvitation] = useState<GameInvitation | null>(null);
    const [ws, setWs] = useState<WebSocket | null>(null);

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

            setActiveGames(data as unknown as ActiveGame[]);
        } catch (error) {
            console.error("Lỗi khi lấy danh sách trận đấu:", error);
            toast.error("Không thể tải danh sách trận đấu");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Xử lý chấp nhận lời mời
    const handleAcceptInvite = (invitation: GameInvitation) => {
        if (!ws) return;
        try {
            const response: InviteResponse = {
                type: 'accept',
                gameId: invitation.gameId,
                inviterId: invitation.inviterId,
                invitedId: invitation.invitedId,
            };
            ws.send(JSON.stringify(response));
            setInvitation(null);
            navigate(`/game/${invitation.gameId}`);
        } catch (error) {
            console.error("Lỗi khi chấp nhận lời mời:", error);
            toast.error("Không thể tham gia trận đấu");
        }
    };

    // Xử lý từ chối lời mời
    const handleDeclineInvite = (invitation: GameInvitation) => {
        if (!ws) return;
        try {
            const response: InviteResponse = {
                type: 'decline',
                gameId: invitation.gameId,
                inviterId: invitation.inviterId,
                invitedId: invitation.invitedId,
            };
            ws.send(JSON.stringify(response));
            setInvitation(null);
            toast.success("Đã từ chối lời mời");
        } catch (error) {
            console.error("Lỗi khi từ chối lời mời:", error);
            toast.error("Không thể từ chối lời mời");
        }
    };

    // Thiết lập kết nối WebSocket
    useEffect(() => {
        if (!user) return;

        // Thay thế bằng URL WebSocket server của bạn
        const websocket = new WebSocket('ws://your-websocket-server:port');

        websocket.onopen = () => {
            console.log('WebSocket connected');
            // Gửi thông tin đăng ký với user ID
            websocket.send(JSON.stringify({ type: 'register', userId: user.id }));
        };

        websocket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'invite' && message.invitedId === user.id) {
                    // Kiểm tra thời gian lời mời (không quá 30 giây)
                    if (Date.now() - message.timestamp < 30000) {
                        setInvitation(message);
                    }
                } else if (message.type === 'accept' && message.inviterId === user.id) {
                    // Người mời nhận được chấp nhận
                    navigate(`/game/${message.gameId}`);
                } else if (message.type === 'decline' && message.inviterId === user.id) {
                    // Người mời nhận được từ chối
                    toast.error("Lời mời của bạn đã bị từ chối");
                }
            } catch (error) {
                console.error("Lỗi khi xử lý tin nhắn WebSocket:", error);
            }
        };

        websocket.onerror = (error) => {
            console.error("WebSocket error:", error);
            toast.error("Lỗi kết nối WebSocket");
        };

        websocket.onclose = () => {
            console.log("WebSocket disconnected");
            setWs(null);
        };

        setWs(websocket);

        return () => {
            websocket.close();
        };
    }, [user]);

    // Lắng nghe cập nhật từ bảng games
    useEffect(() => {
        fetchActiveGames();

        const gamesChannel = supabase
            .channel('public:games')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'games' },
                () => {
                    fetchActiveGames();
                }
            )
            .subscribe();

        return () => {
            gamesChannel.unsubscribe();
        };
    }, [fetchActiveGames]);

    // Xử lý tạo trò chơi mới
    const handleCreateGame = async (opponentId?: string) => {
        if (isCreatingGame || !ws) return;

        try {
            setIsCreatingGame(true);
            const toastId = toast.loading("Đang tạo trận đấu mới...");

            const gameId = await createGame();
            if (gameId) {
                toast.dismiss(toastId);
                toast.success("Đã tạo trận đấu thành công");

                if (opponentId) {
                    // Gửi lời mời qua WebSocket
                    const invitation: GameInvitation = {
                        type: 'invite',
                        gameId,
                        inviterId: user?.id || '',
                        invitedId: opponentId,
                        inviterName: profile?.display_name || profile?.username || 'Người chơi',
                        time_control: 300, // Mặc định 5 phút
                        timestamp: Date.now(),
                    };
                    ws.send(JSON.stringify(invitation));
                } else {
                    navigate(`/game/${gameId}`);
                }
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
        if (!ws) {
            toast.error("Không thể kết nối đến server thách đấu");
            return;
        }
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

                {/* Dialog cho lời mời thách đấu */}
                <AnimatePresence>
                    {invitation && (
                        <Dialog
                            open={!!invitation}
                            onOpenChange={(open) => {
                                if (!open) setInvitation(null);
                            }}
                        >
                            <DialogContent className="bg-[#272522] text-white border-gray-700">
                                <DialogHeader>
                                    <DialogTitle>Lời mời thách đấu</DialogTitle>
                                    <DialogDescription className="text-gray-400">
                                        {`${invitation.inviterName} đã mời bạn vào một trận đấu (${Math.floor(invitation.time_control / 60)} phút).`}
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button
                                        variant="secondary"
                                        onClick={() => handleDeclineInvite(invitation)}
                                    >
                                        Từ chối
                                    </Button>
                                    <Button
                                        variant="default"
                                        onClick={() => handleAcceptInvite(invitation)}
                                    >
                                        Chấp nhận
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {showRules && <GameRules onClose={() => setShowRules(false)} />}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default Lobby;