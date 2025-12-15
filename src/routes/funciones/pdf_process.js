// Objetivo: Funciones para procesar los resultados de búsqueda y convertirlos a HTML
// Objetivo: debe implementarse una funcion que reciba el id del pdf  de la tabla documents en bbdd y el contenido de la funcion results_convert_pdf como tambien el id de la tabla historial_respuesta_pdf, obtenga el pdf en cuestion y del pdf debe buscar el tecto exacto ´{{resultado}}´ independientemnete que haya antes o depues contenido creado
// se debe incluir el resultado de la funcioncion results_convert_html en el pdf en la posicion de ´{{resultado}}´ dinamicamente recorreindo el contenido original del pdf para que quepa el contenido generado por la funcion results_convert_html
// esa funcion nueva debe devolver el pdf modificado y guardarlos en la tabla actualizando historial_respuesta_pdf al id que pertenece en el campo
/**
 estructura de la tabla historial_respuesta_pdf
 create table historial_respuesta_pdf
(
    id_historial_respuesta_pdf bigint auto_increment
        primary key,
    json_consultas             longtext null,
    tipo_solicitud             text     null,
    fecha_inicio               date     null,
    fecha_fin                  date     null,
    fecha_solicitud            date     null,
    user                       text     null,
    departamento               text     null,
    cite                       text     null,
    cocite                     text     null,
    solicitante                text     null,
    cargo_solicitante          text     null,
    json_busqueda              longtext null,
    estado                     text     null,
    tiempo_solucion            time     null,
    ip                         text     null,
    user_id                    int      null,
    content                    longtext null,
    pdf_file                   longblob null
);


estructura de la tabla documents
create table documents
(
    id       int auto_increment
        primary key,
    content  longtext null,
    pdf_file longblob null,
    name     text     null
);

*/
const pool = require('../../database');
const puppeteer = require('puppeteer');
const pdfParse = require('pdf-parse');
const path = require('path');

