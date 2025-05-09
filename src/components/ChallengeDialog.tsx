import { useState } from 'react';
import { useChallenge } from '@/hooks/use-challenge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';

interface ChallengeDialogProps {
    challenge: any;
    onClose: () => void;
}

export default function ChallengeDialog({ challenge, onClose }: ChallengeDialogProps) {
    const { acceptChallenge, declineChallenge, isLoading, isConnected } = useChallenge();

    const handleAccept = async () => {
        try {
            await acceptChallenge(challenge.id);
            // Không đóng dialog ngay lập tức, đợi sự kiện game:started
        } catch (error) {
            console.error('Failed to accept challenge:', error);
            onClose();
        }
    };

    const handleDecline = async () => {
        try {
            await declineChallenge(challenge.id);
            onClose();
        } catch (error) {
            console.error('Failed to decline challenge:', error);
            onClose();
        }
    };

    if (!isConnected) {
        return (
            <Dialog open={true} onOpenChange={onClose}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Connection Error</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-center text-red-500">
                            Not connected to server. Please check your connection.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button onClick={onClose}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Game Challenge</DialogTitle>
                </DialogHeader>
                <div className="flex items-center space-x-4 py-4">
                    <Avatar>
                        <AvatarImage src={challenge.challenger.avatarUrl} />
                        <AvatarFallback>
                            {challenge.challenger.displayName.substring(0, 2)}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-medium">{challenge.challenger.displayName}</p>
                        <p className="text-sm text-muted-foreground">
                            has challenged you to a game
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleDecline}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Declining...
                            </>
                        ) : (
                            'Decline'
                        )}
                    </Button>
                    <Button
                        onClick={handleAccept}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Accepting...
                            </>
                        ) : (
                            'Accept'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 