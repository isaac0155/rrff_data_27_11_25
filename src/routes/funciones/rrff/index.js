const shortid = require('shortid');
const pool = require('../../../database');
const { results_convert_html, updatePdfWithResults } = require('../../funciones/pdf_process');
const { controlRRFF, formatJson } = require('../controlRRFF');

// ✅ NUEVO: limitadores globales
const { rrffLimiter, pdfLimiter } = require('../../../lib/limiter');

function limiterLine(name, stats) {
    return `${name} | max=${stats.max} | running=${stats.running} | queued=${stats.queued}`;
}
function nowIso() {
    return new Date().toISOString();
}
function logLimiter(name, extra = '') {
    const stats = name === 'RRFF' ? rrffLimiter.stats() : pdfLimiter.stats();
    console.log(`🧵 ${nowIso()} | ${limiterLine(name, stats)}${extra ? ' | ' + extra : ''}`);
}

async function initial_process(data, user, ip, id_reintento, io, socket) {
    let historialId;
    let startTime = Date.now();

    const ad = user ? user : false;
    let userId = '';

    if (ad) {
        userId = await pool.query('SELECT idPersona FROM persona WHERE ad = ?', [ad]);
        userId = userId[0].idPersona;
    } else {
        userId = await pool.query('SELECT idPersona FROM persona WHERE ad = "system"');
        userId = userId[0].idPersona;
        if (userId.length == 0) {
            let insertSystem = await pool.query('INSERT INTO persona (ad, idRol, activo) VALUES ("system", 2, 1)');
            userId = insertSystem.insertId;
        }
    }

    try {
        let queryFth = '';
        let values = [];

        if (id_reintento) {
            queryFth = `
        UPDATE historial_respuesta_pdf
        SET json_consultas = ?, tipo_solicitud = ?, fecha_inicio = ?, fecha_fin = ?, fecha_solicitud = ?,
            departamento = ?, cite = ?, cocite = ?, solicitante = ?, cargo_solicitante = ?,
            json_busqueda = ?, estado = ?, tiempo_solucion = ?
        WHERE id_historial_respuesta_pdf = ?
      `;

            values = [
                '',
                data.solicitud_type || 'desconocido',
                data.fechaIni,
                data.fechaFin,
                data.fecha,
                data.departamento,
                data.cite,
                data.cocite,
                data.solicitante,
                data.cargo_solicitante,
                JSON.stringify(data),
                'pendiente',
                calcularTiempo(startTime),
                id_reintento
            ];

            historialId = id_reintento;
            await pool.query(queryFth, values);
            console.log('🧩 Actualizando solicitud existente con ID:', historialId);
        } else {
            queryFth = `
        INSERT INTO historial_respuesta_pdf (
          json_consultas, tipo_solicitud, fecha_inicio, fecha_fin, fecha_solicitud,
          departamento, cite, cocite, solicitante, cargo_solicitante,
          json_busqueda, estado, tiempo_solucion, user_id, ip, user
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            values = [
                '',
                data.solicitud_type || 'desconocido',
                data.fechaIni,
                data.fechaFin,
                data.fecha,
                data.departamento,
                data.cite,
                data.cocite,
                data.solicitante,
                data.cargo_solicitante,
                JSON.stringify(data),
                'pendiente',
                calcularTiempo(startTime),
                userId,
                ip,
                ad
            ];

            const result = await pool.query(queryFth, values);
            historialId = result.insertId;
            console.log('🧩 Nueva solicitud con ID:', historialId);
        }

        socket.emit('server:historialId', historialId);

        console.log("Transformando datos...");
        const transformedData = transformarDatos(data);

        console.log(`📦 ${nowIso()} | historial=${historialId} | tasks=${transformedData.length} | ad=${ad}`);
        logLimiter('RRFF', `snapshot before enqueue | historial=${historialId}`);

        const procesos = transformedData.map(item => ({
            opcionSeleccionada: item.opcionSeleccionada,
            datos: item.datos,
            id: data.cite,
            estado: "inicial"
        }));

        await pool.query(
            `UPDATE historial_respuesta_pdf 
       SET json_consultas = ?, tiempo_solucion = ? 
       WHERE id_historial_respuesta_pdf = ?`,
            [JSON.stringify(procesos), calcularTiempo(startTime), historialId]
        );

        // ✅ importante: prealoca por tamaño para mantener orden
        let pdf_results = new Array(transformedData.length);

        // ✅ CONCURRENCIA CONTROLADA (GLOBAL) + LOGS DE COLA
        await Promise.all(
            transformedData.map((element, i) =>
                rrffLimiter.run(async () => {
                    const stIn = rrffLimiter.stats();
                    const id = shortid.generate();
                    const rfId = 'RF_' + id;

                    console.log(
                        `➡️ RRFF START | ${nowIso()} | historial=${historialId} | i=${i} | ${limiterLine('RRFF', stIn)} | rf=${rfId} | ad=${ad}`
                    );

                    try {
                        const nuevoReqBody = element;
                        const socketSimulado = { emit: function () { } };

                        // Marcamos procesando SOLO cuando entra al cupo
                        procesos[i].id = rfId;
                        procesos[i].estado = "procesando";

                        await pool.query(
                            `UPDATE historial_respuesta_pdf 
               SET json_consultas = ?, tiempo_solucion = ? 
               WHERE id_historial_respuesta_pdf = ?`,
                            [JSON.stringify(procesos), calcularTiempo(startTime), historialId]
                        );

                        // ✅ PESADO: limitado a 5
                        await controlRRFF(data, nuevoReqBody, userId, id, socketSimulado, io, ad, 'localhost');

                        procesos[i].estado = "finalizado";
                        await pool.query(
                            `UPDATE historial_respuesta_pdf 
               SET json_consultas = ?, tiempo_solucion = ? 
               WHERE id_historial_respuesta_pdf = ?`,
                            [JSON.stringify(procesos), calcularTiempo(startTime), historialId]
                        );

                        const estado_consulta = await pool.query(
                            'select * from historialconsulta where nombre = ?',
                            rfId
                        );
                        pdf_results[i] = estado_consulta[0];

                    } catch (e) {
                        console.error(`❌ RRFF ERROR | historial=${historialId} | i=${i} | rf=${rfId}`, e);
                        throw e;
                    } finally {
                        const stOut = rrffLimiter.stats();
                        console.log(
                            `⬅️ RRFF END   | ${nowIso()} | historial=${historialId} | i=${i} | ${limiterLine('RRFF', stOut)} | rf=${rfId} | ad=${ad}`
                        );
                    }
                })
            )
        );

        // HTML del PDF (normal)
        let html = await results_convert_html(pdf_results, data);
        let id_pdf = await pool.query('select id from documents where name = ?;', [data.solicitud_type]);

        // ✅ PDF limitado (recomendado 1) + LOGS
        const pdfIn = pdfLimiter.stats();
        console.log(
            `➡️ PDF START | ${nowIso()} | historial=${historialId} | ${limiterLine('PDF', pdfIn)} | docId=${id_pdf?.[0]?.id}`
        );

        let updatedPdf;
        try {
            updatedPdf = await pdfLimiter.run(async () => {
                return await updatePdfWithResults(id_pdf[0].id, historialId, html);
            });
        } finally {
            const pdfOut = pdfLimiter.stats();
            console.log(
                `⬅️ PDF END   | ${nowIso()} | historial=${historialId} | ${limiterLine('PDF', pdfOut)} | result=${updatedPdf === true ? 'OK' : 'ERR'}`
            );
        }

        if (updatedPdf === true) {
            await pool.query(
                `UPDATE historial_respuesta_pdf 
         SET estado = ?, tiempo_solucion = ? 
         WHERE id_historial_respuesta_pdf = ?`,
                ['finalizado', calcularTiempo(startTime), historialId]
            );
            console.log(`✅ DONE | ${nowIso()} | historial=${historialId}`);
        } else {
            let json_update = await pool.query(
                'select json_busqueda from historial_respuesta_pdf where id_historial_respuesta_pdf = ?',
                historialId
            );
            let json_busc = JSON.parse(json_update[0].json_busqueda);
            json_busc.error = '❌ Error al generar el PDF: ' + updatedPdf;

            await pool.query(
                `UPDATE historial_respuesta_pdf
         SET estado = ?, tiempo_solucion = ?, json_busqueda = ?
         WHERE id_historial_respuesta_pdf = ?`,
                ['error', calcularTiempo(startTime), JSON.stringify(json_busc), historialId]
            );

            console.log(`🧨 PDF ERROR | ${nowIso()} | historial=${historialId}`);
        }
    } catch (error) {
        console.error("❌ Error procesando los datos:", error);
    }

    io.emit('server:1historialId_' + historialId);
}

async function solicitud_ITC(json, idPersona, ip, id_reintento, io, socket) {
    console.log('solicitud ITC', json);
    json.opcionesSeleccionadas = json.opcionesSeleccionadas || [];

    let nuevoReqBody = transformarDatos(json);
    console.log('solicitud ITC transformada', nuevoReqBody);

    if (nuevoReqBody.length === 0) {
        io.emit('server:solicitudRRFFRELOAD');
        return;
    }

    let id = shortid.generate();
    let ad = await pool.query('select ad from persona where idPersona = ' + idPersona);
    ad = ad[0].ad;

    const rfId = 'RF_' + id;

    // ✅ también limitado a 5 global + LOGS
    await rrffLimiter.run(async () => {
        const stIn = rrffLimiter.stats();
        console.log(`➡️ RRFF START (ITC) | ${nowIso()} | ${limiterLine('RRFF', stIn)} | rf=${rfId} | ad=${ad}`);
        try {
            await controlRRFF(json, nuevoReqBody[0], idPersona, id, socket, io, ad, ip);
        } finally {
            const stOut = rrffLimiter.stats();
            console.log(`⬅️ RRFF END   (ITC) | ${nowIso()} | ${limiterLine('RRFF', stOut)} | rf=${rfId} | ad=${ad}`);
        }
    });

    io.emit('user:grafica', ad);
}

function calcularTiempo(startTime) {
    let elapsedTime = Math.floor((Date.now() - startTime) / 1000);
    let horas = Math.floor(elapsedTime / 3600);
    let minutos = Math.floor((elapsedTime % 3600) / 60);
    let segundos = elapsedTime % 60;

    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

function transformarDatos(objeto) {
    const resultado = [];
    const grupos = {};

    Object.keys(objeto).forEach(key => {
        if (key.startsWith("parametro_")) {
            const [, tipo] = key.split("_");
            if (!grupos[tipo]) grupos[tipo] = [];
            grupos[tipo].push(objeto[key]);
        }
    });

    const opcionesIDs = objeto.opcionesIDSeleccionadas || [];
    const contiene = (clave) => opcionesIDs.includes(clave);

    const titular = ["NOM", "DIR", "REF"].filter(contiene).join("+");
    const imei = contiene("S") ? "S" : "";
    const opciones = ["LLA", "SMS", "CEL", "IMEI"].filter(contiene).join("+");
    const refTitulares = contiene("NOM_VIVA") ? "NOM" : "";
    const recargas = contiene("RECARGAS") ? "RECARGAS" : "";
    const datosGSM = contiene("DATOS") ? "DATOS" : "";
    const cel_datos = contiene("CEL_DATOS") ? "CEL_DATOS" : "";

    Object.entries(grupos).forEach(([tipo, valores]) => {
        resultado.push({
            opcionSeleccionada: tipo,
            id: '',
            datos: valores.join(","),
            fechaIni: objeto.fechaIni.replace(/-/g, ''),
            fechaFin: objeto.fechaFin.replace(/-/g, ''),
            titular,
            imei,
            opciones,
            refTitulares,
            recargas,
            datosGSM,
            cel_datos,
        });
    });

    return resultado;
}

module.exports = { initial_process, solicitud_ITC };
