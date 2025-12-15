const fs = require('fs');
const path = require('path');
const directorio = path.join(__dirname, '../../public/img/imgenCliente/');
const backup = path.join(__dirname, '../../lib/backup/');
const archivoExcluido = '.gitignore'

const eliminarArchivosAntiguos =  () => {
    const milisegundosPorDia = 24 * 60 * 60 * 1000; // Milisegundos en un día
    const limite = new Date(Date.now() - 28 * milisegundosPorDia); // Fecha límite (28 días atrás)
    borrar(directorio, limite)
    borrar(backup, limite)
}

function borrar(dir, limite){
    fs.readdir(dir, (err, archivos) => {
        if (err) {
            console.error('Error al leer el directorio:', err);
            return;
        }

        archivos.forEach(archivo => {
            if (archivo === archivoExcluido) {
                console.log(`Archivo excluido: ${archivo}`);
                return;
            }

            const rutaCompleta = path.join(dir, archivo);
            fs.stat(rutaCompleta, (err, stats) => {
                if (err) {
                    console.error('Error al obtener información del archivo:', err);
                    return;
                }

                if (stats.mtime < limite) {
                    fs.unlink(rutaCompleta, err => {
                        if (err) {
                            console.error('Error al eliminar el archivo:', err);
                            return;
                        }
                        console.log(`Archivo eliminado: ${rutaCompleta}`);
                    });
                }
            });
        });
    });
}


module.exports = eliminarArchivosAntiguos;