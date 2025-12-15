const path = require('path');
const XLSX = require('xlsx');
const { netezzaConnection } = require('../../dataBaseNetezza');

const recargas = async (fechaIni, fechaFin, datos, io, id) => {
    let str = datos;
    let array = str.split(',').map(s => s.trim().replace(/'/g, ''));
    console.log(array)
    var i = 0
    for (const element of array) {
        
        try {
            io.emit('server:progressRF_' + id, 92, 'Esperando a Netezza para Recargas y Credito')
            var connection = await netezzaConnection;
    
    
            const query = `
            select
            REQ_ID, NAME_A,NAME_B,FECHA_LLAMADA ,fecha_llamada_fin,
            tipo_llamada_grupo TIPO,SEGUNDOS_REDONDEO, tipo_llamada estado, ciudad_destino destino, mtr_comment,saldo_datos / 1000 saldo_datos_KB,(data_volumen_redondeo)/1000 KBYTES,
            (saldo_controlado + saldo_carga + saldo_tranfucion + saldo_promo) saldo , importe
            FROM PR_DETALLE_LLAMADAS.STAGING.trafico_prepago_portal a
            --WHERE req_id  between 664 and 67
            WHERE req_id  in (${element}1234)
            and fecha_llamada >= TO_date ('${fechaIni}', 'YYYY-MM-DD')
            and fecha_llamada < TO_date ('${fechaFin}', 'YYYY-MM-DD')
            AND A.tipo_llamada_grupo<>'ENT'
            order by name_a,fecha_llamada_fin, FECHA_LLAMADA;
            `;
    
            console.log('Datos enviados e neteza', query);
            io.emit('server:progressRF_' + id, 95, 'Esperando a Netezza Recargas y Credito')
            const result = await connection.query(query);
            if (result.count == 0) {
                console.log('no hay datos');
                return 0
            }
            const jsonData = result;
    
            io.emit('server:progressRF_' + id, 96, 'Datos Obtenido de Netezza')
            const wb = XLSX.utils.book_new();
    
            const ws = XLSX.utils.json_to_sheet(jsonData);
    
            XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
    
            io.emit('server:progressRF_' + id, 97, 'Excel Configurado con Flujo de Datos')
            const rutaCompleta = path.join(__dirname, '..', '..', 'public', 'img', 'imgenCliente', `RF_${id}_${element}_RECARGAS_CREDITO.xlsx`);
            XLSX.writeFile(wb, rutaCompleta);
            io.emit('server:progressRF_' + id, 98, 'Excel finalizado')
            i++
        } catch (err) {
            console.log({ error: err.message });
        }
    };
    return i
}
module.exports = recargas