import { useState } from 'react';
import { Login } from '@/components/auth/Login';
import { Register } from '@/components/auth/Register';

const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true);

    const toggleForm = () => {
        setIsLogin(!isLogin);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-[#312e2b]">
            <div className="w-full max-w-md px-4">
                {isLogin ? (
                    <Login onToggleForm={toggleForm} />
                ) : (
                    <Register onToggleForm={toggleForm} />
                )}
            </div>
        </div>
    );
};

export default AuthPage;