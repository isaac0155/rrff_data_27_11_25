const enqueueFtpTask = require('./ftp')
const pool = require('../../database');

// ✅ Construye el procedure en texto plano (para guardar en BBDD ANTES de ejecutarlo)
function procedureAPlano(procName, params = {}) {
    const formatValue = (v) => {
        if (v === null || v === undefined) return "NULL";
        if (v instanceof Date) return `TO_DATE('${v.toISOString().slice(0, 19).replace('T', ' ')}','YYYY-MM-DD HH24:MI:SS')`;
        if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`; // escape '
        if (typeof v === "boolean") return v ? "1" : "0";
        return String(v);
    };

    const paramsList = Object.entries(params)
        .map(([key, value]) => `    ${key} => ${formatValue(value)}`)
        .join(",\n");

    return `BEGIN\n${procName}(\n${paramsList}\n);\nEND;`;
}

const filtradoQuery = async (json, id, io) => {
    const { executeProcedure } = require('./oracleDbService');
    io.emit('server:progressRF_' + id, 15, 'Esperando a Mits')
    const { datos, fechaIni, fechaFin, imei, titular, opciones, refTitulares } = json

    let procedureName, params;
    let package_bbdd = 'RF_DATOS_2';

    if (json.opcionSeleccionada == "nombre") {
        procedureName = `LD.${package_bbdd}.NOMBRE`;
        params = {
            pvi_cod_req: `RF_${id}`,
            pvi_nombre: datos,
            pvi_fecha_ini: fechaIni,
            pvi_fecha_fin: fechaFin,
            pvi_imeis: imei,
            pvi_titulares: titular,
            pvi_llamadas: opciones,
            pvi_tit_traf: refTitulares
        };
    }

    if (json.opcionSeleccionada == "telefono") {
        procedureName = `LD.${package_bbdd}.TELEFONO`;
        params = {
            pvi_cod_req: `RF_${id}`,
            pvi_telefono: datos,
            pvi_fecha_ini: fechaIni,
            pvi_fecha_fin: fechaFin,
            pvi_titulares: titular,
            pvi_imeis_reg: imei,
            pvi_llamadas: opciones,
            pvi_tit_traf: refTitulares
        };
    }

    if (json.opcionSeleccionada == "imei") {
        procedureName = `LD.${package_bbdd}.IMEI`;
        params = {
            pvi_cod_req: `RF_${id}`,
            pvi_imei: datos,
            pvi_fecha_ini: fechaIni,
            pvi_fecha_fin: fechaFin,
            pvi_titulares: titular,
            pvi_llamadas: opciones,
            pvi_tit_traf: refTitulares
        };
    }

    if (json.opcionSeleccionada == "ci") {
        procedureName = `LD.${package_bbdd}.CI`;
        params = {
            pvi_cod_req: `RF_${id}`,
            pvi_ci: datos,
            pvi_fecha_ini: fechaIni,
            pvi_fecha_fin: fechaFin,
            pvi_imeis: imei,
            pvi_titulares: titular,
            pvi_llamadas: opciones,
            pvi_tit_traf: refTitulares
        };
    }

    try {
        // ✅ 1) Construir el procedure plano ANTES de ejecutar
        const pcdre = procedureAPlano(procedureName, params);

        // ✅ 2) Guardarlo en tu BBDD ANTES de enviar a Oracle
        await pool.query(
            'UPDATE historialconsulta SET procedimiento_usado = ? WHERE nombre = ?',
            [pcdre, `RF_${id}`]
        );

        // ✅ 3) Ejecutar Oracle (devuelve true/false)
        const ok = await executeProcedure(procedureName, params);

        if (!ok) {
            console.error('❌ Procedimiento NO ejecutado (executeProcedure devolvió false).');
            // si quieres, aquí podrías marcar estado en tu tabla (opcional)
        } else {
            console.log('✅ Procedimiento ejecutado exitosamente');
        }

    } catch (error) {
        console.error('Error al ejecutar el procedimiento:', error, '//En:', json.opcionSeleccionada, params);
    }

    io.emit('server:progressRF_' + id, 45, 'Recogiendo resultados de Mits')

    return enqueueFtpTask(id, datos, io)
        .then(result => result)
        .catch(error => {
            console.error('Error en la tarea:', error);
        });
}

module.exports = filtradoQuery;
