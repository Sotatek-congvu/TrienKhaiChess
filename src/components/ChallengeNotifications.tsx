import React from 'react';
import { useSocket } from '@/context/SocketContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';

export const ChallengeNotifications: React.FC = () => {
    const { receivedChallenges, pendingChallenges, acceptChallenge, declineChallenge, cancelChallenge } = useSocket();

    const handleAccept = (challengeId: string) => {
        acceptChallenge(challengeId);
    };

    const handleDecline = (challengeId: string) => {
        declineChallenge(challengeId);
    };

    const handleCancel = (challengeId: string) => {
        cancelChallenge(challengeId);
    };

    if (receivedChallenges.length === 0 && pendingChallenges.length === 0) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 space-y-4">
            {receivedChallenges.map((challenge) => (
                <Card key={challenge.id} className="w-80">
                    <CardHeader>
                        <CardTitle className="text-sm">Thách đấu mới</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3 mb-4">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={challenge.challenger.avatarUrl} />
                                <AvatarFallback>
                                    {challenge.challenger.displayName.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-medium">{challenge.challenger.displayName}</div>
                                <div className="text-sm text-gray-500">muốn thách đấu bạn</div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="default"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleAccept(challenge.id)}
                            >
                                Chấp nhận
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleDecline(challenge.id)}
                            >
                                Từ chối
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}

            {pendingChallenges.map((challenge) => (
                <Card key={challenge.id} className="w-80">
                    <CardHeader>
                        <CardTitle className="text-sm">Thách đấu đang chờ</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3 mb-4">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={challenge.challenged.avatarUrl} />
                                <AvatarFallback>
                                    {challenge.challenged.displayName.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-medium">{challenge.challenged.displayName}</div>
                                <div className="text-sm text-gray-500">đang chờ phản hồi</div>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => handleCancel(challenge.id)}
                        >
                            Hủy thách đấu
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}; 