// This file helps load Stockfish as a WebWorker for browser compatibility

// Cải thiện hàm lấy đường dẫn cơ sở dựa trên môi trường triển khai
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

// Tính toán basePath một lần
const basePath = getBasePath();

// Sử dụng phiên bản WASM của Stockfish để hiệu suất cao hơn
// Ưu tiên tải từ nguồn local để tránh vấn đề CORS khi deploy lên GitHub Pages
const stockfishSources = [
    // Phiên bản cục bộ trong project với basePath (cho GitHub Pages)
    `${basePath}/engine/stockfish.js`,

    // Đường dẫn tuyệt đối (cho một số trường hợp triển khai)
    '/engine/stockfish.js',

    // Đường dẫn tương đối (cho phát triển local)
    './engine/stockfish.js',

    // Thay đổi các CDN để sử dụng các phiên bản khả dụng
    'https://cdn.jsdelivr.net/npm/stockfish@10.0.0/src/stockfish.js',
    'https://unpkg.com/stockfish@10.0.0/src/stockfish.js',
    'https://cdn.jsdelivr.net/npm/stockfish@11/src/stockfish.js',
    'https://cdn.jsdelivr.net/npm/stockfish-nnue@1.0.2/stockfish.js'
];

/**
 * Cố gắng tải Stockfish từ các nguồn khác nhau cho đến khi thành công
 * @returns URL của nguồn Stockfish có thể truy cập được
 */
async function getWorkingStockfishUrl(): Promise<string> {
    for (const source of stockfishSources) {
        try {
            // Xử lý nguồn
            const url = source;
            console.log(`Đang thử tải Stockfish từ: ${url}`);

            // Sử dụng chế độ no-cors cho các nguồn CDN bên ngoài
            const fetchOptions: RequestInit = url.startsWith('http') ?
                { method: 'HEAD', mode: 'no-cors' } :
                { method: 'HEAD' };

            const response = await fetch(url, fetchOptions);

            if (response.status !== 0 && !response.url) {
                console.log(`Sử dụng Stockfish từ: ${url}`);
                return url;
            }

            // Với chế độ no-cors, không thể kiểm tra response.ok
            // nên ta coi như thành công nếu không có lỗi
            if (fetchOptions.mode === 'no-cors') {
                console.log(`Giả định Stockfish từ nguồn ${url} khả dụng (no-cors mode)`);
                return url;
            }
        } catch (error) {
            console.warn(`Không tải được Stockfish từ ${source}, thử nguồn khác...`);
        }
    }

    throw new Error('Không thể tải Stockfish từ bất kỳ nguồn nào');
}

/**
 * Tạo phiên bản dự phòng của Stockfish khi không thể tải được từ bất kỳ nguồn nào
 */
