const oracledb = require('oracledb');

// 📌 Función para ejecutar procedimientos almacenados
async function executeProcedure(procName, params = {}) {
    let connection;
    try {
        connection = await oracledb.getConnection(); // Obtener una conexión del pool

        // Construir la lista de parámetros basada en las claves del objeto params
        const paramKeys = Object.keys(params);
        const paramPlaceholders = paramKeys.map(key => `:${key}`).join(', ');

        // Construir la cadena SQL para llamar al procedimiento almacenado
        const sql = `BEGIN ${procName}(${paramPlaceholders}); END;`;
        let pcdre = convertirAPlano(sql, params)
        console.log(`🔹 Ejecutando Procedimiento:\n`, pcdre);

        // Ejecutar el procedimiento almacenado con los parámetros
        await connection.execute(sql, params);
        console.log('✅ Procedimiento ejecutado correctamente.');
        return pcdre

    } catch (err) {
        console.error('❌ Error al ejecutar el procedimiento almacenado:', err);
        console.log({ sql, params }); // Mostrar consulta y parámetros para depuración
        throw err; // Relanzar el error para manejo externo
    } finally {
        if (connection) {
            try {
                await connection.close(); // Asegurarse de cerrar la conexión
            } catch (err) {
                console.error('⚠️ Error al cerrar la conexión:', err);
            }
        }
    }
}

// 📌 Función para ejecutar consultas SQL normales
async function executeQuery(sql, params = {}) {
    let connection;
    try {
        connection = await oracledb.getConnection(); // Obtener una conexión del pool

        console.log(`🔹 Ejecutando Query:\n${sql}\n🔹 Parámetros:`, params);

        // Ejecutar el query con los parámetros y devolver los resultados
        const result = await connection.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        console.log('✅ Query ejecutado correctamente.');
        return result.rows; // Devolver las filas obtenidas

    } catch (err) {
        console.error('❌ Error al ejecutar la consulta:', err);
        console.log({ sql, params }); // Mostrar la consulta y parámetros para depuración
        throw err; // Relanzar el error para manejo externo
    } finally {
        if (connection) {
            try {
                await connection.close(); // Cerrar la conexión después de usarla
            } catch (err) {
                console.error('⚠️ Error al cerrar la conexión:', err);
            }
        }
    }
}

// 📌 Función para convertir una consulta SQL a formato "plano" para depuración
function convertirAPlano(sql, params) {
    //console.log(sql);
    const procedureMatch = sql.match(/BEGIN\s+([\w.]+)\s*\(/i);
    const procedureName = procedureMatch ? procedureMatch[1] : "PROCEDIMIENTO_DESCONOCIDO";

    let procedureCall = `BEGIN\n${procedureName}(`;

    const paramsList = Object.entries(params).map(([key, value]) => {
        const formattedValue = typeof value === 'string' ? `'${value}'` : value;
        return `    ${key} => ${formattedValue}`;
    }).join(",\n");

    procedureCall += `${paramsList}\n);\nEND;`;

    return procedureCall;
}


// 📌 Exportar las funciones para su uso en otros archivos
module.exports = {
    executeProcedure,
    executeQuery
};
