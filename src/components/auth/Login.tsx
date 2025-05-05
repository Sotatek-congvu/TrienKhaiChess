import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface LoginProps {
    onToggleForm: () => void;
}

export function Login({ onToggleForm }: LoginProps) {
    const { signIn } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Vui lòng điền đầy đủ thông tin');
            return;
        }

        setIsLoading(true);
        try {
            const result = await signIn(email, password);
            if (result.success) {
                // Đăng nhập thành công, chuyển hướng về trang chủ
                toast.success('Đăng nhập thành công!');
                navigate('/');
            }
        } catch (error) {
            // Lỗi đã được xử lý trong AuthContext
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle className="text-center text-2xl">Đăng nhập</CardTitle>
                <CardDescription className="text-center">
                    Đăng nhập để chơi với người chơi khác
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Mật khẩu</Label>
                            <a
                                href="#"
                                className="text-sm text-primary hover:underline"
                                onClick={(e) => {
                                    e.preventDefault();
                                    toast.info('Tính năng khôi phục mật khẩu sẽ sớm được hỗ trợ');
                                }}
                            >
                                Quên mật khẩu?
                            </a>
                        </div>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </Button>
                </form>
            </CardContent>
            <CardFooter>
                <p className="text-sm text-center w-full">
                    Chưa có tài khoản?{' '}
                    <a
                        href="#"
                        className="text-primary hover:underline"
                        onClick={(e) => {
                            e.preventDefault();
                            onToggleForm();
                        }}
                    >
                        Đăng ký
                    </a>
                </p>
            </CardFooter>
        </Card>
    );
}