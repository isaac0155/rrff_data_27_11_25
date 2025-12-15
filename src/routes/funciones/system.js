const path = require('path');
const XLSX = require('xlsx');
//const { netezzaConnection } = require('../../dataBaseNetezza');
const odbc = require('odbc');
const poolPG = require('../../dataBasePostgreSQL')

async function netezzaConnection() {
    //const connection = await odbc.connect('Driver={NetezzaSQL};server=10.49.5.173;UserName=U_RFISCAL;Password=R)1=sc4%l23;Database=SYSTEM;LoginTimeout=120');
    const connection = await odbc.connect('Driver={NetezzaSQL};server=10.49.5.173;UserName=U_ISHERRERA;Password=Isherra23;Database=SYSTEM;LoginTimeout=120');
    console.log('Base de datos conectada Netezza SYSTEM');
    return connection;
}
//const  = con()

const resultadosSys = async  (name, fechaIni, fechaFin, datos, io, id, celdas) => {
    try {
        io.emit('server:progressRF_' + id, 70, 'Esperando a Netezza para Flujo de Datos')
        var connection = await netezzaConnection();
        const query = `
        SELECT A.FECHA_INICIO_LLAMADA, A.FECHA_FIN_LLAMADA, A.nro_telefono, A.NRO_TELEFONO_DESTINO,
        A.END_VALUE AS BYTES_NAVEGADOS, A.value BYTES_FACTURADOS, A.imei,
        d.DESCRIPCION_CELDA, A.cell_id
        FROM PR_TRAFICO.MODELO.fact_trafico a, PR_CATALOGO.DIM.dim_red_acceso d
        WHERE A.service_type LIKE '%data%'
        AND A.nro_telefono IN (${datos})
        AND D.IDW_RED_ACCESO =  a.IDW_RED_ACCESO
        AND FECHA_INICIO_LLAMADA >= '${fechaIni}'
        AND fecha_fin_llamada < '${fechaFin}';
        `;
        
        console.log('Datos enviados e neteza');
        io.emit('server:progressRF_' + id, 75, 'Esperando a Netezza')
        const result = await connection.query(query);
        if (result.count == 0) {
            console.log('no hay datos');
            return 0
        }
        let jsonData = result;
        let cel_datos = []

        if(celdas){
            cel_datos = await poolPG.query(`
                SELECT 
                    a.cell_deci,
                    CASE 
                        WHEN a."Tecnologia" = '2G' THEN CAST(a.cell_deci AS TEXT) 
                        ELSE a."BTS_ID" 
                    END AS celda,
                    a."SITE_ID" || ' ' || a."NOMBRE" AS NOMBRE
                FROM 
                    performance_test.pivote a;
            `)
            // Crear un mapa para búsqueda rápida por cell_deci
            const celMap = new Map(cel_datos.rows.map(c => [c.cell_deci, c.nombre]));
    
            // Mapear jsonData y añadir campo radioBase si hay coincidencia
            const jsonDataEnriquecido = jsonData.map(obj => {
                const nombreCelda = celMap.get(obj.CELL_ID);
                return {
                    ...obj,
                    radioBase: nombreCelda || null  // Si no hay coincidencia, será null
                };
            });
    
            //console.log(jsonDataEnriquecido);
            jsonData = jsonDataEnriquecido
        }


        

        io.emit('server:progressRF_' + id, 85, 'Datos Obtenido de Netezza')
        const wb = XLSX.utils.book_new();

        // Crear una hoja de trabajo con los datos transformados
        const ws = XLSX.utils.json_to_sheet(jsonData);
        
        // Añadir la hoja de trabajo al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
        
        // Escribir el archivo XLSX (guardar en una ruta específica)
        io.emit('server:progressRF_' + id, 86, 'Excel Configurado con Flujo de Datos')
        const rutaCompleta = path.join(__dirname, '..', '..', 'public', 'img', 'imgenCliente', `${name}_FLUJO_DE_DATOS.xlsx`);
        XLSX.writeFile(wb, rutaCompleta);
        io.emit('server:progressRF_' + id, 88, 'Excel finalizado')
        connection.close()
        return 1
    } catch (err) {
        console.log({ error: err.message });
        return 0
    }
}

module.exports = resultadosSys;