function createFallbackStockfish(): Worker {
    // Tạo một worker giả lập với hành vi tối thiểu
    const workerCode = `
        self.onmessage = function(e) {
            const command = e.data;
            
            // Phản hồi cơ bản cho các lệnh UCI
            if (command === 'uci') {
                self.postMessage('id name StockfishFallback');
                self.postMessage('id author Fallback');
                self.postMessage('uciok');
            } 
            else if (command === 'isready') {
                self.postMessage('readyok');
            }
            else if (command.startsWith('go')) {
                // Trả về một nước đi giả lập sau 500ms
                setTimeout(() => {
                    self.postMessage('bestmove e2e4');
                }, 500);
            }
        };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    return new Worker(blobUrl);
}

/**
 * Creates a new Stockfish WebWorker instance using a blob URL approach
 * for better cross-browser compatibility
 * @returns A promise that resolves to a Stockfish worker interface
 */
export async function createStockfishWorker() {
    return new Promise<Worker>(async (resolve, reject) => {
        try {
            // Tìm URL Stockfish hoạt động
            let stockfishUrl;
            try {
                stockfishUrl = await getWorkingStockfishUrl();
                console.log('Fetching Stockfish from:', stockfishUrl);
            } catch (error) {
                console.error('Không thể tìm thấy nguồn Stockfish khả dụng:', error);
                console.warn('Sử dụng phiên bản dự phòng của Stockfish');
                const fallbackWorker = createFallbackStockfish();
                resolve(fallbackWorker);
                return;
            }

            // Tùy chọn fetch tùy thuộc vào loại URL
            const fetchOptions: RequestInit = stockfishUrl.startsWith('http') ?
                { mode: 'no-cors' } : {};

            // Tải mã nguồn Stockfish
            try {
                const response = await fetch(stockfishUrl, fetchOptions);

                if (!response.ok && response.status !== 0) {
                    throw new Error(`Failed to fetch Stockfish: ${response.status} ${response.statusText}`);
                }

                console.log('Stockfish fetched successfully, processing worker...');
                const stockfishCode = await response.text();

                // Thêm cấu hình WASM nếu đang dùng phiên bản WASM
                let wasmSupport = '';
                if (stockfishUrl.includes('.wasm.')) {
                    wasmSupport = `
                        // Enable WASM support
                        var wasmSupported = typeof WebAssembly === 'object' && WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,6,1,96,1,127,1,127,3,2,1,0,5,3,1,0,1,7,8,1,4,116,101,115,116,0,0,10,9,1,7,0,65,0,253,15,253,98,11]));
                        var wasmMemory;
                        if (wasmSupported) {
                            wasmMemory = new WebAssembly.Memory({ initial: 256, maximum: 32768 });
                        }
                        var Module = {
                            wasmBinary: null,
                            wasmJSMethod: 'native-wasm',
                            wasmMemory: wasmMemory,
                            print: function(text) { postMessage(text); },
                            printErr: function(text) { postMessage('Error: ' + text); }
                        };
                    `;
                }

                // Tạo worker với mã nguồn Stockfish và tùy chọn WASM
                const workerCode = `
                    ${wasmSupport}
                    ${stockfishCode}
                    
                    // Hook tất cả đầu ra của Stockfish
                    var originalConsoleLog = console.log;
                    console.log = function() {
                        var args = Array.prototype.slice.call(arguments);
                        var text = args.join(' ');
                        postMessage(text);
                        originalConsoleLog.apply(console, args);
                    };
                `;

                // Tạo worker từ blob
                const blob = new Blob([workerCode], { type: 'application/javascript' });
                const blobUrl = URL.createObjectURL(blob);
                const worker = new Worker(blobUrl);

                // Thiết lập worker
                worker.onmessage = (e) => {
                    const message = e.data;
                    if (message === 'uciok' || message.includes('readyok')) {
                        console.log('Stockfish worker initialized successfully');
                        resolve(worker);
                        URL.revokeObjectURL(blobUrl);
                    }
                };

                // Gửi lệnh ban đầu
                worker.postMessage('uci');
                worker.postMessage('isready');

                // Đặt timeout phòng khi khởi tạo thất bại
                const timeout = setTimeout(() => {
                    console.error('Stockfish worker initialization timed out');
                    URL.revokeObjectURL(blobUrl);
                    const fallbackWorker = createFallbackStockfish();
                    resolve(fallbackWorker);
                }, 10000); // Thời gian timeout dài hơn cho kết nối chậm và tải WASM

                // Xử lý lỗi
                worker.addEventListener('error', (err) => {
                    console.error('Worker error:', err);
                    clearTimeout(timeout);
                    URL.revokeObjectURL(blobUrl);
                    const fallbackWorker = createFallbackStockfish();
                    resolve(fallbackWorker);
                });
            } catch (error) {
                console.error('Failed to process Stockfish source:', error);
                const fallbackWorker = createFallbackStockfish();
                resolve(fallbackWorker);
            }
        } catch (error) {
            console.error('Failed to create Stockfish worker:', error);
            const fallbackWorker = createFallbackStockfish();
            resolve(fallbackWorker);
        }
    });
}