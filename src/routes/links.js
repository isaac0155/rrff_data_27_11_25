const helpers = require('../lib/helpers');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const express = require('express');
const router = express.Router();
const pool = require('../database');
const { isLoggedIn } = require('../lib/auth')
const { isAdmin } = require('../lib/auth')
const { convertirFecha } = require('./funciones/format');
const upload = require('../lib/storage')
const { restoreDatabase, backupDatabase } = require('../lib/config/backupMySQL');
const resultadoOdeco = require('./funciones/llamadasOdeco');
const { buscarPorNombre, verificarTelefono, buscarPorCI, buscarPorIMEI } = require('./funciones/verificarODB');
const puppeteer = require('puppeteer');
const os = require('os');
const { exec } = require('child_process');
const {rrffLimiter, pdfLimiter} = require('../lib/limiter');


let ret = (io, initial_process, solicitud_ITC) => {
    io.on("connection", (socket) => {

        socket.on('cliente:enviarData', async (data, user, ip, id_reintento) => {
            try {
                await initial_process(data, user, ip, id_reintento, io, socket);
            } catch (e) {
                console.error("❌ initial_process failed:", e);
            }
        });
        socket.on('client:backup', async () => {
            await backupDatabase(false);
            socket.emit('server:backupdone');
        });
        socket.on('cliente:match_error', async (id_historial_respuesta_pdf) => {
            await pool.query('UPDATE historial_respuesta_pdf SET estado = "error" WHERE id_historial_respuesta_pdf = ?', [id_historial_respuesta_pdf]);
            let consultas = await pool.query('select json_consultas from historial_respuesta_pdf where id_historial_respuesta_pdf = ?', [id_historial_respuesta_pdf])
            consultas = JSON.parse(consultas[0].json_consultas)
            consultas.forEach(async (consulta, index) => {
                consulta.estado = 'error'
                await pool.query('update historialconsulta set estado_proceso = "error" where nombre = ?', [consulta.id])
            })  
            socket.emit('server:1historialId_' + id_historial_respuesta_pdf);
        });
        socket.on('cliente:delete_process', async (id_historial_respuesta_pdf) => {
            await pool.query('DELETE FROM historial_respuesta_pdf WHERE id_historial_respuesta_pdf = ?', [id_historial_respuesta_pdf]);
            socket.emit('server:1historialId_' + id_historial_respuesta_pdf);
        });
        socket.on('resetCookies', async () => {

            //eliminar cookies de la carpeta tmp/cookies
            await pool.query('TRUNCATE TABLE sessions;')    
            //server:initialice_server luego de 500 ms
            io.emit('server:initialice_server', true);
            setTimeout(() => {
            }, 500);
        });
        socket.on('cliente:verificarData', async ({ tipo, valor, id }) => {
            try {
                let resultado;

                switch (tipo) {
                    case 'nombre':
                        resultado = await buscarPorNombre(valor);
                        break;

                    case 'ci':
                        resultado = await buscarPorCI(valor);
                        break;

                    case 'telefono':
                        resultado = await verificarTelefono(valor);
                        break;

                    case 'imei':
                        resultado = await buscarPorIMEI(valor)
                        break;

                    default:
                        resultado = { error: "❌ Tipo de búsqueda inválido." };
                }

                // 📌 Enviar respuesta al frontend con el `id` del input
                //console.log({ tipo, id, resultado })
                socket.emit('server:verificarData', { tipo, id, resultado });

            } catch (error) {
                console.error('❌ Error en la verificación:', error);
                socket.emit('server:verificarData', { tipo, id, error: "❌ Ocurrió un error al procesar la solicitud." });
            }
        });

        socket.on('cliente:verifUser', async (user) => {
            let existe = await pool.query('select COUNT(a.ad) as user from persona a where a.ad = ?', user)
            existe[0].user == 0 ? socket.emit('server:usuarioLibre') : socket.emit('server:usuarioUsado');
        });
        socket.on('cliente:verifRol', async (rol) => {
            let existe = await pool.query('select COUNT(a.idRol) as idRol from rol a where a.nombreRol = ?', rol);
            if (existe[0].idRol == 0) {
                socket.emit('server:rolLibre');
            } else {
                socket.emit('server:rolUsado')
            }
        });
        socket.on('cliente:registrarRol', async (id, rol, fecha) => {
            await pool.query('insert into rol set ?', { nombreRol: rol });
            let resul = await pool.query('select rol.nombreRol from rol where rol.nombreRol = ?', rol);
            await pool.query("insert into historialCambios set accion= 'Crear', cambio = 'Se crea el rol " + rol + "', idPersona=" + id + ", fecha='" + fecha + "';")
            let nits = await pool.query('SELECT * FROM rol ORDER BY idRol DESC');
            socket.emit('server:rolRegistrado', resul[0].nombreRol, nits);
        });
        socket.on('cliente:eliminarRol', async (id, rol, fecha) => {
            let persona = await pool.query('select count(*) per from persona where idRol=?', rol)
            if (persona[0].per > 0) {
                socket.emit('server:rolDependiente');
            } else {
                let oldRol = await pool.query('select nombreRol from rol where idRol=' + rol)
                await pool.query('DELETE FROM rol WHERE idRol = ?', rol)
                const nits = await pool.query('SELECT * FROM rol ORDER BY idRol DESC');
                await pool.query("insert into historialCambios set accion= 'Eliminar', cambio = 'Se elimina el rol " + oldRol[0].nombreRol + "', idPersona=" + id + ", fecha='" + fecha + "';")
                socket.emit('server:rolRegistrado', null, nits);
            }
        });
        socket.on('cliente:solicitudRRFF', async (json, idPersona, ip, id_reintento) => {
            await solicitud_ITC(json, idPersona, ip, id_reintento, io, socket);
        });
        socket.on('cleinte:newDetalleLlamadas', async (json) => {
            let datos = json

            if (datos && datos.ticket && datos.telefono && datos.fechaIni && datos.fechaFin && datos.ofuscado && datos.idPersona && datos.ip) {
                let ofuscado = datos.ofuscado
                let ofus = datos.ofuscado == '1' ? 'OFUSCADO' : 'COMPLETO'
                let insert = {
                    ticket: datos.ticket,
                    telefono: datos.telefono,
                    fechaIni: datos.fechaIni,
                    fechaFin: datos.fechaFin,
                    idPersona: datos.idPersona,
                    ip: datos.ip,
                    ofuscado
                }
                //console.log(insert, ofus)
                let peticionescc = await pool.query('insert into peticionescc set ?', [insert])
                socket.emit('server:buscandodetallellamadas', peticionescc.insertId)
                let respuesta = await resultadoOdeco(peticionescc.insertId, insert.fechaIni, insert.fechaFin, [insert.telefono], io, ofus, json.ad, ofuscado)
                //console.log(respuesta)
                await pool.query('update peticionescc set resultado = ? where idPeticionescc = ?', [JSON.stringify(respuesta), peticionescc.insertId])
                io.emit('server:recargardetalledellamadas'+peticionescc.insertId)
                //res.redirect('/links/detallellamadas/resultado/' + peticionescc.insertId)
            } else {
                
            }
        });
    });


    router.get('/limiter-metrics', (req, res) => {
        const rrff = rrffLimiter.stats(); // { max, running, queued }
        const pdf = pdfLimiter.stats();  // { max, running, queued }

        const QUEUE_BAR_MAX = Number(process.env.RRFF_QUEUE_BAR_MAX || 50); // tope visual (solo UI)

        const rrff_running_pct = rrff.max > 0 ? Math.round((rrff.running / rrff.max) * 100) : 0;
        const rrff_queue_pct = QUEUE_BAR_MAX > 0 ? Math.min(100, Math.round((rrff.queued / QUEUE_BAR_MAX) * 100)) : 0;

        res.json({
            ok: true,
            ts: new Date().toISOString(),
            rrff: {
                ...rrff,
                running_pct: rrff_running_pct,
                queued_pct: rrff_queue_pct,
                queue_bar_max: QUEUE_BAR_MAX,
                backlog_total: rrff.running + rrff.queued
            },
            pdf
        });
    });


    router.get('/status', async (req, res) => {
        try {
            const memTotal = os.totalmem();
            const memFree = os.freemem();
            const memUsed = memTotal - memFree;

            const toMB = (b) => Math.round((b / 1024 / 1024) * 100) / 100;
            const toGB = (b) => Math.round((b / 1024 / 1024 / 1024) * 100) / 100;

            const cpuCount = os.cpus().length;

            const payload = {
                ok: true,
                timestamp: new Date().toISOString(),

                server: {
                    hostname: os.hostname(),
                    platform: `${os.platform()} ${os.release()}`,
                    arch: os.arch(),
                    uptime_sec: Math.round(os.uptime()),
                    loadavg_1_5_15: os.loadavg(),
                },

                process: {
                    pid: process.pid,
                    node: process.version,
                    uptime_sec: Math.round(process.uptime()),
                },

                cpu: { cores: cpuCount },

                memory: {
                    total_mb: toMB(memTotal),
                    used_mb: toMB(memUsed),
                    free_mb: toMB(memFree),
                    used_pct: Math.round((memUsed / memTotal) * 10000) / 100,
                }
            };

            // ===== KPI BBDD (pendientes/errores) =====
            // Timeout simple para que /status no se "pegue" por MySQL
            const withTimeout = (p, ms = 700) =>
                Promise.race([
                    p,
                    new Promise((_, rej) => setTimeout(() => rej(new Error(`DB timeout ${ms}ms`)), ms))
                ]);

            try {
                const [rowErr, rowPend, , rowProcessRunning] = await Promise.all([
                    withTimeout(pool.query(`SELECT COUNT(*) AS error FROM historial_respuesta_pdf WHERE estado = "error"`)),
                    withTimeout(pool.query(`SELECT COUNT(*) AS pendiente FROM historial_respuesta_pdf WHERE estado = "pendiente"`)),
                    withTimeout(pool.query(`SELECT COUNT(*) AS running FROM historialconsulta WHERE estado_proceso = "Running"`)),
                ]);

                // Si tu pool.query devuelve rows directo:
                const errCount = rowErr?.[0]?.error ?? 0;
                const pendCount = rowPend?.[0]?.pendiente ?? 0;

                payload.app = {
                    solicitudes_pendientes: Number(pendCount),
                    solicitudes_en_errores: Number(errCount),
                    procesos_consulta_running: Number(rowProcessRunning?.[0]?.running ?? 0),
                };
                payload.limiter = {
                    rrff: {
                        ...rrffLimiter.stats(),
                        note: "running = en proceso, queued = esperando cupo"
                    },
                    pdf: {
                        ...pdfLimiter.stats(),
                        note: "pdf suele ir max=1 para no reventar puppeteer"
                    }
                };

            } catch (e) {
                payload.app = {
                    db: { available: false, error: e.message }
                };
            }

            // ===== Disco =====
            if (os.platform() !== 'win32') {
                exec('df -k /', (err, stdout) => {
                    if (err) {
                        payload.disk = { available: false, error: err.message };
                        return res.json(payload);
                    }

                    const lines = stdout.trim().split('\n');
                    const parts = lines[1].split(/\s+/);

                    const totalKB = parseInt(parts[1], 10);
                    const usedKB = parseInt(parts[2], 10);
                    const availKB = parseInt(parts[3], 10);

                    payload.disk = {
                        mount: parts[5] || '/',
                        total_gb: Math.round((totalKB / 1024 / 1024) * 100) / 100,
                        used_gb: Math.round((usedKB / 1024 / 1024) * 100) / 100,
                        free_gb: Math.round((availKB / 1024 / 1024) * 100) / 100,
                        used_pct: parts[4],
                        available: true
                    };

                    return res.json(payload);
                });

            } else {
                try {
                    const root = path.parse(process.cwd()).root;
                    const st = await fs.promises.statfs(root);

                    const total = st.bsize * st.blocks;
                    const free = st.bsize * st.bavail;
                    const used = total - free;

                    payload.disk = {
                        available: true,
                        drive: root.replace(/\\$/, ''),
                        total_gb: toGB(total),
                        used_gb: toGB(used),
                        free_gb: toGB(free),
                        used_pct: total > 0 ? Math.round((used / total) * 10000) / 100 : 0
                    };

                    return res.json(payload);
                } catch (err) {
                    payload.disk = { available: false, error: err.message };
                    return res.json(payload);
                }
            }

        } catch (error) {
            console.error("❌ Error en /status:", error.message);
            res.status(500).json({ ok: false, error: "Error obteniendo status del server" });
        }
    });

    router.get('/download-pdf/system/:id/:cite', isLoggedIn, async (req, res) => {
        try {
            const rows = await pool.query("SELECT pdf_file FROM historial_respuesta_pdf WHERE id_historial_respuesta_pdf = ?", [req.params.id]);

            if (!rows.length || !rows[0].pdf_file) {
                console.error("PDF no encontrado en la base de datos.");
                return res.status(404).send('PDF no encontrado');
            }

            //console.log(`Descargando PDF para el documento ID: ${req.params.id}`);

            res.setHeader('Content-Disposition', 'attachment; filename="'+req.params.cite+'.pdf"');
            res.setHeader('Content-Type', 'application/pdf');
            res.send(rows[0].pdf_file);
        } catch (error) {
            console.error("Error en descarga de PDF:", error);
            res.status(500).json({ error: error.message });
        }
    });
    router.get('/view-pdf/:id', isLoggedIn, async (req, res) => {
        try {
            const { id } = req.params;

            // 📌 Buscar el PDF en la base de datos
            const rows = await pool.query("SELECT pdf_file FROM historial_respuesta_pdf WHERE id_historial_respuesta_pdf = ?", [id]);

            if (!rows.length || !rows[0].pdf_file) {
                return res.status(404).send('PDF no encontrado');
            }

            // 📌 Configurar la respuesta HTTP para visualizar el PDF en el navegador
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="documento.pdf"');
            res.send(rows[0].pdf_file);

        } catch (error) {
            console.error("❌ Error al visualizar el PDF:", error.message);
            res.status(500).json({ error: "Error al recuperar el PDF" });
        }
    });

    router.post('/save-pdf', isLoggedIn, async (req, res) => {
        try {
            let { data } = req.body;
            if (typeof data !== 'string') {
                data = JSON.stringify(data);
            }

            // Insertar JSON en la base de datos
            const result = await pool.query("INSERT INTO documents (content) VALUES (?)", [data]);
            const documentId = result.insertId;

            // Generar el PDF
            const jsonData = JSON.parse(data);

            let htmlContent = `
        <html>
        <head>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    width: 612px;
                    height: 792px;
                    margin: 0;
                    padding: 20px;
                    position: relative;
                }
                .content {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }
                .text-box {
                    position: absolute;
                    white-space: pre-wrap;
                    text-align: left;
                    word-break: break-word;
                    overflow-wrap: break-word;
                    display: inline-block;
                }
                .image {
                    position: absolute;
                }
                /* Subrayado corregido */
                .underline {
                    display: inline;
                    border-bottom: 1px solid currentColor; /* Usa el color del texto */
                    padding-bottom: 2px; /* Ajusta para evitar espacio extra */
                }
            </style>
        </head>
        <body>
            <div class="content">`;

            jsonData.objects.forEach(obj => {
                if (obj.type === 'textbox') {
                    //console.log(obj);
                    htmlContent += `<div class="text-box" style="
                    position: absolute;
                    left: ${obj.left}px;
                    top: ${obj.top}px;
                    font-size: ${obj.fontSize}px;
                    color: ${obj.fill};
                    text-align: ${obj.textAlign};
                    font-family: ${obj.fontFamily || 'Arial'};
                    font-weight: ${obj.fontWeight === 'bold' ? 'bold' : 'normal'};
                    font-style: ${obj.fontStyle === 'italic' ? 'italic' : 'normal'};
                    width: ${obj.width}px;
                    max-width: ${obj.width}px;
                    ">
                    <span class="${obj.underline ? 'underline' : ''}">${obj.text.trim()}</span>
                </div>`;
                } else if (obj.type === 'image' && obj.src.startsWith('data:image')) {
                    htmlContent += `<img class="image" src="${obj.src}" style="
                    left: ${obj.left}px;
                    top: ${obj.top + 45}px;
                    width: ${obj.width * obj.scaleX}px;
                    height: ${obj.height * obj.scaleY}px;
                ">`;
                }
            });

            htmlContent += `</div></body></html>`;

            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.setViewport({ width: 612, height: 792 });
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            await page.evaluate(() => {
                document.querySelectorAll('.text-box').forEach(el => el.textContent = el.textContent.trim());
            });

            await page.evaluate(() => {
                return new Promise(resolve => setTimeout(resolve, 1000));
            });

            const pdfBuffer = await page.pdf({
                format: 'letter',
                printBackground: true,
                margin: { top: '0mm', right: '20mm', bottom: '20mm', left: '20mm' }
            });

            await browser.close();

            // Guardar el PDF en la base de datos
            await pool.query("UPDATE documents SET pdf_file = ? WHERE id = ?", [Buffer.from(pdfBuffer), documentId]);

            res.json({ message: 'Documento y PDF guardados', id: documentId });

        } catch (error) {
            console.error("Error al guardar el documento y generar el PDF:", error);
            res.status(500).json({ error: error.message });
        }
    });
    // 📌 Descargar el PDF desde la base de datos
    router.get('/download-pdf/:id', isLoggedIn, async (req, res) => {
        try {
            const rows = await pool.query("SELECT pdf_file FROM documents WHERE id = ?", [req.params.id]);

            if (!rows.length || !rows[0].pdf_file) {
                console.error("PDF no encontrado en la base de datos.");
                return res.status(404).send('PDF no encontrado');
            }

            //console.log(`Descargando PDF para el documento ID: ${req.params.id}`);

            res.setHeader('Content-Disposition', 'attachment; filename="documento.pdf"');
            res.setHeader('Content-Type', 'application/pdf');
            res.send(rows[0].pdf_file);
        } catch (error) {
            console.error("Error en descarga de PDF:", error);
            res.status(500).json({ error: error.message });
        }
    });
    // 📌 Recuperar el contenido del PDF desde la base de datos para edición
    router.get('/generate-pdf/:id', isLoggedIn, async (req, res) => {
        try {
            // Obtener el contenido JSON guardado en la base de datos
            const rows = await pool.query("SELECT content FROM documents WHERE id = ?", [req.params.id]);
            //console.log(rows.length)

            if (!rows.length || !rows[0].content) {
                console.error("Contenido no encontrado en la base de datos.");
                return res.status(404).json({ error: 'Contenido no encontrado' });
            }

            //console.log(`Recuperando contenido para edición del documento ID: ${req.params.id}`);

            // Enviar el JSON al frontend para reconstrucción en el editor
            res.json({ content: JSON.parse(rows[0].content) });

        } catch (error) {
            console.error("Error al recuperar contenido del PDF:", error);
            res.status(500).json({ error: error.message });
        }
    });
    router.post('/save-edit-pdf/:id', isLoggedIn, async (req, res) => {
        try {
            let { data } = req.body;
            let { id } = req.params;

            if (typeof data !== 'string') {
                data = JSON.stringify(data);
            }

            // 📌 Actualizar JSON en la base de datos
            await pool.query("UPDATE documents SET content = ? WHERE id = ?", [data, id]);

            // 📌 Generar el PDF desde el JSON actualizado
            const jsonData = JSON.parse(data);

            let htmlContent = `
        <html>
        <head>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    width: 612px;
                    height: 792px;
                    margin: 0;
                    padding: 20px;
                    position: relative;
                }
                .content {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }
                .text-box {
                    position: absolute;
                    white-space: pre-wrap;
                    text-align: left;
                    word-break: break-word;
                    overflow-wrap: break-word;
                    display: inline-block;
                }
                .image {
                    position: absolute;
                }
                .underline {
                    display: inline;
                    border-bottom: 1px solid currentColor;
                    padding-bottom: 2px;
                }
            </style>
        </head>
        <body>
            <div class="content">`;

            jsonData.objects.forEach(obj => {
                if (obj.type === 'textbox') {
                    htmlContent += `<div class="text-box" style="
                    position: absolute;
                    left: ${obj.left}px;
                    top: ${obj.top}px;
                    font-size: ${obj.fontSize}px;
                    color: ${obj.fill};
                    text-align: ${obj.textAlign};
                    font-family: ${obj.fontFamily || 'Arial'};
                    font-weight: ${obj.fontWeight === 'bold' ? 'bold' : 'normal'};
                    font-style: ${obj.fontStyle === 'italic' ? 'italic' : 'normal'};
                    width: ${obj.width}px;
                    max-width: ${obj.width}px;
                    ">
                    <span class="${obj.underline ? 'underline' : ''}">${obj.text.trim()}</span>
                </div>`;
                } else if (obj.type === 'image' && obj.src.startsWith('data:image')) {
                    htmlContent += `<img class="image" src="${obj.src}" style="
                    left: ${obj.left}px;
                    top: ${obj.top + 45}px;
                    width: ${obj.width * obj.scaleX}px;
                    height: ${obj.height * obj.scaleY}px;
                ">`;
                }
            });

            htmlContent += `</div></body></html>`;

            // 📌 Generar el PDF con Puppeteer
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.setViewport({ width: 612, height: 792 });
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            await page.evaluate(() => {
                document.querySelectorAll('.text-box').forEach(el => el.textContent = el.textContent.trim());
            });

            await page.evaluate(() => {
                return new Promise(resolve => setTimeout(resolve, 1000));
            });

            const pdfBuffer = await page.pdf({
                format: 'letter',
                printBackground: true,
                margin: { top: '0mm', right: '20mm', bottom: '20mm', left: '20mm' }
            });

            await browser.close();

            // 📌 Verificar el buffer antes de guardarlo
            //console.log("Tipo de pdfBuffer:", typeof pdfBuffer);
            //console.log("¿Es Buffer?:", Buffer.isBuffer(pdfBuffer));
            //console.log("Tamaño del PDF en bytes:", pdfBuffer.length);

            // 📌 Guardar el PDF en la base de datos (CORREGIDO)
            await pool.query("UPDATE documents SET pdf_file = ? WHERE id = ?", [Buffer.from(pdfBuffer), id]);

            res.json({ message: 'Documento actualizado y PDF generado', id });

        } catch (error) {
            console.error("Error al actualizar el documento y generar el PDF:", error);
            res.status(500).json({ error: error.message });
        }
    });
    router.get('/manage/pdf', isAdmin, async (req, res) => {
        let pdf = await pool.query('select * from documents')
        res.render('links/manage-pdf', { pdf });
    });

    router.get("/descargar-archivos/:nombres/:main/:cite", async (req, res) => {
        try {
            const { nombres, main, cite } = req.params;
            // buscar en bbdd la tabla historial_respuesta_pdf con el id_historial_respuesta_pdf igual a main
            const historial = await pool.query('select tipo_solicitud, cite, creado from historial_respuesta_pdf where id_historial_respuesta_pdf = ?', main)
            console.log(main, historial)
            let nombreRar = cite + '.rar'
            /*if (historial.length > 0) {
                const fechaFormateada = new Date(historial[0].creado).toISOString().split('T')[0]; // YYYY-MM-DD
                nombreRar = `${historial[0].tipo_solicitud}_${historial[0].cite}_${fechaFormateada}.rar`;
            }*/


            const ids = nombres.split(","); // 🔹 Convertir los nombres separados por "," en un array
            const directoryPath = path.join(__dirname, "../public/img/imgenCliente/");
            const outputFilePath = path.join(__dirname, "archivos_adjuntos.rar");

            const output = fs.createWriteStream(outputFilePath);
            const archive = archiver("zip"); // 🔹 Cambiar a "rar" si usas una herramienta compatible con RAR

            // Escuchar eventos de error
            archive.on("error", (err) => {
                throw err;
            });

            archive.pipe(output);

            // 🔹 Buscar archivos que empiecen con cualquier ID recibido en la solicitud
            fs.readdir(directoryPath, (err, files) => {
                if (err) {
                    console.log("❌ Error al leer el directorio:", err);
                    return res.status(500).send("Error al leer el directorio.");
                }

                let archivosAgregados = 0;

                files.forEach((file) => {
                    // Si el archivo comienza con alguno de los IDs
                    if (ids.some(id => file.startsWith(id))) {
                        const filePath = path.join(directoryPath, file);
                        archive.append(fs.createReadStream(filePath), { name: file });
                        archivosAgregados++;
                    }
                });

                if (archivosAgregados === 0) {
                    return res.status(404).send("No se encontraron archivos para los IDs proporcionados.");
                }

                archive.finalize();
            });

            // Enviar el archivo para descarga
            res.attachment(await nombreRar);
            archive.pipe(res);

            // Eliminar el archivo una vez enviado
            res.on("finish", () => {
                fs.unlink(outputFilePath, (err) => {
                    if (err) console.error("❌ Error al eliminar el archivo:", err);
                });
            });

        } catch (error) {
            console.error("❌ Error en la generación del archivo:", error);
            res.status(500).send("Error en la generación del archivo.");
        }
    });


    /** */
    router.get('/profile/modify', isLoggedIn, async (req, res) => {
        res.render('links/index');
    });
    router.get('/panel', isAdmin, async (req, res) => {
        res.render('panel/index');
    });
    router.get('/profile/admin/modify', isAdmin, async (req, res) => {
        let rol = await pool.query('select * from rol;')
        res.render('panel/profile', { rol });
    });
    router.get('/admin/profile/:idPersona', isAdmin, async (req, res) => {
        const { idPersona } = req.params;
        let persona = await pool.query('select p.*, r.nombreRol as rol from persona p, rol r where p.idRol=r.idRol and p.idPersona=?;', idPersona)
        let rol = await pool.query('select * from rol;')
        res.render('panel/profileUser', { persona: persona[0], rol });
    });
    router.post('/admin/profile/:idPersona', isAdmin, async (req, res) => {
        const { idPersona } = req.params;
        let { username, rol, fecha } = req.body;
        let newData = {
            ad: username,
            idRol: rol,
            activo: req.body.activo ? true : false
        }
        await pool.query('update persona set ? where idPersona =' + idPersona, [newData])
        await pool.query("insert into historialCambios set accion= 'Modificar', cambio = 'Se modifica los datos del usuario " + newData.ad + "', idPersona=" + req.user.idPersona + ", fecha='" + fecha + "';")
        req.flash('success', 'Datos del Usuario modificados')
        res.redirect('/links/admin/profile/' + idPersona);
    });
    router.get('/admin/profile/reset/:idPersona/:fecha', isAdmin, async (req, res) => {
        const { idPersona, fecha } = req.params;
        let persona = await pool.query('select * from persona where idPersona = ?;', idPersona)
        persona = persona[0].ad;
        let passwordNew = await helpers.encryptPassword(persona);
        //console.log(passwordNew, idPersona)
        await pool.query("update persona set password='" + passwordNew + "' where idPersona=" + idPersona)
        await pool.query("insert into historialCambios set accion= 'Modificar', cambio = 'Se hace reset a la contraseña de " + persona + "', idPersona=" + req.user.idPersona + ", fecha='" + fecha + "';")
        req.flash('warning', 'La contraseña nueva es Igual que el AD')
        res.redirect('/links/admin/profile/' + idPersona);
    });
    router.get('/panel/roles', isAdmin, async (req, res) => {
        let rol = await pool.query('select * from rol;')
        res.render('panel/gestionarRoles', { rol });
    });
    router.get('/panel/newuser', isAdmin, async (req, res) => {
        let tipo = await pool.query('select * from rol;')
        res.render('auth/signup', { tipo });
    });
    router.get('/panel/verusuarios', isAdmin, async (req, res) => {
        let persona = await pool.query('SELECT p.*, r.nombreRol AS rol, COUNT(h.idHistorialConsulta) AS rrff FROM persona p JOIN rol r ON p.idRol = r.idRol LEFT JOIN historialconsulta h ON h.idPersona = p.idPersona GROUP BY p.idPersona, r.nombreRol order by p.ad asc')
        res.render('panel/verusuarios', { persona });
    });
    router.post('/panel/newuser', isAdmin, async (req, res) => {
        let { username, rol, fecha } = req.body;
        let newUser = {
            ad: username,
            idRol: rol,
            activo: req.body.activo ? true : false
        };
        newUser.password = await helpers.encryptPassword(username);
        await pool.query('INSERT INTO persona SET ?', [newUser]);
        await pool.query("insert into historialCambios set accion= 'Crear', cambio = 'Se crea el usuario " + username + "', idPersona=" + req.user.idPersona + ", fecha='" + fecha + "';")
        req.flash('success', 'usuario ' + req.body.username + ', registrado exitosamente')
        res.redirect('/links/panel/newuser');
    });
    router.post('/profile/admin/modify', isAdmin, async (req, res) => {
        let camb = req.body
        camb.activo = camb.activo ? true : false
        pool.query('update persona set ? where idPersona = ' + req.user.idPersona, { ad: camb.username, idRol: camb.rol, activo: camb.activo })
        await pool.query("insert into historialCambios set accion= 'Modificar', cambio = 'Modifica sus propios datos " + req.user.ad + "', idPersona=" + req.user.idPersona + ", fecha='" + camb.fecha + "';")
        req.flash('success', 'Cambios realizados correctamente')
        res.redirect('/links/profile/admin/modify');
    });
    router.post('/profile/modify', isLoggedIn, async (req, res) => {
        const validPassword = await helpers.matchPassword(req.body.passwordOld, req.user.password);
        if (validPassword) {
            let passwordNew = await helpers.encryptPassword(req.body.password);
            await pool.query("update persona set password = ? where idPersona=" + req.user.idPersona, [passwordNew]);
            await pool.query("insert into historialCambios set accion= 'Modificar', cambio = 'Modifica su propia Contraseña " + req.user.ad + "', idPersona=" + req.user.idPersona + ", fecha='" + req.body.fecha + "';")
            req.flash('success', 'Contraseña Actualizada Correctamente')
        } else {
            req.flash('danger', 'Contraseña Actual Incorrecta')
        }
        res.redirect('/links/profile/modify');
    });
    router.get('/requerimientoFiscal/resultado/:nombre', isLoggedIn, async (req, res) => {
        const { nombre } = req.params;
        let resp = await pool.query("select a.*, b.ad from historialconsulta a, persona b where a.nombre = ? and a.idPersona = b.idPersona", nombre)
        try {
            resp[0].fecha = convertirFecha(resp[0].fecha);
            //console.log(resp[0])
            if(resp[0].estado_proceso != 'Failed'){
                res.render('links/resultado', { res: resp[0] });
            }else{
                let ip = req.ip;
                res.render('links/resultadoFailed', { res: resp[0], dataip:ip });
            }
        } catch (error) {
            res.redirect('/no existe')
        }
        //res.render('links/resultado');
    });
    router.get('/requerimientoFiscal/respuesta/:id', isLoggedIn, async (req, res) => {
        try {
            const { id } = req.params;
            let [resp] = await pool.query(
                "SELECT * FROM historial_respuesta_pdf WHERE id_historial_respuesta_pdf = ?;",
                [id]
            );
            let [tipo_solicitud] = await pool.query(
                "SELECT name_show FROM documents WHERE name = ?;",
                [resp.tipo_solicitud]
            );

            if (resp.length == 0) {
                return res.redirect('/no-existe');
            }
            resp.json_consultas = JSON.parse(resp.json_consultas);
            resp.json_busqueda = JSON.parse(resp.json_busqueda);
            resp.tipo_solicitud = tipo_solicitud.name_show;

            let consultas = []
            if (resp.estado == "finalizado"){

                for (let i = 0; i < resp.json_consultas.length; i++) {
                    const element = resp.json_consultas[i];
                    let datos = await pool.query('select archivo from historialconsulta where nombre = ?;', [element.id])
                    consultas.push({
                        id: element.id,
                        archivos: datos[0].archivo
                    })
                }
            }

            let ip = req.ip;

            if (!ip || typeof ip !== 'string') {
                ip = 'Desconocido'; // o algún fallback seguro
            } else if (ip === '::1') {
                ip = 'Ejecutado desde el Servidor Host';
            } else if (ip.startsWith("::ffff:")) {
                ip = ip.slice(7);
            }

            res.render('links/respuesta', { id, resp: Buffer.from(JSON.stringify(resp), 'utf8').toString('base64'), consultas: Buffer.from(JSON.stringify(consultas), 'utf8').toString('base64'), resp55: resp, ip });
        } catch (error) {
            console.error("❌ Error en la consulta:", error);
            return res.redirect('/no-existe');
            //res.status(500).json({ error: "Error en el servidor" });
        }
    });

    router.get('/download/:nombre', isLoggedIn, async (req, res) => {
        const { nombre } = req.params;
        const directoryPath = path.join(__dirname, '../public/img/imgenCliente/');
        const outputFilePath = path.join(__dirname, nombre + '.rar'); // Ruta completa al archivo .rar
        const output = fs.createWriteStream(outputFilePath);
        const archive = archiver('zip');

        // Escuchar eventos de archivado
        archive.on('error', (err) => {
            throw err;
        });

        // Empaquetar archivos en el archivo rar
        fs.readdir(directoryPath, (err, files) => {
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            }

            files.forEach((file) => {
                if (file.startsWith(nombre)) {
                    const filePath = path.join(directoryPath, file);
                    archive.append(fs.createReadStream(filePath), { name: file });
                }
            });
            archive.finalize();
        });
        res.attachment(nombre + '.rar');
        archive.pipe(res);
        archive.pipe(output);  // Esto guardará el archivo en el servidor
        res.on('finish', function () {
            fs.unlink(outputFilePath, (err) => {
                if (err)
                    console.error('Error al eliminar el archivo:', err)
            });
        });
    });
    router.get('/historial', isLoggedIn, async (req, res) => {
        let historial = await pool.query('select * from historialcambios where idPersona = ' + req.user.idPersona + ' order by idHistorialCambios desc')
        historial.forEach((element, index) => {
            //istorial[index].fecha = convertirFecha(element.fecha);
        })
        let historialReq = await pool.query(`
            SELECT a.*,
                CASE
                    WHEN c.nombreRol = 'Administrador' THEN 'Administrador'
                    ELSE NULL
                END AS nombreRol
            FROM historialconsulta a, persona b, rol c
            WHERE a.idPersona = ${req.user.idPersona}
                AND a.idPersona = b.idPersona
                AND b.idRol = c.idRol
            ORDER BY a.idHistorialConsulta DESC;
        `)
        historialReq.forEach((element, index) => {
            historialReq[index].fecha = convertirFecha(element.fecha);
        })
        let ad = req.user
        let cantidad = await pool.query('select count(idHistorialConsulta) cantidad from historialconsulta where idPersona = ' + req.user.idPersona)
        cantidad = cantidad[0]
        let cantidad1 = await pool.query('select count(idHistorialCambios) cantidad from historialcambios where idPersona = ' + req.user.idPersona)
        cantidad1 = cantidad1[0]
        res.render('links/historial', { historial, historialReq, ad, cantidad, cantidad1 });
    });
    router.get('/historial/solicitud', isLoggedIn, async (req, res) => {
        let historial = await pool.query(`
            SELECT 
                id_historial_respuesta_pdf,
                tipo_solicitud,
                user,
                cite,
                cocite,
                estado,
                tiempo_solucion,
                user_id,
                creado
            FROM historial_respuesta_pdf
            WHERE user_id = ${req.user.idPersona}
            AND creado >= NOW() - INTERVAL 30 DAY
            ORDER BY id_historial_respuesta_pdf DESC
        `);

        historial.forEach((element, index) => {
            historial[index].creado = element.creado.toLocaleString('es-ES');
        })
        res.render('links/historial_solicitud', { historial, ad: req.user.ad });
    });
    const moment = require('moment'); // Asegúrate de tener 'moment' instalado

    router.get('/panel/historial/solicitudes/system/:fini/:ffin', isLoggedIn, async (req, res) => {
        const { fini, ffin } = req.params;

        // Validación de formato de fecha
        if (!moment(fini, 'YYYY-MM-DD', true).isValid() || !moment(ffin, 'YYYY-MM-DD', true).isValid()) {
            return res.status(400).send("Fechas inválidas. Usa formato YYYY-MM-DD.");
        }

        try {
            const historial = await pool.query(`
            SELECT 
                id_historial_respuesta_pdf,
                tipo_solicitud,
                user,
                cite,
                cocite,
                estado,
                tiempo_solucion,
                creado
            FROM historial_respuesta_pdf
            WHERE DATE(creado) BETWEEN ? AND ?
            ORDER BY id_historial_respuesta_pdf DESC
        `, [fini, ffin]);

            historial.forEach((element, index) => {
                historial[index].creado = element.creado.toLocaleString('es-ES');
            });

            res.render('links/historial_solicitud_all', { historial, ad: req.user.ad });

        } catch (error) {
            console.error("Error al obtener historial:", error);
            res.status(500).send("Error interno del servidor");
        }
    });

    router.get('/panel/historial/sistem', isAdmin, async (req, res) => {
        //let historial = await pool.query('select * from historialcambios a, persona b where a.idPersona = b.idPersona order by a.idHistorialCambios desc limit 500')
        /*historial.forEach((element, index) => {
            historial[index].fecha = convertirFecha(element.fecha);
        })*/
        let historialReq = await pool.query(`SELECT a.*, b.ad,
        CASE
            WHEN c.nombreRol = 'Administrador' THEN 'Administrador'
            ELSE NULL
        END AS nombreRol
        FROM historialconsulta a, persona b, rol c
        WHERE a.idPersona = b.idPersona
            AND b.idRol = c.idRol
            ORDER BY a.idHistorialConsulta DESC limit 500;
        `)
        historialReq.forEach((element, index) => {
            historialReq[index].fecha = convertirFecha(element.fecha);
        })
        /*let cantidad = await pool.query('select count(idHistorialConsulta) cantidad from historialconsulta;')
        cantidad = cantidad[0]
        let cantidad1 = await pool.query('select count(idHistorialCambios) cantidad from historialcambios;')
        cantidad1 = cantidad1[0]*/
        let ad = req.user.ad
        res.render('panel/historial', { historialReq, ad });
    });
    router.get('/historial/:idPersona', isLoggedIn, async (req, res) => {
        const { idPersona } = req.params;
        let historial = await pool.query('select * from historialcambios where idPersona = ' + idPersona + ' order by idHistorialCambios desc')
        historial.forEach((element, index) => {
            historial[index].fecha = convertirFecha(element.fecha);
        })
        let historialReq = await pool.query(`
            SELECT a.*,
                CASE
                    WHEN c.nombreRol = 'Administrador' THEN 'Administrador'
                    ELSE NULL
                END AS nombreRol
            FROM historialconsulta a, persona b, rol c
            WHERE a.idPersona = ${idPersona}
                AND a.idPersona = b.idPersona
                AND b.idRol = c.idRol
            ORDER BY a.idHistorialConsulta DESC;
        `)
        historialReq.forEach((element, index) => {
            historialReq[index].fecha = convertirFecha(element.fecha);
        })
        let ad = await pool.query('select * from persona where idPersona = ' + idPersona)
        ad = ad[0]
        let cantidad = await pool.query('select count(idHistorialConsulta) cantidad from historialconsulta where idPersona = ' + idPersona)
        cantidad = cantidad[0]
        let cantidad1 = await pool.query('select count(idHistorialCambios) cantidad from historialcambios where idPersona = ' + idPersona)
        cantidad1 = cantidad1[0]
        ////console.log(ad)
        res.render('links/historial', { historial, historialReq, ad, cantidad, cantidad1 });
    });
    router.get('/requerimientoFiscal', isLoggedIn, async (req, res) => {
        let ip = req.ip 
        //console.log(ip)
        res.render('links/requerimientoFiscal', { dataip: ip });
    });
    router.get('/grafica/:queryString', isAdmin, async (req, res) => {
        let { queryString } = req.params
        let where = ''
        if (queryString != 'all') {
            const queryParams = queryString.split('&').reduce((acc, current) => {
                const [key, value] = current.split('=');
                acc[decodeURIComponent(key)] = decodeURIComponent(value);
                return acc;
            }, {});

            //console.log(queryParams);
            if (queryParams.idPersona > 0) {

                where = `where a.idPersona = ${queryParams.idPersona} and a.Fecha >= '${queryParams.fechaIni}' and  a.Fecha <= '${queryParams.fechaFin}'`
            }
            //console.log(where)
        }

        // Ejemplo de datos recibidos
        const datosRecibidos = await pool.query(`
            SELECT
                a.Fecha,
                b.TotalRRFF NumeroDeFilas,
                CONCAT('{', GROUP_CONCAT(CONCAT('"', a.ad, '":', a.PersonaCount)), '}') AS PersonasConConteo
            FROM (
                SELECT
                    DATE(h.fecha) AS Fecha,
                    h.idPersona,
                    p.ad,
                    COUNT(*) AS PersonaCount
                FROM
                    historialconsulta h
                JOIN persona p ON h.idPersona = p.idPersona
                GROUP BY
                    DATE(h.fecha), h.idPersona, p.ad
            ) a
            JOIN (
                SELECT
                    DATE(fecha) AS Fecha,
                    COUNT(*) AS TotalRRFF
                FROM
                    historialconsulta
                GROUP BY
                    DATE(fecha)
            ) b ON a.Fecha = b.Fecha ${where}
            GROUP BY
                a.Fecha, b.TotalRRFF
            ORDER BY
                a.Fecha;
        `)
        let datosCompletos = []
        let users = await pool.query('select * from persona')
        let fechas = await pool.query('SELECT MIN(fecha) AS inicio, MAX(fecha) AS fin FROM historialconsulta;')
        if (datosRecibidos.length > 0) {

            const datosAjustados = datosRecibidos.map(d => ({
                Fecha: d.Fecha.toISOString().split('T')[0],
                NumeroDeFilas: d.NumeroDeFilas,
                PersonasConConteo: d.PersonasConConteo
            }));
            // Encontrar fechas de inicio y fin
            const { fechaInicio, fechaFin } = encontrarFechasExtremas(datosAjustados);
            // Obtener datos completos
            datosCompletos = completarDatosFaltantes(datosAjustados, fechaInicio, fechaFin);
            //console.log(datosCompletos)
            //console.log(fechas, fechas[0].inicio.toISOString().split('T')[0], fechas[0].fin )
            res.render('links/grafica', { datos: datosCompletos, users, inicio: fechas[0].inicio.toISOString().split('T')[0], fin: fechas[0].fin.toISOString().split('T')[0] });
        } else {
            res.render('links/grafica', { datos: [], users, inicio: fechas[0].inicio.toISOString().split('T')[0], fin: fechas[0].fin.toISOString().split('T')[0] });

        }
    });
    router.get('/panel/sistema/restaurar', async (req, res) => {
        let directorio = path.join(__dirname, '..', '/lib/backup');
        let archivos
        try {
            archivos = fs.readdirSync(directorio);
        } catch (err) {
            console.error('Error al leer el directorio:', err);
        }
        let completo = []
        archivos.forEach((element) => {
            if (element != '.gitignore') {
                completo.push({ archivo: element.split('.sql.en')[0] })
            }
        })
        //console.log(completo)
        function convertirFecha(fecha) {
            let partes = fecha.split('-');
            return `${partes[2]}-${partes[1]}-${partes[0]}`;
        }

        // Ordenar por fecha más reciente a más antigua
        completo.sort((a, b) => {
            let fechaA = new Date(convertirFecha(a.archivo));
            let fechaB = new Date(convertirFecha(b.archivo));
            return fechaB - fechaA;
        });

        //console.log(completo);
        res.render('panel/backup', { completo })
    });
    router.post('/panel/sistema/restaurar', async (req, res) => {
        //await restoreDatabase(path.join(__dirname, '..', '/lib/backup/backup.sql.enc'))
        res.redirect('/links/panel/sistema/restaurar')
    });
    router.post('/profile/modify/img', upload.single('image'), isLoggedIn, async (req, res) => {
        if (req.file) {
            let foto = req.file.filename
            await pool.query('update persona set foto = "' + foto + '" where idPersona = ' + req.user.idPersona)
            req.flash('success', 'Foto de Perfil Modificado')
        }
        res.redirect('/links/profile/admin/modify')
    });
    router.post('/panel/backup', async (req, res) => {
        //console.log(req.body)
        await backupDatabase(true)
        await restoreDatabase(path.join(__dirname, '..', '/lib/backup/' + req.body.nombre + '.sql.enc'))
        req.flash('success', 'Base de Datos Restaurada a fecha ' + req.body.nombre)
        res.redirect('/')
    });
    router.get('/detallellamadas', isLoggedIn, async (req, res) => {
        let ip = req.ip;
        res.render('links/peticionesCallCenter', { ip })
    });
    router.get('/detallellamadas/resultado/:id', isLoggedIn, async (req, res) => {
        let id = req.params.id
        let resultado = await pool.query('select a.*, b.ad ad from peticionescc a, persona b where a.idPersona = b.idPersona and a.idPeticionescc = ?', id)
        resultado = resultado[0]
        if(resultado){
            res.render('links/ccResultado', { resultado })
        }else{
            res.render('vacio')
        }
    });
    router.get('/historialdetalledellamadas', isLoggedIn, async (req, res) => {
        let historial = await pool.query('select a.*, b.ad ad from peticionescc a, persona b where a.idPersona = b.idPersona and a.idPersona = ? order by a.idPeticionescc desc', [req.user.idPersona])
        res.render('links/historialdetalledellamadas', { historial })
    });
    router.get('/panel/historialdetallellamadas/sistem', isAdmin, async (req, res) => {
        let historial = await pool.query('select a.*, b.ad ad from peticionescc a, persona b where a.idPersona = b.idPersona order by a.idPeticionescc desc')
        res.render('panel/historialdetalledellamadas', { historial })
    });


    function encontrarFechasExtremas(datos) {
        let fechas = datos.map(item => new Date(item.Fecha));
        let fechaInicio = new Date(Math.min(...fechas));
        let fechaFin = new Date(Math.max(...fechas));
        return {
            fechaInicio: fechaInicio.toISOString().split('T')[0],
            fechaFin: fechaFin.toISOString().split('T')[0]
        };
    }
    function obtenerRangoFechas(fechaInicio, fechaFin) {
        let start = new Date(fechaInicio);
        let end = new Date(fechaFin);
        let listaFechas = [];

        while (start <= end) {
            listaFechas.push(new Date(start).toISOString().split('T')[0]);
            start.setDate(start.getDate() + 1);
        }

        return listaFechas;
    }

    function completarDatosFaltantes(datos, fechaInicio, fechaFin) {
        //console.log(datos);
        const rangoFechas = obtenerRangoFechas(fechaInicio, fechaFin);
        const datosCompletos = [];

        rangoFechas.forEach(fecha => {
            const datoExistente = datos.find(d => d.Fecha === fecha);
            if (datoExistente) {
                datosCompletos.push(datoExistente);
            } else {
                datosCompletos.push({ Fecha: fecha, NumeroDeFilas: 0, PersonasConConteo: null });
            }
        });

        return datosCompletos;
    }

    // Ruta para recibir el prompt, ticket y user
    router.post('/api/generate', async (req, res) => {
        res.json({ message: 'API is working' });
    });
    //pagina de prueba visual
    router.get('/solicitud/new', isLoggedIn, async (req, res) => {
        let ip = req.ip 
        //console.log(ip)
        let solicitud_type = await pool.query('select name, name_show from documents where status = 1;')
        res.render('links/solicitud_nueva', { dataip: ip, solicitud_type });
    });


    /** */
    return router
}

module.exports = ret