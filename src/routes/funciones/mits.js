const enqueueFtpTask = require('./ftp')
const pool = require('../../database'); 


const filtradoQuery = async (json, id, io) => {
    //console.log('-------------------------------', json, '-------------------------------')
    const { executeProcedure } = require('./oracleDbService');
    io.emit('server:progressRF_' + id, 15, 'Esperando a Mits')
    const { datos, fechaIni, fechaFin, imei, titular, opciones, refTitulares } = json



    let procedureName, params;
    let package_bbdd = 'RF_DATOS_2';//RF_DATOS pra packete normal //RF_DATOS_2 para el de pruebas

    // Caso para "nombre"
    if (json.opcionSeleccionada == "nombre") {
        //console.log('nombre')
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

    // Caso para "telefono"
    if (json.opcionSeleccionada == "telefono") {
        //console.log("telefono")
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
    
    // Caso para "imei"
    if (json.opcionSeleccionada == "imei") {
        //console.log("imei")
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

    // Caso para "ci"
    if (json.opcionSeleccionada == "ci") {
        //console.log("ci")
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
        //console.log(procedureName, params,'----------------------------------');
        let result = await executeProcedure(procedureName, params);
        //console.log(result, '---------------------------------asdadasdasdasdasdasd-');
        await pool.query(
            'UPDATE historialconsulta SET procedimiento_usado = ? WHERE nombre = ?',
            [result, `RF_${id}`]
          );
          
        console.log('Procedimiento ejecutado exitosamente');
    } catch (error) {
        console.error('Error al ejecutar el procedimiento:', error, '//En:', json.opcionSeleccionada, params);
    }
    io.emit('server:progressRF_' + id, 45, 'Recogiendo resultados de Mits')
    // Ejemplo de cómo llamar a enqueueFtpTask
    return enqueueFtpTask(id, datos, io)
        .then(result => {
            //console.log('Tarea completada:', result);
            return result
        })
        .catch(error => {
            console.error('Error en la tarea:', error);
        });

}
module.exports = filtradoQuery;