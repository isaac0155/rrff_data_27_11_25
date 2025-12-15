const oracledb = require('oracledb');

// 📌 Configuración del pool de conexiones para la SEGUNDA BASE DE DATOS (ODB)
const poolConfigODB = {
    user: 'IT_IHERRERA',
    password: 'mare$$O334#.1',
    connectString: '10.49.5.76:1521/odb',
    poolMin: 1,
    poolMax: 50,
    poolIncrement: 5,
    poolTimeout: 21600
};

// 📌 Inicializar el pool de conexiones para la segunda BBDD
async function initializeODB() {
    try {
        await oracledb.createPool({
            ...poolConfigODB,
            poolAlias: 'ODB', // 🔹 Alias de conexión
        });
        console.log('✅ Pool de conexiones creado para la Base de Datos ODB');
    } catch (error) {
        console.error('❌ Error al crear el pool de conexiones de ODB:', error);
    }
}

// 📌 Función para ejecutar CONSULTAS en la segunda BBDD
async function executeQueryODB(query, params = []) {
    let connection;
    try {
        connection = await oracledb.getConnection('ODB'); // Usa el alias del pool
        const result = await connection.execute(query, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows;
    } catch (error) {
        console.error('❌ Error al ejecutar la consulta en la ODB:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('⚠️ Error al cerrar la conexión:', error);
            }
        }
    }
}

// 📌 Función para ejecutar PROCEDIMIENTOS en la segunda BBDD
async function executeProcedureODB(procedureName, params) {
    let connection;
    try {
        connection = await oracledb.getConnection('ODB'); // Usa el alias del pool
        const bindParams = params.map((value, index) => `:param${index + 1}`).join(', ');
        const sql = `BEGIN ${procedureName}(${bindParams}); END;`;

        const binds = {};
        params.forEach((value, index) => {
            binds[`param${index + 1}`] = value;
        });

        const result = await connection.execute(sql, binds, { autoCommit: true });
        return result;
    } catch (error) {
        console.error('❌ Error al ejecutar el procedimiento en la ODB:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('⚠️ Error al cerrar la conexión:', error);
            }
        }
    }
}

// 📌 Exportar las funciones correctamente
module.exports = {
    initializeODB,
    executeQueryODB,
    executeProcedureODB
};
