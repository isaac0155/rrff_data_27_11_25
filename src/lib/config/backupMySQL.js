const { exec } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const clave = '0155';
const { database } = require('../../keys');

// 🧠 Comando base de dump (sin redireccionar todavía)
const buildDumpCommand = () => {
    const passSegment = database.password ? ` -p${database.password}` : '';
    return `mysqldump -h${database.host} -u ${database.user}${passSegment} ${database.database}`;
};

function eliminarArchivo(rutaArchivo) {
    fs.unlink(rutaArchivo, (error) => {
        if (error) {
            console.error('❌ Error al eliminar el archivo:', error);
            return;
        }
        console.log(`🗑️ Archivo eliminado: ${rutaArchivo}`);
    });
}

const backupDatabase = (manual) => {
    const fechaActual = new Date();
    const dia = fechaActual.getDate();
    const mes = fechaActual.getMonth() + 1;
    const año = fechaActual.getFullYear();
    const fechaFormateada = manual
        ? fechaActual.toLocaleString().replace(/[\/\\:]/g, '-').replace(', ', '--')
        : `${dia}-${mes}-${año}`;

    console.log(`🕓 Backup fecha: ${fechaFormateada}`);

    const backupPath = path.join(__dirname, '..', 'backup', `${fechaFormateada}.sql`);
    const comando = `${buildDumpCommand()} > "${backupPath}"`;

    exec(comando, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Error al realizar el backup:\n${error.message}`);
            return;
        }
        console.log('✅ Backup realizado con éxito.');
        encryptBackup(backupPath);
    });
};

async function encryptBackup(filePath) {
    const algorithm = 'aes-256-cbc';
    const password = clave;
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(filePath + '.enc');

    output.write(iv);
    input.pipe(cipher).pipe(output);

    output.on('finish', () => {
        console.log('🔐 Backup encriptado con éxito.');
        eliminarArchivo(filePath);
    });
}

const restoreDatabase = async (encryptedFilePath) => {
    const algorithm = 'aes-256-cbc';
    const password = clave;
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = fs.readFileSync(encryptedFilePath).slice(0, 16);

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    const input = fs.createReadStream(encryptedFilePath, { start: 16 });
    const outputFilePath = encryptedFilePath.replace('.enc', '');
    const output = fs.createWriteStream(outputFilePath);

    input.pipe(decipher).pipe(output);

    output.on('finish', () => {
        console.log('📂 Backup desencriptado con éxito.');
        loadBackupIntoDatabase(outputFilePath);
    });
};

async function loadBackupIntoDatabase(filePath) {
    const passSegment = database.password ? ` -p${database.password}` : '';
    const comando = `mysql -h${database.host} -u ${database.user}${passSegment} ${database.database} < "${filePath}"`;

    exec(comando, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Error al restaurar el backup:\n${error.message}`);
            return;
        }
        console.log('✅ Backup restaurado con éxito.');
        eliminarArchivo(filePath);
    });
}

module.exports = {
    backupDatabase,
    restoreDatabase,
};