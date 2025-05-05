import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';

interface RegisterProps {
    onToggleForm: () => void;
}

export function Register({ onToggleForm }: RegisterProps) {
    const { signUp } = useAuth();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!username || !email || !password || !confirmPassword) {
            toast.error('Vui lòng điền đầy đủ thông tin');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Mật khẩu xác nhận không khớp');
            return;
        }

        if (password.length < 8) {
            toast.error('Mật khẩu phải có ít nhất 8 ký tự');
            return;
        }

        setIsLoading(true);
        try {
            await signUp(email, password, username, username); // Using username as displayName temporarily
            // Chuyển sang form đăng nhập sau khi đăng ký
            onToggleForm();
        } catch (error) {
            // Lỗi đã được xử lý trong AuthContext
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle className="text-center text-2xl">Đăng ký tài khoản</CardTitle>
                <CardDescription className="text-center">
                    Tạo tài khoản để chơi với người chơi khác
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Tên người dùng</Label>
                        <Input
                            id="username"
                            type="text"
                            placeholder="chesswizard123"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="email@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Mật khẩu</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                        />
                        <p className="text-xs text-muted-foreground">Mật khẩu phải có ít nhất 8 ký tự</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Đang đăng ký...' : 'Đăng ký'}
                    </Button>
                </form>
            </CardContent>
            <CardFooter>
                <p className="text-sm text-center w-full">
                    Đã có tài khoản?{' '}
                    <a
                        href="#"
                        className="text-primary hover:underline"
                        onClick={(e) => {
                            e.preventDefault();
                            onToggleForm();
                        }}
                    >
                        Đăng nhập
                    </a>
                </p>
            </CardFooter>
        </Card>
    );
}