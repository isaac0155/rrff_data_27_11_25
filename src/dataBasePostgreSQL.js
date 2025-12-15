const { Pool } = require('pg');

const poolPG = new Pool({
    host: '10.40.128.30',
    port: 5432,
    user: 'app_rfiscal',
    password: 'R%f1sc4l#25',
    database: 'newperformance_data',
    port: 5432,
    max: 10,
    idleTimeoutMillis: 60000,         // 1 minuto de inactividad por conexión
    connectionTimeoutMillis: 5000,    // tiempo de espera para conectar
    keepAlive: true                   // ⬅️ mantiene vivas las conexiones TCP
});

// Test inicial de conexión
(async () => {
    try {
        const client = await poolPG.connect();
        const res = await client.query('SELECT NOW()');
        console.log('✅ PostgreSQL conectado correctamente: newperformance_data');
        client.release();
    } catch (err) {
        console.error('❌ Error al conectar con PostgreSQL:', err.message);
        process.exit(1);
    }
})();

// Ping periódico (cada 5 min) para mantener activo el pool
setInterval(async () => {
    try {
        await poolPG.query('SELECT 1');
        console.log('📶 Ping PostgreSQL exitoso');
    } catch (e) {
        console.warn('⚠️ Fallo al hacer ping a PostgreSQL:', e.message);
    }
}, 30 * 60 * 1000); // cada 5 minutos

module.exports = poolPG;