async function updatePdfWithResults(pdfId, historialId, htmlContent) {
    try {
        // 📌 1. Obtener el JSON del PDF desde la base de datos
        const docRows = await pool.query("SELECT content FROM documents WHERE id = ?", [pdfId]);

        if (!docRows.length || !docRows[0].content) {
            throw new Error(`PDF con ID ${pdfId} no encontrado.`);
        }

        const pdfJson = JSON.parse(docRows[0].content);

        // 📌 2. Buscar el objeto de texto que contiene "{{resultado_busqueda}}"
        let found = false;

        const datos = await pool.query('select cite, cocite, fecha_solicitud, cargo_solicitante, solicitante, departamento, creado from historial_respuesta_pdf where id_historial_respuesta_pdf = ?', [historialId]);

        pdfJson.objects.forEach(obj => {
            
            if (obj.type === 'textbox') {
                obj.text = obj.text.replace("{{resultado_busqueda}}", htmlContent);
                obj.text = obj.text.replace("{{cite}}", datos[0].cite);
                obj.text = obj.text.replace("{{cocite}}", datos[0].cocite);
                obj.text = obj.text.replace("{{cargo_solicitante}}", datos[0].cargo_solicitante);
                obj.text = obj.text.replace("{{solicitante}}", datos[0].solicitante);
                obj.text = obj.text.replace("{{departamento}}", datos[0].departamento);

                const fecha = new Date(datos[0].creado);
                const dia = fecha.getDate();
                const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                const mes = meses[fecha.getMonth()];
                const año = fecha.getFullYear();

                obj.text = obj.text.replace("{{creado}}", `${dia} de ${mes} de ${año}`);


                const fecha2 = new Date(datos[0].fecha_solicitud);
                const dia2 = fecha2.getDate();
                const meses2 = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                const mes2 = meses2[fecha2.getMonth()];
                const año2 = fecha2.getFullYear();

                obj.text = obj.text.replace("{{fecha_solicitud}}", `fecha ${dia2} de ${mes2} de ${año2}`);


                found = true;
            }

            // 🔹 ELIMINAR ESPACIOS INICIALES Y EXCESIVOS EN TEXTOS
            if (obj.type === 'textbox') {
                obj.text = obj.text.replace(/^\s+/gm, ''); // Elimina espacios al inicio de cada línea
                obj.text = obj.text.replace(/\s{2,}/g, ' '); // Reemplaza múltiples espacios por uno solo
            }
        });

        if (!found) {
            throw new Error(`No se encontró la marca {{resultado_busqueda}} en el PDF.`);
        }

        // 📌 3. Generar el nuevo PDF con Puppeteer
        const browser = await puppeteer.launch({
		  executablePath: path.resolve(__dirname, '../../lib/chromium/chrome-win64/chrome.exe'),
		  headless: 'new',
		  args: ['--no-sandbox', '--disable-setuid-sandbox'] // Opcional pero recomendable
		});
        const page = await browser.newPage();
        await page.setViewport({ width: 612, height: 792 }); // Tamaño carta

        let html = `
        <html>
        <head>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    width: 612px;
                    height: auto;
                    margin: 0;
                    padding: 20px;
                    position: relative;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    page-break-inside: avoid;
                }

                td, th {
                    border: 1px solid black;
                    padding: 5px;
                    text-align: left;
                    font-size: 10px; /* 🔹 FORZADO A 12 🔹 */
                }
                .contenido_dinamico_respuesta_portal{
                    font-size: 12px; /* 🔹 FORZADO A 12 🔹 */
                }
                .content {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }
                .page {
                    width: 612px;
                    height: 792px;
                    position: relative;
                    padding: 20px;
                    box-sizing: border-box;
                    page-break-after: always;
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
                h3, h4 {
                    page-break-after: avoid;
                }
            </style>
        </head>
        <body>
            <div class="content">
                <div class="page">`;

        let currentHeight = 0; // Control de altura en la página
        const pageHeightLimit = 700; // Límite antes de crear nueva página

        pdfJson.objects.forEach(obj => {
            if (obj.type === 'textbox') {
                const estimatedHeight = 14 * 1.2 * (obj.text.split("\n").length || 1); // 🔹 Siempre calcula en tamaño 14 🔹

                // Si el contenido excede el límite, crear una nueva página
                if (currentHeight + estimatedHeight > pageHeightLimit) {
                    html += `</div><div class="page">`;
                    currentHeight = 80; // Reiniciar altura para la nueva página
                }

                html += `<div class="text-box" style="
                    position: absolute;
                    left: ${obj.left}px;
                    top: ${currentHeight}px;
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

                currentHeight += estimatedHeight + 10; // Ajuste para evitar superposición
            } else if (obj.type === 'image' && obj.src.startsWith('data:image')) {
                html += `<img class="image" src="${obj.src}" style="
                    left: ${obj.left}px;
                    top: ${obj.top + 45}px;
                    width: ${obj.width * obj.scaleX}px;
                    height: ${obj.height * obj.scaleY}px;
                ">`;
            }
        });

        html += `</div></div></body></html>`;

        await page.setContent(html, { waitUntil: 'networkidle0' });

        // 📌 🔹 Eliminar espacios solo en la primera línea de cada text-box 🔹
        await page.evaluate(() => {
            document.querySelectorAll('.text-box').forEach(el => {
                // Si el .text-box está dentro de .contenido_dinamico_respuesta_portal, no hacer nada
                if (!el.closest('.contenido_dinamico_respuesta_portal')) {
                    let firstChild = el.firstChild; // Obtener el primer nodo hijo
                    if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
                        firstChild.textContent = firstChild.textContent.trim(); // 🔹 Trim solo al PRIMER texto 🔹
                    }
                }
            });
        });

        const newPdfBuffer = await page.pdf({
            format: 'letter',
            printBackground: true,
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
        });


        await browser.close();

        // 📌 4. Guardar el nuevo PDF en historial_respuesta_pdf
        await pool.query("UPDATE historial_respuesta_pdf SET pdf_file = ? WHERE id_historial_respuesta_pdf = ?", [Buffer.from(newPdfBuffer), historialId]);

        console.log(`✅ PDF actualizado exitosamente y guardado en historial_respuesta_pdf con ID ${historialId}`);

    } catch (error) {
        console.error("❌ Error al actualizar el PDF:", error.message);
    }
}




