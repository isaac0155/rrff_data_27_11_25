const oracledb = require('oracledb');

// 📌 Función para buscar por NOMBRE en ODB
async function buscarPorNombre(nombre) {
    let connection;
    try {
        connection = await oracledb.getConnection('ODB'); // Usa el alias del pool
        const query = `
            SELECT full_name, document_identifier
            FROM knowledge.person_aros@odb
            WHERE full_name LIKE :nombre
            AND ROWNUM <= 5
        `;
        const result = await connection.execute(query, { nombre: `${nombre}%` }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows;
    } catch (error) {
        console.error('❌ Error al buscar por nombre en ODB:', error);
        throw error;
    } finally {
        if (connection) await connection.close();
    }
}

// 📌 Función para verificar si un TELÉFONO existe en ODB
async function verificarTelefono(telefono) {
    let connection;
    try {
        connection = await oracledb.getConnection('ODB');
        const query = `
            SELECT 1 
            FROM clients.consumption_entity_identifier@odb
            WHERE service_identifier = :telefono
        `;
        const result = await connection.execute(query, { telefono }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows.length > 0; // Retorna `true` si la línea existe, `false` si no
    } catch (error) {
        console.error('❌ Error al verificar teléfono en ODB:', error);
        throw error;
    } finally {
        if (connection) await connection.close();
    }
}

// 📌 Función para buscar por CI en ODB
async function buscarPorCI(ci) {
    let connection;
    try {
        connection = await oracledb.getConnection('ODB');
        const query = `
            SELECT document_identifier, LISTAGG(FULL_NAME, ', ') WITHIN GROUP (ORDER BY FULL_NAME) AS full_name
            FROM knowledge.person_aros@odb
            WHERE document_identifier LIKE :ci || '%'
            AND ROWNUM <= 5
            GROUP BY document_identifier
        `;
        const result = await connection.execute(query, { ci }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows;
    } catch (error) {
        console.error('❌ Error al buscar por CI en ODB:', error);
        throw error;
    } finally {
        if (connection) await connection.close();
    }
}

const { executeQuery } = require('./oracleDbService');

async function buscarPorIMEI(imei) {
    try {
        const sql = `SELECT TELEFONO, IMEI FROM LD.TELF_IMEI_IMSI WHERE IMEI = :imei`;

        console.log(`🔍 Ejecutando consulta IMEI:\n${sql}\n🔹 Parámetro:`, imei);

        const result = await executeQuery(sql, { imei });

        console.log('✅ Consulta ejecutada correctamente.');
        return result; // Retornar los resultados

    } catch (err) {
        console.error('❌ Error al ejecutar la consulta IMEI:', err);
        throw err; // Relanzar el error
    }
}



// 📌 Exportar funciones
module.exports = {
    buscarPorNombre,
    verificarTelefono,
    buscarPorCI,
    buscarPorIMEI
};
