import { FC, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GameRulesProps {
  onClose: () => void;
}

const GameRules: FC<GameRulesProps> = ({ onClose }) => {
  // Tạo đường dẫn động cho hình ảnh, tương thích với GitHub Pages
  const getImagePath = useMemo(() => {
    const basePath = (() => {
      // Kiểm tra URL hiện tại để xác định nếu chúng ta đang ở GitHub Pages
      const currentUrl = window.location.href;

      // Nếu URL chứa github.io, lấy đúng đường dẫn repository
      if (currentUrl.includes('github.io')) {
        const pathSegments = window.location.pathname.split('/');
        const repoName = pathSegments[1]; // Segment đầu tiên sau hostname
        return repoName ? `/${repoName}` : '';
      }

      // Nếu không phải GitHub Pages, không cần tiền tố
      return '';
    })();

    return `${basePath}/lovable-uploads/e2daecd7-a823-4892-a55d-067798709380.png`;
  }, []);

  return (
    <motion.div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white text-black rounded-lg max-w-3xl w-full overflow-hidden shadow-xl"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-center flex-grow">CÁCH CHƠI</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full hover:bg-gray-100"
          >
            <X />
          </Button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-1/2 space-y-4">
              <p className="font-semibold">Bàn cờ: 6x6, nhỏ hơn cờ vua truyền thống</p>
              <p className="font-semibold">Quân cờ mỗi bên: 1 Vua, 1 Xe, 1 Mã, 1 Tượng, 1 Tốt</p>
              <p className="font-semibold">Di chuyển quân cờ:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Tượng (Bishop):</strong> Di chuyển theo đường chéo</li>
                <li><strong>Xe (Rook):</strong> Di chuyển theo đường thẳng, ngang và dọc</li>
                <li><strong>Mã (Knight):</strong> Di chuyển theo hình chữ L (2-1)</li>
                <li><strong>Vua (King):</strong> Di chuyển 1 ô theo mọi hướng</li>
                <li><strong>Tốt (Pawn):</strong> Di chuyển 1 ô về phía trước, bắt quân theo đường chéo</li>
              </ul>
              <p className="font-semibold">Cơ chế thả quân: Khi bắt quân đối thủ, quân đó trở thành quân của người chơi và có thể được thả lại lên bàn cờ.</p>
              <p className="font-semibold">Thả quân:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Không được thả Tốt vào hàng cuối.</li>
                <li>Quân cờ bị bắt sẽ đổi màu và có thể thả lại vào bàn cờ.</li>
              </ul>
              <p>Kết thúc ván đấu: Chiếu bí đối phương hoặc hòa khi không còn nước đi hợp lệ.</p>
            </div>

            <div className="md:w-1/2 flex justify-center">
              <img
                src={getImagePath}
                alt="Minh họa bàn cờ 6x6"
                className="max-w-full rounded-lg border border-gray-200 shadow-md"
                onError={(e) => {
                  console.error("Failed to load image:", e);
                  const target = e.target as HTMLImageElement;
                  // Sử dụng một hình ảnh dự phòng nếu không tải được
                  target.src = "/placeholder.svg";
                }}
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 text-center">
          <Button
            onClick={onClose}
            variant="default"
            className="bg-[#769656] hover:bg-[#6a874c] text-white font-semibold"
          >
            Bắt đầu chơi
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default GameRules;
