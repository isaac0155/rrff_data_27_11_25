const FtpClient = require('ftp');
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const chardet = require('chardet');


function ftpTaskHandler(task, callback) {
    const { id, datos, io } = task;
    const ftp = new FtpClient();
    let b = -1; // Contador para archivos procesados
    let txtContent = ''; // Acumulador de contenido de archivos .txt

    function safeCallback(err, result) {
        if (callback) {
            callback(err, result);
            callback = null; // Evitar múltiples llamadas
        }
    }

    ftp.on('ready', function () {
        ftp.list('/backup/utl/ld_file/', async function (err, list) {
            if (err) {
                ftp.end();
                return safeCallback(err);
            }

            const archivosFiltrados = list.filter(item => item.name.startsWith('RF_' + id));
            if (archivosFiltrados.length === 0) {
                ftp.end();
                return safeCallback(null, { message: 'No se encontraron archivos.' });
            }

            //console.log('Archivos encontrados:', archivosFiltrados);

            try {
                for (const archivo of archivosFiltrados) {
                    const localPath = path.join(__dirname, `../../public/img/imgenCliente/${archivo.name}`);
                    const datos1 = await procesarArchivo(ftp, archivo, localPath, datos, io, id, ++b, txtContent);
                    // Acumula el contenido de archivos .txt
                    if (datos1.txt) {
                        txtContent += datos1.txt;
                    }
                }
                ftp.end();
                safeCallback(null, { txt: txtContent, datos1: { nombre: 'RF_' + id, busqueda: datos, archivos: b } });
            } catch (err) {
                ftp.end();
                safeCallback(err);
            }
        });
    });

    ftp.on('error', function (err) {
        console.error('Error en la conexión FTP:', err);
        safeCallback(err);
    });

    ftp.connect({
        host: '10.49.4.21',
        port: 21,
        user: 'ld',
        password: 'LD16',
        passive: true // Habilitar modo pasivo
    });
}

async function procesarArchivo(ftp, archivo, localPath, datos, io, id, b, txtContent) {
    return new Promise((resolve, reject) => {
        ftp.get('/backup/utl/ld_file/' + archivo.name, function (err, stream) {
            if (err) {
                console.error(`Error al obtener el archivo ${archivo.name}:`, err);
                return reject(err);
            }

            //console.log('Procesando archivo:', archivo.name);

            if (archivo.name.endsWith('.txt')) {
                let fileTxtContent = '';
                stream.on('data', chunk => {
                    const encoding = chardet.detect(chunk); // Detecta la codificación
                    fileTxtContent += iconv.decode(chunk, encoding || 'utf8'); // Decodifica con la codificación detectada
                });

                stream.on('close', () => {
                    //console.log(`Archivo .txt procesado: ${archivo.name}`);
                    const datos1 = {
                        nombre: 'RF_' + id,
                        busqueda: datos,
                        archivos: b,
                    };
                    io.emit('server:progressRF_' + id, 80, `Archivo procesado: ${archivo.name}`);
                    resolve({ txt: fileTxtContent, datos1 });
                });

                stream.on('error', err => {
                    console.error(`Error en el stream del archivo ${archivo.name}:`, err);
                    reject(err);
                });
            } else {
                const writeStream = fs.createWriteStream(localPath);
                stream.pipe(writeStream);

                writeStream.on('finish', () => {
                    //console.log(`Archivo guardado localmente: ${archivo.name}`);
                    const datos1 = {
                        nombre: 'RF_' + id,
                        busqueda: datos,
                        archivos: b,
                    };
                    io.emit('server:progressRF_' + id, 80, `Archivo descargado: ${archivo.name}`);
                    resolve({ txt: '', datos1 });
                });

                writeStream.on('error', err => {
                    console.error(`Error al guardar el archivo ${archivo.name}:`, err);
                    reject(err);
                });
            }
        });
    });
}

const enqueueFtpTask = (id, datos, io) => {
    return new Promise((resolve, reject) => {
        ftpTaskHandler({ id, datos, io }, (err, result) => {
            if (err) {
                console.error('Error en la tarea FTP:', err);
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

module.exports = enqueueFtpTask;
