// Importaciones de módulos y archivos necesarios para la funcionalidad
const pool = require('../../database');
const filtradoQuery = require('./mits');
const resultadosSys = require('./system');
const resultadoOdeco = require('./llamadasOdeco');
const { extraerNumeros } = require('./format');
const recargas = require('./recargas');

// Función para formatear el JSON eliminando prefijos específicos y organizando los datos
const formatJson = (json) => {
    const { opcionSeleccionada, ...otrosCampos } = json;
    let campo = [];
    for (const key in otrosCampos) {
        if (key.startsWith('campo_')) {
            campo.push(otrosCampos[key].trim());
            delete otrosCampos[key];
        }
    }
    return { opcionSeleccionada, campo, ...otrosCampos };
}

// Función principal para el control de solicitudes RF, incluyendo inserciones en la base de datos y emisiones de eventos
const controlRRFF = async (json, nuevoReqBody, idPersona, id, socket, io, ad, ip) => {
        //console.log(result_string)
    
    //console.log(result_string)
    // Inserción en la tabla de historial de consulta con los datos recopilados
    const ahora = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const fechaActual = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`;


    await pool.query(`
            INSERT INTO historialconsulta SET 
            idPersona = ${idPersona}, 
            fecha = '${fechaActual}', 
            rangoBusqueda = '${json.fechaIni} / ${json.fechaFin}', 
            datoSolicitado = '${json.opcionesSeleccionadas.join(', ') }', 
            nombre = 'RF_${id}', 
            tipoBusqueda='${nuevoReqBody.opcionSeleccionada}', 
            pm = '${json.cite}',
            ip = '${ip}',
            body = '${JSON.stringify(nuevoReqBody)}',
            estado_proceso = 'Running';`);
     
    // Notificación al cliente sobre la solicitud en proceso
    socket.emit('server:solicitudRRFF', id);
    io.emit('server:progressRF_' + id, 5, 'Historial creado');

    // Procesamiento del filtro de consulta y manejo de resultados
    var respo = await filtradoQuery(nuevoReqBody, id, io);

    //fata corregir de aqui en adelante


    //console.log('responseadA_sdasd:', respo)     
    var response = await respo.txt.trim() || '';
    const posicion = response.indexOf("--------------");
    var nuevoTexto = posicion !== -1 ? response.substring(0, posicion) : response;
    var archivos = respo.datos1.archivos > 0 ? respo.datos1.archivos : false;
    nuevoTexto = nuevoTexto.trim();
    const resultado = nuevoTexto.match(/\d+\. TRAFICO:\n([\s\S]*?)(?:\n\n|\d+\.\s+\w+:|$)/);
    var ang = '';
    
    try {
        ang = extraerNumeros(resultado[1].trim());
    } catch {
        ang = '';
    }
    // Función auxiliar para insertar los textos en la sección "5. TRAFICO:"
    function insertarEnSeccionTraficos(texto, lineasExtra) {
        const bloques = texto.split(/\n(?=\d+\.\s+\w+:)/);
        const secciones = [];
        const traficoContenido = [];
        const lineasAdjuntas = lineasExtra.map(l => `-${l.trim().replace(/^-/, '')}`);

        let traficoIndice = null;

        for (let i = 0; i < bloques.length; i++) {
            const encabezadoMatch = bloques[i].match(/^(\d+)\.\s+(\w+):\n?/);
            if (encabezadoMatch) {
                const [_, num, nombre] = encabezadoMatch;
                if (nombre.trim().toUpperCase() === 'TRAFICO') {
                    traficoContenido.push(bloques[i].replace(/^(\d+)\.\s+TRAFICO:\n?/, '').trim());
                    continue; // no agregar al listado de secciones
                }
                secciones.push({ num: parseInt(num), nombre, bloque: bloques[i] });
            } else {
                secciones.push({ num: null, nombre: null, bloque: bloques[i] });
            }
        }

        // Determinar el número que debe tener la nueva sección TRAFICO
        const usados = secciones.map(s => s.num).filter(n => n !== null);
        let nuevoNum = 1;
        while (usados.includes(nuevoNum)) nuevoNum++;

        // Construir nueva sección TRAFICO
        const contenidoTraficoFinal = `${nuevoNum}. TRAFICO:\n${[...lineasAdjuntas, ...traficoContenido].join('\n')}\n`;

        // Insertar en la posición correcta
        let insertado = false;
        const resultado = [];

        for (const sec of secciones) {
            if (!insertado && sec.num !== null && sec.num > nuevoNum) {
                resultado.push(contenidoTraficoFinal);
                insertado = true;
            }
            resultado.push(sec.bloque);
        }

        if (!insertado) resultado.push(contenidoTraficoFinal);

        return resultado.join('\n').trim();
    }


    // -------------------------- INICIO DE BLOQUE MODIFICADO --------------------------

    // Preparamos las líneas a insertar en sección TRAFICO
    const lineasAdjunto = [];

    // Procesamiento de flujos de datos si se incluyen en la solicitud
    if (nuevoReqBody.datosGSM == "DATOS") {
        if (resultado && resultado[1]) {
            io.emit('server:progressRF_' + id, 65, 'Enviando datos a Netezza');
            let cel_datos = nuevoReqBody.cel_datos == "CEL_DATOS" ? true : false;

            var xls = await resultadosSys(respo.datos1.nombre, json.fechaIni, json.fechaFin, ang, io, id, cel_datos);
            if (xls > 0) {
                archivos += xls;
                nuevoTexto += ('\n-TRAFICO DE DATOS ADJUNTO.');
            } else {
                nuevoTexto += ('\n-NO HAY TRAFICO DE DATOS.');
            }
        } else {
            nuevoTexto += ('\n-NO HAY TRAFICO DE DATOS.');
        }
    }

    // Procesamiento de recargas si se incluyen en la solicitud
    //console.log(nuevoReqBody);
    if (nuevoReqBody.recargas == "RECARGAS") {
        io.emit('server:progressRF_' + id, 90, 'Buscando detalle de Recargas Credito');
        var rec = await recargas(json.fechaIni, json.fechaFin, ang, io, id);
        if (rec) {
            archivos += rec;
            nuevoTexto += ('\n-TRAFICO DE RECARGAS DE CREDITO ADJUNTO.');
        } else {
            nuevoTexto += ('\n-NO HAY TRAFICO DE RECARGAS.');
        }
    }
    function unirSeccionesTrafico(nuevoTexto) {
        const secciones = nuevoTexto.split(/\n(?=\d+\.\s+\w+:)/);
        const traficoBloques = [];
        const otrasSecciones = [];
        let menorNumero = null;

        for (const bloque of secciones) {
            const match = bloque.match(/^(\d+)\.\s+TRAFICO:\n([\s\S]*)$/i);
            if (match) {
                const numero = parseInt(match[1]);
                const contenido = match[2].trim();
                traficoBloques.push(contenido);
                if (menorNumero === null || numero < menorNumero) {
                    menorNumero = numero;
                }
            } else {
                otrasSecciones.push(bloque);
            }
        }

        if (traficoBloques.length === 0) return nuevoTexto; // nada que unir

        const contenidoUnificado = traficoBloques.join('\n').trim();
        const nuevaSeccion = `\n${menorNumero}. TRAFICO ADICIONAL:\n${contenidoUnificado}\n`;

        // Insertar la nueva sección en orden (por número)
        const resultado = [];
        let insertado = false;
        for (const bloque of otrasSecciones) {
            const match = bloque.match(/^(\d+)\./);
            if (!insertado && match && parseInt(match[1]) > menorNumero) {
                resultado.push(nuevaSeccion);
                insertado = true;
            }
            resultado.push(bloque);
        }

        if (!insertado) {
            resultado.push(nuevaSeccion);
        }

        return resultado.join('\n').trim();
    }


    // Insertamos todos los textos en la sección correcta
    //nuevoTexto = insertarEnSeccionTraficos(nuevoTexto, lineasAdjunto);
    //nuevoTexto = unirSeccionesTrafico(nuevoTexto);

    //console.log(nuevoTexto)
    // -------------------------- FIN DE BLOQUE MODIFICADO --------------------------


    // Finalización del texto y actualización del historial de consulta con los resultados finales
    //nuevoTexto += '\n---------------------------------------------------------------------------------------------------------\n';
    io.emit('server:progressRF_' + id, 99, 'Historial finalizado');
    await pool.query(`
            UPDATE historialconsulta SET 
                entradaBusqueda = '${respo.datos1.busqueda}', 
                resultado = '${nuevoTexto.trim()}', 
                archivo = ${archivos}, 
                body = null,
                estado_proceso = 'Successful'
                WHERE nombre = 'RF_${id}';
            `);
    io.emit('server:progressRF_' + id, 100, 'Tarea Finalizada');
    var instruccion = 'server:solicitudRRFFRF_' + id;
    io.emit(instruccion);
}

// Exportación de las funciones para su uso en otros módulos
module.exports = {
    controlRRFF,
    formatJson
}
