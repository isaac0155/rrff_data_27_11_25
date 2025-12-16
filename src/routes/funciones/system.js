// resultadosSys.js
// npm i axios xlsx
const path = require('path');
const XLSX = require('xlsx');
const axios = require('axios');
const poolPG = require('../../dataBasePostgreSQL');

// ===== Config =====
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

const resultadosSys = async (name, fechaIni, fechaFin, datos, io, id, celdas) => {
    try {
        io.emit('server:progressRF_' + id, 70, 'Esperando a Netezza para Flujo de Datos');

        // Normaliza el IN (...) por si 'datos' llega como array
        const inList = Array.isArray(datos)
            ? datos.map(v => (typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`)).join(',')
            : String(datos);

        const query = `
      SELECT
        A.FECHA_INICIO_LLAMADA,
        A.FECHA_FIN_LLAMADA,
        A.nro_telefono,
        A.NRO_TELEFONO_DESTINO,
        A.END_VALUE AS BYTES_NAVEGADOS,
        A.value AS BYTES_FACTURADOS,
        A.imei,
        d.DESCRIPCION_CELDA,
        A.cell_id
      FROM PR_TRAFICO.MODELO.fact_trafico a,
           PR_CATALOGO.DIM.dim_red_acceso d
      WHERE A.service_type LIKE '%data%'
        AND A.nro_telefono IN (${inList})
        AND D.IDW_RED_ACCESO = a.IDW_RED_ACCESO
        AND FECHA_INICIO_LLAMADA >= '${fechaIni}'
        AND fecha_fin_llamada   <  '${fechaFin}';
    `;

        io.emit('server:progressRF_' + id, 75, 'Esperando a Netezza');
        let jsonData = await nzExec(query);
        if (!jsonData || jsonData.length === 0) {
            console.log('no hay datos');
            return 0;
        }

        // Enriquecimiento opcional con Postgres (radioBase por CELL_ID)
        if (celdas) {
            const cel_datos = await poolPG.query(`
        SELECT 
          a.cell_deci,
          CASE 
            WHEN a."Tecnologia" = '2G' THEN CAST(a.cell_deci AS TEXT) 
            ELSE a."BTS_ID" 
          END AS celda,
          a."SITE_ID" || ' ' || a."NOMBRE" AS nombre
        FROM performance_test.pivote a;
      `);

            const celMap = new Map(cel_datos.rows.map(c => [c.cell_deci, c.nombre || c.NOMBRE]));
            jsonData = jsonData.map(obj => ({
                ...obj,
                radioBase: celMap.get(obj.CELL_ID) || null,
            }));
        }

        io.emit('server:progressRF_' + id, 85, 'Datos Obtenido de Netezza');

        // Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(jsonData);
        XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');

        io.emit('server:progressRF_' + id, 86, 'Excel Configurado con Flujo de Datos');
        const rutaCompleta = path.join(
            __dirname, '..', '..', 'public', 'img', 'imgenCliente',
            `${name}_FLUJO_DE_DATOS.xlsx`
        );
        XLSX.writeFile(wb, rutaCompleta);
        io.emit('server:progressRF_' + id, 88, 'Excel finalizado');

        return 1;
    } catch (err) {
        console.log({ error: err.message, data: err.response?.data });
        return 0;
    }
};

module.exports = resultadosSys;
