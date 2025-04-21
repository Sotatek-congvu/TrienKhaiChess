// Definition for Stockfish WebWorker
declare module 'stockfish' {
    function Stockfish(): Worker;
    export = Stockfish;
}

// For WebWorker
declare interface StockfishWorker extends Worker {
    postMessage(message: string): void;
}