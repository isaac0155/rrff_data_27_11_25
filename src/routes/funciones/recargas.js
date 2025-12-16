const path = require('path');
const XLSX = require('xlsx');
const axios = require('axios');

// ===== Config (igual que en resultadosSys.js) =====
const API_URL = process.env.NZ_ENDPOINT || 'http://10.47.19.224:30001/netezza-execute';
const API_TOKEN = process.env.NZ_TOKEN || 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NTgyMjUwODF9.Q0PXeXvOjtAZalnVKKfhRTnUhfpThdCkXVDDLP8i_fw';
const CONNECTION_STRING =
    process.env.NZ_CONN ||
    'Driver={NetezzaSQL};server=10.49.5.173;UserName=U_ISHERRERA;Password=Isherra23;Database=SYSTEM;LoginTimeout=120';

// Helper: ejecuta query vía endpoint Netezza
async function nzExec(query) {
    const { data } = await axios.post(
        API_URL,
        { connectionString: CONNECTION_STRING, query },
        { headers: { Authorization: API_TOKEN, 'Content-Type': 'application/json' }, timeout: 120000 }
    );
    return data.netezzaResponse || [];
}

const recargas = async (fechaIni, fechaFin, datos, io, id) => {
    let str = datos;
    let array = str.split(',').map(s => s.trim().replace(/'/g, ''));
    console.log(array);

    let i = 0;

    for (const element of array) {
        try {
            io.emit('server:progressRF_' + id, 92, 'Esperando a Netezza para Recargas y Credito');

            // ⚠️ sanitiza mínimo (evita que te inyecten comillas)
            const telefono = String(element).replace(/'/g, "''");

            const query = `
        SELECT 
          fecha, 
          recharge_date_time, 
          nro_telefono, 
          r.ID_ENTIDAD,
          monto_recarga, 
          cantidad_recarga, 
          tp.TIPO_CARGA, 
          tp.GRUPO_CARGA, 
          tp.TIPO_CARGA_DETALLE, 
          plan_vone
        FROM pr_recargas.MODELO.FACT_Recargas_V2 r
        LEFT JOIN pr_catalogo.DIM.DIM_TIPO_CARGA tp
          ON tp.IDW_TIPO_CARGA = r.idw_tipo_carga
        WHERE nro_telefono='${telefono}'
          AND fecha >= date'${fechaIni}'
          AND fecha <  date'${fechaFin}'
        ORDER BY fecha DESC;
      `;

            console.log('Datos enviados a netezza', query);
            io.emit('server:progressRF_' + id, 95, 'Esperando a Netezza Recargas y Credito');

            const jsonData = await nzExec(query);

            if (!jsonData || jsonData.length === 0) {
                console.log('no hay datos para', element);
                // no retornes 0 aquí, porque cortarías el loop y no generarías para los demás
                continue;
            }

            io.emit('server:progressRF_' + id, 96, 'Datos Obtenido de Netezza');

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(jsonData);
            XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');

            io.emit('server:progressRF_' + id, 97, 'Excel Configurado con Flujo de Datos');

            const rutaCompleta = path.join(
                __dirname, '..', '..', 'public', 'img', 'imgenCliente',
                `RF_${id}_${element}_RECARGAS_CREDITO.xlsx`
            );

            XLSX.writeFile(wb, rutaCompleta);

            io.emit('server:progressRF_' + id, 98, 'Excel finalizado');
            i++;

        } catch (err) {
            console.log({ error: err.message, data: err.response?.data });
        }
    }

    return i;
};

module.exports = recargas;
