const path = require('path');
const XLSX = require('xlsx');
const ret = require('../links');

const odbc = require('odbc');
async function odeco() {
    //const connection = await odbc.connect('Driver={NetezzaSQL};server=10.49.5.173;UserName=U_RFISCAL;Password=R)1=sc4%l23;Database=SYSTEM;LoginTimeout=120');
    const connection = await odbc.connect('Driver={NetezzaSQL};server=10.49.5.173;UserName=U_ISHERRERA;Password=Isherra23;Database=PR_DETALLE_LLAMADAS;LoginTimeout=120');
    console.log('Base de datos conectada Netezza PR_DETALLE_LLAMADAS');
    return connection;
}


const resultOdeco = async (name, fechaIni, fechaFin, datos, io, id, ad, ofuscado) => {
    let array = datos;
    console.log(array)
    var i = 0
    for (const element of array) {
        try {
            io.emit('server:progressRF_' + id, 88, 'Esperando a Llamadas Odeco')
            var connection = await odeco();
            var query = `
            execute PR_DETALLE_LLAMADAS.STAGING.DETALLE(${element}1234,'${ad}','${element}','${fechaIni}','${fechaFin}','01111',NOW());
            `;
            
            console.log('Datos enviados e neteza');
            io.emit('server:progressRF_' + id, 88, 'Enviado a Llamadas Odeco')
            const result = await connection.query(query);

            await result;

            io.emit('server:progressRF_' + id, 88, 'Datos Obtenidos de Netezza')

            query = `
                select
                REQ_ID, NAME_A,NAME_B,FECHA_LLAMADA ,fecha_llamada_fin,
                tipo_llamada_grupo TIPO,SEGUNDOS_REDONDEO, tipo_llamada estado, ciudad_destino destino, mtr_comment,saldo_datos / 1000 saldo_datos_KB,(data_volumen_redondeo)/1000 KBYTES,
                saldo_segundos, saldo_sms,
                (saldo_controlado + saldo_carga + saldo_tranfucion + saldo_promo) saldo , importe
                FROM PR_DETALLE_LLAMADAS.STAGING.trafico_prepago_portal a
                --WHERE req_id  between 664 and 67
                WHERE req_id  in (${element}1234)
                and fecha_llamada >= TO_date ('${fechaIni}', 'YYYY-MM-DD')
                and fecha_llamada < TO_date ('${fechaFin}', 'YYYY-MM-DD')
                AND A.tipo_llamada_grupo<>'ENT'
                order by name_a,fecha_llamada_fin, FECHA_LLAMADA;
            `
            const resultOdeco = await connection.query(query);
            var jsonData = await resultOdeco;
            var newData = [];
            
            if (jsonData.length > 0) {
                // Realizar una copia profunda de jsonData para newData
                newData = JSON.parse(JSON.stringify(jsonData));
                
                // Eliminar REQ_ID de jsonData
                jsonData.forEach(element => {
                    delete element.REQ_ID;
                });
                
                // Aplicar ofuscación a newData
                newData.forEach(element => {
                    element.NAME_B = element.NAME_B ? maskLastFourChars(element.NAME_B) : null;
                });
                
                if (id == 'OFUSCADO'){
                    return newData
                }
                if (id == 'COMPLETO'){
                    return jsonData
                }   
                if (id != 'OFUSCADO' || id != 'COMPLETO'){
                    const wb = XLSX.utils.book_new();
                    var ws;
    
                    // Seleccionar qué datos usar basado en 'ofuscado'
                    if (ofuscado == true) {
                        //console.log(newData[6], ofuscado);
                        ws = XLSX.utils.json_to_sheet(newData);
                    } else {
                        //console.log(jsonData[6], ofuscado, 'sin ofuscar');
                        ws = XLSX.utils.json_to_sheet(jsonData);
                    }
                    // Añadir la hoja de trabajo al libro y guardar el archivo
                    XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
                    io.emit('server:progressRF_' + id, 88, 'Excel Configurado con Llamadas Odeco');
                    const rutaCompleta = path.join(__dirname, '..', '..', 'public', 'img', 'imgenCliente', `${name}_${element}_DETALLE_LLAMADAS.xlsx`);
                    XLSX.writeFile(wb, rutaCompleta);
                    io.emit('server:progressRF_' + id, 100, 'Excel finalizado');
    
                    i += 1;  // Incrementar contador o índice según la lógica original
                }
            }
            connection.close()

        } catch (err) {
            console.log({ error: err.message });
        }
    }
    return i
}
function maskLastFourChars(str) {
    if (str.length <= 4) {
        // Si el string tiene 4 caracteres o menos, reemplaza todo con asteriscos
        return '*'.repeat(str.length);
    }
    // Toma todos los caracteres excepto los últimos cuatro y añade 4 asteriscos
    return str.slice(0, -4) + '****';
}
module.exports = resultOdeco;