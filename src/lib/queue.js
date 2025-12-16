// src/lib/queue.js
function createQueue({ concurrency = 2 } = {}) {
    let running = 0;
    const q = [];

    const runNext = () => {
        if (running >= concurrency) return;
        const item = q.shift();
        if (!item) return;

        running++;
        item.fn()
            .then(item.resolve)
            .catch(item.reject)
            .finally(() => {
                running--;
                runNext();
            });
    };

    const add = (fn) =>
        new Promise((resolve, reject) => {
            q.push({ fn, resolve, reject });
            runNext();
        });

    return {
        add,
        stats: () => ({ running, queued: q.length, concurrency })
    };
}

module.exports = { createQueue };
