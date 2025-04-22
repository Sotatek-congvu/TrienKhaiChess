import { useEffect, useRef, useState } from 'react';

type SoundType = 'move' | 'capture' | 'check' | 'checkmate' | 'drop' | 'promote' | 'start' | 'gameOver';

interface AudioContextState {
    playSound: (type: SoundType) => void;
    isMuted: boolean;
    toggleMute: () => void;
}

export function useAudio(): AudioContextState {
    const [isMuted, setIsMuted] = useState<boolean>(() => {
        const savedMute = localStorage.getItem('chess-sound-muted');
        return savedMute ? JSON.parse(savedMute) : false;
    });

    const audioRefs = useRef<Map<SoundType, HTMLAudioElement>>(new Map());
    const [soundsLoaded, setSoundsLoaded] = useState(false);

    useEffect(() => {
        // Lấy base URL dựa trên môi trường - cải tiến logic xác định đường dẫn gốc
        const getBasePath = () => {
            try {
                // Kiểm tra URL hiện tại để xác định nếu chúng ta đang ở GitHub Pages
                const currentUrl = window.location.href;

                // Nếu URL chứa github.io, lấy đúng đường dẫn repository
                if (currentUrl.includes('github.io')) {
                    const pathSegments = window.location.pathname.split('/');
                    const repoName = pathSegments[1]; // Segment đầu tiên sau hostname
                    return repoName ? `/${repoName}` : '';
                }

                // Kiểm tra nếu đang chạy trên môi trường không phải localhost (có thể là GitHub Pages không có github.io)
                if (!currentUrl.includes('localhost') && !currentUrl.includes('127.0.0.1')) {
                    // Lấy pathname từ URL và bỏ phần tên file cuối cùng nếu có
                    const pathname = window.location.pathname;
                    const lastSlashIndex = pathname.lastIndexOf('/');
                    if (lastSlashIndex > 0) {
                        return pathname.substring(0, lastSlashIndex);
                    }
                }
            } catch (e) {
                console.warn("Error determining base path:", e);
            }

            // Mặc định: không có path prefix
            return '';
        };

        const basePath = getBasePath();
        console.log(`Audio base path: ${basePath}`);

        // Định nghĩa các đường dẫn âm thanh với base path
        const soundPaths: Record<SoundType, string> = {
            move: `${basePath}/sounds/move-self.mp3`,
            capture: `${basePath}/sounds/capture.mp3`,
            check: `${basePath}/sounds/move-self.mp3`,
            checkmate: `${basePath}/sounds/move-self.mp3`,
            drop: `${basePath}/sounds/move-self.mp3`,
            promote: `${basePath}/sounds/move-self.mp3`,
            start: `${basePath}/sounds/move-self.mp3`,
            gameOver: `${basePath}/sounds/move-self.mp3`
        };

        // Thêm các đường dẫn dự phòng (không có prefix) để thử khi đường dẫn chính không hoạt động
        const fallbackSoundPaths: Record<SoundType, string> = {
            move: `/sounds/move-self.mp3`,
            capture: `/sounds/capture.mp3`,
            check: `/sounds/move-self.mp3`,
            checkmate: `/sounds/move-self.mp3`,
            drop: `/sounds/move-self.mp3`,
            promote: `/sounds/move-self.mp3`,
            start: `/sounds/move-self.mp3`,
            gameOver: `/sounds/move-self.mp3`
        };

        // Tạo và lưu trữ các phần tử audio, với kiểm tra tải
        const loadPromises: Promise<void>[] = [];

        Object.entries(soundPaths).forEach(([type, path]) => {
            const audio = new Audio();
            const typeKey = type as SoundType;

            // Thêm promise để kiểm tra tải
            const loadPromise = new Promise<void>((resolve) => {
                const tryLoad = (src: string, isMainPath: boolean) => {
                    audio.src = src;

                    const canPlayHandler = () => {
                        console.log(`Sound loaded: ${src}`);
                        audio.removeEventListener('canplaythrough', canPlayHandler);
                        audio.removeEventListener('error', errorHandler);
                        resolve();
                    };

                    const errorHandler = (e: Event) => {
                        console.warn(`Failed to load sound from ${src}:`, e);
                        audio.removeEventListener('canplaythrough', canPlayHandler);
                        audio.removeEventListener('error', errorHandler);

                        // Nếu đây là đường dẫn chính và thất bại, thử đường dẫn dự phòng
                        if (isMainPath) {
                            console.log(`Trying fallback path for ${type}`);
                            tryLoad(fallbackSoundPaths[typeKey], false);
                        } else {
                            // Cả hai đường dẫn đều thất bại
                            console.error(`All paths failed for sound: ${type}`);
                            resolve(); // Vẫn resolve để không chặn các âm thanh khác
                        }
                    };

                    audio.addEventListener('canplaythrough', canPlayHandler, { once: false });
                    audio.addEventListener('error', errorHandler, { once: false });
                };

                // Thử đường dẫn chính trước
                tryLoad(path, true);
            });

            loadPromises.push(loadPromise);

            audio.preload = 'auto';
            audio.volume = 0.5;
            audioRefs.current.set(typeKey, audio);
        });

        // Đánh dấu khi tất cả âm thanh được tải
        Promise.all(loadPromises).then(() => {
            setSoundsLoaded(true);
            console.log('All sounds loaded or attempted to load');
        }).catch(err => {
            console.error("Error loading sounds:", err);
            setSoundsLoaded(true); // Still mark as "loaded" so the game can continue
        });

        return () => {
            // Dọn dẹp
            audioRefs.current.forEach((audio) => {
                audio.pause();
                audio.src = '';
            });
            audioRefs.current.clear();
        };
    }, []);

    // Lưu trạng thái tắt/bật âm thanh vào localStorage
    useEffect(() => {
        localStorage.setItem('chess-sound-muted', JSON.stringify(isMuted));
    }, [isMuted]);

    const playSound = (type: SoundType) => {
        if (isMuted || !soundsLoaded) return;

        const audio = audioRefs.current.get(type);
        if (audio) {
            try {
                // Clone audio node để tránh vấn đề với việc phát cùng lúc
                const clonedAudio = audio.cloneNode() as HTMLAudioElement;
                clonedAudio.volume = 0.5;
                const playPromise = clonedAudio.play();

                // Xử lý lỗi phát âm thanh
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error('Failed to play sound:', error);
                    });
                }
            } catch (error) {
                console.error('Error playing sound:', error);
            }
        }
    };

    const toggleMute = () => {
        setIsMuted(prev => !prev);
    };

    return { playSound, isMuted, toggleMute };
}