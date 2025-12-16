class Limiter {
    constructor(max = 5) {
        this.max = max;
        this.running = 0;
        this.queue = [];
    }

    async acquire() {
        if (this.running < this.max) {
            this.running++;
            return;
        }
        await new Promise(resolve => this.queue.push(resolve));
        this.running++;
    }

    release() {
        this.running--;
        const next = this.queue.shift();
        if (next) next();
    }

    async run(fn) {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }

    stats() {
        return { max: this.max, running: this.running, queued: this.queue.length };
    }
}

const rrffLimiter = new Limiter(Number(process.env.RRFF_MAX_CONCURRENCY || 5));
// recomendado: 1 para no reventar Chromium/Puppeteer
const pdfLimiter = new Limiter(Number(process.env.PDF_MAX_CONCURRENCY || 2));

module.exports = { Limiter, rrffLimiter, pdfLimiter };
