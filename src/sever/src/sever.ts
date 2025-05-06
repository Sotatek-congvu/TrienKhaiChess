const WebSocket = require('ws');

// Khởi tạo WebSocket server trên cổng 8080
const wss = new WebSocket.Server({ port: 8081 });

// Map để lưu trữ kết nối WebSocket theo user ID
const clients = new Map();

// Xử lý kết nối WebSocket mới
wss.on('connection', (ws) => {
    console.log('Có client mới kết nối');

    // Xử lý tin nhắn nhận được
    ws.on('message', (message) => {
        try {
            // Parse tin nhắn
            const data = JSON.parse(message.toString());

            // Xử lý các loại tin nhắn
            switch (data.type) {
                case 'register':
                    // Lưu kết nối client với user ID
                    if (data.userId) {
                        clients.set(data.userId, ws);
                        ws.userId = data.userId;
                        console.log(`Client đã đăng ký: ${data.userId}`);
                    } else {
                        console.error('Tin nhắn register không hợp lệ: thiếu userId');
                    }
                    break;

                case 'invite':
                    // Chuyển lời mời đến người chơi được mời
                    if (data.invitedId && clients.has(data.invitedId)) {
                        const invitedWs = clients.get(data.invitedId);
                        invitedWs.send(JSON.stringify(data));
                        console.log(`Lời mời từ ${data.inviterId} đến ${data.invitedId} cho game ${data.gameId}`);
                    } else {
                        console.error(`Gửi lời mời thất bại: không tìm thấy invitedId ${data.invitedId}`);
                    }
                    break;

                case 'accept':
                case 'decline':
                    // Chuyển phản hồi đến người mời
                    if (data.inviterId && clients.has(data.inviterId)) {
                        const inviterWs = clients.get(data.inviterId);
                        inviterWs.send(JSON.stringify(data));
                        console.log(`${data.type} từ ${data.invitedId} đến ${data.inviterId} cho game ${data.gameId}`);
                    } else {
                        console.error(`Gửi ${data.type} thất bại: không tìm thấy inviterId ${data.inviterId}`);
                    }
                    break;

                default:
                    console.error(`Loại tin nhắn không xác định: ${data.type}`);
            }
        } catch (error) {
            console.error('Lỗi khi xử lý tin nhắn:', error);
        }
    });

    // Xử lý khi client ngắt kết nối
    ws.on('close', () => {
        if (ws.userId) {
            clients.delete(ws.userId);
            console.log(`Client ngắt kết nối: ${ws.userId}`);
        }
    });

    // Xử lý lỗi WebSocket
    ws.on('error', (error) => {
        console.error('Lỗi WebSocket:', error);
    });
});

// Log khi server khởi động
console.log('WebSocket server đang chạy trên ws://localhost:8081');