const oracledb = require('oracledb');

// Configuración del pool de conexiones
var poolConfig = {
    user: 'APP_RFISCAL',
    password: 'R%f1sc4l23',
    connectString: '10.49.4.21:1521/mits',
    poolMin: 1,
    poolMax: 50,
    poolIncrement: 5,
    poolTimeout: 21600
};

// Inicializar el pool de conexiones
async function initialize() {
    try {
        await oracledb.createPool(poolConfig);
        console.log('✅ Pool de conexiones creado Oracle');
    } catch (error) {
        console.error('Error al crear el pool de conexiones:', error);
    }
}

module.exports.initialize = initialize;
