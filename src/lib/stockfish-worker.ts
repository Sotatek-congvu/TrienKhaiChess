// This file helps load Stockfish as a WebWorker for browser compatibility

// Sử dụng phiên bản WASM của Stockfish để hiệu suất cao hơn
// Có thể chọn từ các nguồn khác nhau dựa trên kết nối và tính khả dụng
const stockfishSources = [
    // Phiên bản cục bộ trong project (load từ thư mục public)
    './engine/stockfish.js',
    // Phiên bản WASM chính thức mới nhất từ unpkg (CDN)
    'https://unpkg.com/stockfish@16.0.0/src/stockfish.wasm.js',
    // Phiên bản thay thế từ jsdelivr (nếu unpkg không hoạt động)
    'https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish.wasm.js',
    // Fallback đến phiên bản non-WASM nếu các phiên bản trên không hoạt động
    'https://unpkg.com/stockfish@16.0.0/src/stockfish.js'
];

/**
 * Cố gắng tải Stockfish từ các nguồn khác nhau cho đến khi thành công
 * @returns URL của nguồn Stockfish có thể truy cập được
 */
async function getWorkingStockfishUrl(): Promise<string> {
    for (const url of stockfishSources) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            if (response.ok) {
                console.log(`Sử dụng Stockfish từ: ${url}`);
                return url;
            }
        } catch (error) {
            console.warn(`Không tải được Stockfish từ ${url}, thử nguồn khác...`);
        }
    }
    throw new Error('Không thể tải Stockfish từ bất kỳ nguồn nào');
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
            const stockfishUrl = await getWorkingStockfishUrl();
            console.log('Fetching Stockfish from:', stockfishUrl);

            // Tải mã nguồn Stockfish
            const response = await fetch(stockfishUrl);
            if (!response.ok) {
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
                reject(new Error('Stockfish worker initialization timed out'));
            }, 10000); // Thời gian timeout dài hơn cho kết nối chậm và tải WASM

            // Xử lý lỗi
            worker.addEventListener('error', (err) => {
                console.error('Worker error:', err);
                clearTimeout(timeout);
                URL.revokeObjectURL(blobUrl);
                reject(err);
            });
        } catch (error) {
            console.error('Failed to create Stockfish worker:', error);
            reject(error);
        }
    });
}