function results_convert_html(jsonData, data) {
    let htmlContent = `<div class="contenido_dinamico_respuesta_portal">`;

    jsonData.forEach((proceso, index) => {
        let resultado = proceso.resultado.split('\n'); // Separar por saltos de línea

        htmlContent += `
        <div>
            <h3 style="margin-bottom:-30px;">BÚSQUEDA REALIZADA POR ${proceso.tipoBusqueda.toUpperCase()}</h3>
            <br>
            Periodo: ${data.fechaIni} al ${data.fechaFin}
            <div>`;

        let table = null;
        let seccionActual = null;

        resultado.forEach(line => {
            line = line.trim();
            if (line === '') return; // Saltar líneas vacías

            // Si detecta una tabla (tiene tabulaciones "\t")
            if (line.includes('\t')) {
                let cols = line.split('\t');

                if (!table) {
                    table = `<table border="1" style="width: 100%;"><thead>`;
                    table += `<tr>${cols.map(col => `<th>${col.trim()}</th>`).join('')}</tr>`;
                    table += `</thead><tbody>`;
                } else {
                    table += `<tr>${cols.map(col => `<td>${col.trim()}</td>`).join('')}</tr>`;
                }
            }
            // Si es un título de sección (termina en ":")
            else if (line.endsWith(':')) {
                if (table) {
                    table += `</tbody></table>`;
                    htmlContent += table;
                    table = null;
                }
                if (line.includes('RF_')) {
                    htmlContent += `<h4>DATOS:</h4>
                    ${proceso.tipoBusqueda.toUpperCase().trim() != 'TELEFONO' ? concatenarParametrosPorTipo(data, proceso.tipoBusqueda.toLowerCase().trim()) :''}
                    `;
                } else {
                    if(line.includes('. L')){
                        htmlContent += `<h4 style="margin-left:0px">${line.split('. ')[1]}</h4>`
                    } else if (line.includes('. ')) {
                        htmlContent += `<h4 style="margin-left:-40px">${line.split('. ')[1]}</h4>`
                    } else{
                        htmlContent += `<h4>${line}</h4>`;
                    }
                }

            }
            // Si es una lista (comienza con "-")
            else if (line.startsWith('-')) {
                const contenido = line.substring(1).trim();

                const frasesEspeciales = [
                    
                ];

                const esEspecial = frasesEspeciales.some(frase => contenido.includes(frase));

                if (esEspecial) {
                    console.log('entra');

                    // Buscar el <h4> que contiene la palabra TRAFICO (ej. <h4>3. TRAFICO:</h4>)
                    const regex = /(<h4[^>]*>[^<]*TRAFICO[^<]*<\/h4>)/i;
                    const match = htmlContent.match(regex);

                    if (match) {
                        const encabezado = match[1];
                        const nuevoBloque = `<li>${contenido}</li>`;
                        htmlContent = htmlContent.replace(encabezado, `${encabezado}\n${nuevoBloque}`);
                    } else {
                        // Si no hay <h4> TRAFICO, agregar como lista normal
                        if (!seccionActual) {
                            htmlContent += `<ul>`;
                            seccionActual = true;
                        }
                        htmlContent += `<li>${contenido}</li>`;
                    }
                } else {
                    if (!seccionActual) {
                        htmlContent += `<ul>`;
                        seccionActual = true;
                    }
                    htmlContent += `<li>${contenido}</li>`;
                }
            }


            // Si es texto normal, agregarlo en un párrafo
            else {
                if (table) {
                    table += `</tbody></table>`;
                    htmlContent += table;
                    table = null;
                }
                if (seccionActual) {
                    htmlContent += `</ul>`;
                    seccionActual = false;
                }
                htmlContent += `<p>${line}</p>`;
            }
        });

        // Cerrar cualquier tabla o lista que esté abierta
        if (table) {
            table += `</tbody></table>`;
            htmlContent += table;
        }
        if (seccionActual) {
            htmlContent += `</ul>`;
        }

        htmlContent += `</div></div>`; // Cerrar el proceso
    });

    htmlContent += `</div>`; // Cerrar contenedor principal
    return htmlContent;
}
function concatenarParametrosPorTipo(objeto, tipoBuscado) {
    const valores = [];

    for (const key in objeto) {
        const match = key.match(/^parametro_(\w+)_\d+$/);
        if (match && match[1] === tipoBuscado) {
            valores.push(objeto[key]);
        }
    }

    return valores.join("<br>");
}


module.exports = { results_convert_html, updatePdfWithResults }