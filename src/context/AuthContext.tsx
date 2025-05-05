import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Profile } from '@/types/database.types';
import { toast } from 'sonner';

// Định nghĩa kiểu dữ liệu cho context
interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    loading: boolean;
    signUp: (email: string, password: string, username: string, displayName: string) => Promise<{ success: boolean; error: string | null }>;
    signIn: (email: string, password: string) => Promise<{ success: boolean; error: string | null }>;
    signOut: () => Promise<void>;
    updateProfile: (data: Partial<Profile>) => Promise<{ success: boolean; error: string | null }>;
}

// Tạo context với giá trị mặc định
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Tên các key lưu trữ trong localStorage
const LOCAL_STORAGE_KEYS = {
    USER: 'chess_user',
    PROFILE: 'chess_profile',
    SESSION: 'chess_session',
};

// Provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    // Lấy thông tin profile từ user ID
    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Unexpected error fetching profile:', error);
            return null;
        }
    };

    // Cập nhật trạng thái người dùng trực tuyến
    const updateOnlineStatus = async (userId: string, isOnline: boolean) => {
        try {
            if (isOnline) {
                // Get the profile to access the username
                const profileData = profile || await fetchProfile(userId);
                if (!profileData || !profileData.username) {
                    console.error('Cannot update online status: username not found');
                    return false;
                }

                // Thêm hoặc cập nhật người dùng vào danh sách online với đầy đủ thông tin
                const { error } = await supabase
                    .from('online_players')
                    .upsert({
                        id: userId,
                        username: profileData.username,
                        display_name: profileData.display_name || profileData.username,
                        avatar_url: profileData.avatar_url,
                        rating: profileData.rating || 1200,
                        last_seen: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        games_played: profileData.games_played || 0,
                        wins: profileData.wins || 0,
                        losses: profileData.losses || 0,
                        draws: profileData.draws || 0
                    }, {
                        onConflict: 'id',
                        ignoreDuplicates: false
                    });

                if (error) {
                    console.error('Error updating online status:', error);
                    return false;
                }
                console.log('User online status updated successfully');
                return true;
            } else {
                // Xóa người dùng khỏi danh sách online khi đăng xuất
                const { error } = await supabase
                    .from('online_players')
                    .delete()
                    .eq('id', userId);

                if (error) {
                    console.error('Error removing online status:', error);
                    return false;
                }
                console.log('User removed from online players');
                return true;
            }
        } catch (error) {
            console.error('Unexpected error updating online status:', error);
            return false;
        }
    };

    // Cập nhật trạng thái người dùng trực tuyến định kỳ
    const setupOnlineStatusInterval = (userId: string) => {
        // Cập nhật mỗi 10 giây
        const intervalId = setInterval(() => {
            if (userId) {
                updateOnlineStatus(userId, true).catch(err => {
                    console.error('Failed to update online status in interval:', err);
                });
            }
        }, 10000);

        return intervalId;
    };

    // Lưu dữ liệu người dùng vào localStorage
    const saveUserDataToLocalStorage = (userData: User | null, profileData: Profile | null, sessionData: Session | null) => {
        try {
            if (userData) {
                localStorage.setItem(LOCAL_STORAGE_KEYS.USER, JSON.stringify(userData));
            } else {
                localStorage.removeItem(LOCAL_STORAGE_KEYS.USER);
            }

            if (profileData) {
                localStorage.setItem(LOCAL_STORAGE_KEYS.PROFILE, JSON.stringify(profileData));
            } else {
                localStorage.removeItem(LOCAL_STORAGE_KEYS.PROFILE);
            }

            if (sessionData) {
                localStorage.setItem(LOCAL_STORAGE_KEYS.SESSION, JSON.stringify(sessionData));
            } else {
                localStorage.removeItem(LOCAL_STORAGE_KEYS.SESSION);
            }
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    };

    // Lấy dữ liệu người dùng từ localStorage
    const loadUserDataFromLocalStorage = () => {
        try {
            const storedUser = localStorage.getItem(LOCAL_STORAGE_KEYS.USER);
            const storedProfile = localStorage.getItem(LOCAL_STORAGE_KEYS.PROFILE);
            const storedSession = localStorage.getItem(LOCAL_STORAGE_KEYS.SESSION);

            return {
                user: storedUser ? JSON.parse(storedUser) : null,
                profile: storedProfile ? JSON.parse(storedProfile) : null,
                session: storedSession ? JSON.parse(storedSession) : null,
            };
        } catch (e) {
            console.error('Error loading user data from localStorage:', e);
            return { user: null, profile: null, session: null };
        }
    };

    // Khôi phục session và tự động đăng nhập lại
    const restoreSessionFromStorage = async () => {
        try {
            const localData = loadUserDataFromLocalStorage();

            if (!localData.session || !localData.user) {
                return false;
            }

            // Thiết lập session từ localStorage
            setUser(localData.user);
            setSession(localData.session);

            if (localData.profile) {
                setProfile(localData.profile);
            }

            // Đánh dấu là đã hoàn thành loading
            setLoading(false);

            return true;
        } catch (error) {
            console.error('Error restoring session:', error);
            return false;
        }
    };

    // Kiểm tra trạng thái xác thực khi khởi động ứng dụng
    useEffect(() => {
        let isMounted = true;
        let onlineStatusInterval: NodeJS.Timeout | null = null;

        const setInitialSession = async () => {
            try {
                setLoading(true);

                // Trước tiên, khôi phục từ localStorage để UI hiển thị ngay lập tức
                const restored = await restoreSessionFromStorage();

                if (restored) {
                    console.log('Session restored from localStorage');
                    // Không cần setLoading(false) ở đây vì đã xử lý trong restoreSessionFromStorage
                    return; // Thoát sớm nếu đã khôi phục từ localStorage
                }

                // Sau đó kiểm tra với Supabase để đảm bảo session còn hợp lệ
                try {
                    const { data: { session: supabaseSession }, error } = await supabase.auth.getSession();

                    // Kiểm tra xem component còn mounted không
                    if (!isMounted) return;

                    if (error) {
                        console.error('Error getting session from Supabase:', error);
                        // Xóa dữ liệu không hợp lệ
                        saveUserDataToLocalStorage(null, null, null);
                        setUser(null);
                        setProfile(null);
                        setSession(null);
                    } else if (supabaseSession) {
                        // Lưu thông tin session và user mới từ Supabase
                        setSession(supabaseSession);
                        setUser(supabaseSession.user);
                        saveUserDataToLocalStorage(supabaseSession.user, profile, supabaseSession);

                        // Lấy thông tin profile nếu có user
                        if (supabaseSession.user && isMounted) {
                            const profileData = await fetchProfile(supabaseSession.user.id);
                            if (profileData && isMounted) {
                                setProfile(profileData);
                                saveUserDataToLocalStorage(supabaseSession.user, profileData, supabaseSession);
                            }
                        }

                        // Cập nhật trạng thái online
                        if (supabaseSession.user) {
                            updateOnlineStatus(supabaseSession.user.id, true);
                            onlineStatusInterval = setupOnlineStatusInterval(supabaseSession.user.id);
                        }
                    } else if (!supabaseSession && user) {
                        // Session đã hết hạn
                        console.log('Session expired or invalid');
                        saveUserDataToLocalStorage(null, null, null);
                        setUser(null);
                        setProfile(null);
                        setSession(null);
                    }
                } catch (supabaseError) {
                    console.error('Error communicating with Supabase:', supabaseError);
                    // Giữ dữ liệu từ localStorage nếu không thể kết nối với Supabase
                }
            } catch (error) {
                console.error('Session initialization error:', error);
            } finally {
                // Đặt loading thành false chỉ khi component vẫn mounted
                if (isMounted) {
                    console.log('Setting loading to false after auth check');
                    setLoading(false);
                }
            }
        };

        setInitialSession();

        // Lắng nghe sự thay đổi về trạng thái xác thực
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            // Kiểm tra xem component còn mounted không
            if (!isMounted) return;

            console.log('Auth state changed:', event, newSession);

            // Cập nhật thông tin session và user
            if (event === 'SIGNED_OUT') {
                // Xóa dữ liệu khi đăng xuất
                if (user) {
                    updateOnlineStatus(user.id, false);
                }
                setUser(null);
                setProfile(null);
                setSession(null);
                saveUserDataToLocalStorage(null, null, null);

                // Xóa interval cập nhật trạng thái online
                if (onlineStatusInterval) {
                    clearInterval(onlineStatusInterval);
                    onlineStatusInterval = null;
                }
            } else if (newSession) {
                setSession(newSession);
                setUser(newSession.user);

                // Lưu vào localStorage
                saveUserDataToLocalStorage(newSession.user, profile, newSession);

                // Xử lý theo từng loại sự kiện
                switch (event) {
                    case 'SIGNED_IN':
                        if (newSession?.user && isMounted) {
                            const profileData = await fetchProfile(newSession.user.id);
                            if (profileData && isMounted) {
                                setProfile(profileData);
                                saveUserDataToLocalStorage(newSession.user, profileData, newSession);
                            }
                            updateOnlineStatus(newSession.user.id, true);
                            onlineStatusInterval = setupOnlineStatusInterval(newSession.user.id);
                        }
                        break;
                    case 'TOKEN_REFRESHED':
                        // Session đã được làm mới, lưu phiên mới
                        saveUserDataToLocalStorage(newSession.user, profile, newSession);
                        break;
                    case 'USER_UPDATED':
                        if (newSession?.user && isMounted) {
                            const profileData = await fetchProfile(newSession.user.id);
                            if (profileData && isMounted) {
                                setProfile(profileData);
                                saveUserDataToLocalStorage(newSession.user, profileData, newSession);
                            }
                        }
                        break;
                    default:
                        break;
                }
            }

            // Đảm bảo loading được đặt thành false sau mỗi sự kiện auth
            if (isMounted) {
                console.log('Setting loading to false after auth event:', event);
                setLoading(false);
            }
        });

        // Cleanup listener và theo dõi mounting state
        return () => {
            isMounted = false;
            authListener.subscription.unsubscribe();
            if (onlineStatusInterval) {
                clearInterval(onlineStatusInterval);
            }
        };
    }, []);

    // Hàm đăng ký tài khoản
    const signUp = async (email: string, password: string, username: string, displayName: string) => {
        try {
            // Kiểm tra xem username đã tồn tại chưa
            // NOTE: This may fail if the profiles table doesn't exist yet
            try {
                const { data: existingProfiles, error: profileCheckError } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('username', username);

                if (profileCheckError) {
                    console.error('Error checking username:', profileCheckError);
                    toast.error('Error checking username: ' + profileCheckError.message);
                    // Continue with registration instead of returning error
                } else if (existingProfiles && existingProfiles.length > 0) {
                    return { success: false, error: 'Tên người dùng đã được sử dụng' };
                }
            } catch (checkError) {
                console.error('Failed to check username:', checkError);
                // Continue with registration
            }

            // Tạo tài khoản mới
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username,
                        name: displayName,
                    },
                }
            });

            if (authError) {
                console.error('Sign up error:', authError);
                toast.error('Sign up error: ' + authError.message);
                return { success: false, error: authError.message };
            }

            if (!authData.user) {
                return { success: false, error: 'Không tạo được người dùng' };
            }

            // Create profile manually if the trigger doesn't work
            try {
                const { error: insertError } = await supabase.from('profiles').insert({
                    id: authData.user.id,
                    username,
                    display_name: displayName,
                    avatar_url: null,
                    rating: 1200,
                    games_played: 0,
                    wins: 0,
                    losses: 0,
                    draws: 0
                });

                if (insertError && insertError.code !== '23505') { // Not a duplicate key error
                    console.error('Error creating profile:', insertError);
                    toast.error('Error creating profile: ' + insertError.message);
                }
            } catch (profileError) {
                console.error('Failed to create profile:', profileError);
                // Continue anyway, as the trigger might have created the profile
            }

            toast.success('Đăng ký thành công! Hãy kiểm tra email để xác thực tài khoản.');
            return { success: true, error: null };
        } catch (error: any) {
            console.error('Unexpected signup error:', error);
            toast.error('Lỗi đăng ký: ' + (error.message || 'Không xác định'));
            return { success: false, error: error.message || 'Lỗi đăng ký không xác định' };
        }
    };

    // Hàm đăng nhập
    const signIn = async (email: string, password: string) => {
        try {
            console.log('Attempting sign in for:', email);

            // Thay đổi cách đăng nhập để hỗ trợ email chưa xác thực
            // Đầu tiên thử đăng nhập bình thường
            let { data, error } = await supabase.auth.signInWithPassword({ email, password });

            // Nếu lỗi liên quan đến email chưa xác thực
            if (error && error.message.includes('Email not confirmed')) {
                console.log('Email not confirmed, trying custom sign-in flow...');

                // Lưu ý: Ở đây chúng ta bỏ qua lỗi email chưa xác thực
                // và cho phép đăng nhập
                toast.info('Email chưa được xác thực, nhưng bạn vẫn có thể đăng nhập.');

                // Thử đăng nhập lại bằng cách bỏ qua lỗi xác thực email
                try {
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                        email,
                        password
                    });

                    if (!signInError) {
                        data = signInData;
                        error = null;

                        // Lưu thông tin người dùng vào localStorage khi đăng nhập thành công
                        if (data?.user) {
                            saveUserDataToLocalStorage(data.user, null, data.session);
                        }
                    }
                } catch (signInAttemptError) {
                    console.error('Error in second sign in attempt:', signInAttemptError);
                }

                if (error) {
                    return { success: false, error: 'Không thể đăng nhập: ' + error.message };
                }

                return { success: true, error: null };
            }

            if (error) {
                console.error('Sign in error:', error);
                let errorMessage = error.message;

                // Chỉ hiển thị lỗi thông tin đăng nhập không chính xác
                if (error.message.includes('Invalid login credentials')) {
                    errorMessage = 'Email hoặc mật khẩu không chính xác';
                }

                toast.error('Đăng nhập thất bại: ' + errorMessage);
                return { success: false, error: errorMessage };
            }

            console.log('Sign in successful:', data);

            // Lưu thông tin người dùng vào localStorage khi đăng nhập thành công
            if (data?.user) {
                saveUserDataToLocalStorage(data.user, null, data.session);

                // Lấy profile và cập nhật localStorage
                const profileData = await fetchProfile(data.user.id);
                if (profileData) {
                    setProfile(profileData);
                    saveUserDataToLocalStorage(data.user, profileData, data.session);
                }

                // Cập nhật trạng thái online
                updateOnlineStatus(data.user.id, true);
            }

            toast.success('Đăng nhập thành công!');
            return { success: true, error: null };
        } catch (error: any) {
            console.error('Unexpected signin error:', error);
            toast.error('Lỗi đăng nhập: ' + (error.message || 'Không xác định'));
            return { success: false, error: error.message || 'Lỗi đăng nhập không xác định' };
        }
    };

    // Hàm đăng xuất đơn giản
    const signOut = async () => {
        try {
            // Không cần gọi supabase.auth.signOut()
            // Chỉ cần xóa dữ liệu trong localStorage

            // Đảm bảo xóa dữ liệu người dùng khỏi state
            if (user) {
                updateOnlineStatus(user.id, false);
            }
            setUser(null);
            setProfile(null);
            setSession(null);

            // Xóa dữ liệu trong localStorage khi đăng xuất
            saveUserDataToLocalStorage(null, null, null);

            console.log('Đã xóa dữ liệu đăng nhập');
            toast.success('Đã đăng xuất');

            // Không cần điều hướng ở đây, App.tsx sẽ tự nhận biết user=null và điều hướng
            return;
        } catch (error: any) {
            console.error('Lỗi khi đăng xuất:', error);
            toast.error('Đã xảy ra lỗi khi đăng xuất');
        }
    };

    // Hàm cập nhật thông tin người dùng
    const updateProfile = async (data: Partial<Profile>) => {
        if (!user) {
            return { success: false, error: 'Không có người dùng đăng nhập' };
        }

        try {
            const { data: updatedProfile, error } = await supabase
                .from('profiles')
                .update(data)
                .eq('id', user.id)
                .select()
                .single();

            if (error) {
                console.error('Profile update error:', error);
                toast.error('Lỗi cập nhật thông tin: ' + error.message);
                return { success: false, error: error.message };
            }

            setProfile(updatedProfile);
            toast.success('Cập nhật thông tin thành công');
            return { success: true, error: null };
        } catch (error: any) {
            console.error('Unexpected profile update error:', error);
            toast.error('Lỗi cập nhật: ' + (error.message || 'Không xác định'));
            return { success: false, error: error.message || 'Lỗi cập nhật không xác định' };
        }
    };

    const value = {
        user,
        profile,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        updateProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook để sử dụng context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};