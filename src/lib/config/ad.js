const ActiveDirectory = require('activedirectory2');
const ldapjs = require('ldapjs');
const config = {
    url: 'ldap://10.20.3.97',
    baseDN: 'dc=nuevatel,dc=net',
    username: 'saadabm@nuevatel.net',
    password: '7WN5IPxvPDyefXqdyWx5!qwa'
};

const ad = new ActiveDirectory(config);

// Promisificando ad.findUser
function findUserPromise(username) {
    return new Promise((resolve, reject) => {
        ad.findUser(username, (err, user) => {
            if (err) {
                reject(err);
            } else {
                resolve(user);
                //console.log(user)
            }
        });
    });
}

// Función para verificar la conexión a AD
async function verificarConexionAD() {
    try {
        const user = await findUserPromise('isherrera');
        //console.log(user)
        if (!user) {
            throw new Error('Conexión a AD fallida o usuario de prueba no encontrado.');
        }
        //console.log('Conexión a AD verificada con éxito.');
    } catch (err) {
        console.error('Error al buscar usuario:', err);
        throw err; // Relanzar el error para manejarlo en la función llamadora
    }
}

// Función para reconectar a AD
async function reconectarAD(maxIntentos) {
    for (let intentoActual = 0; intentoActual < maxIntentos; intentoActual++) {
        try {
            await verificarConexionAD();
            //console.log('Conexión a AD verificada exitosamente.');
            return; // Salir de la función si la conexión es exitosa
        } catch (error) {
            console.log(`Reintentando conexión... Intento ${intentoActual + 1} de ${maxIntentos}`);
            if (intentoActual === maxIntentos - 1) {
                console.log('Número máximo de intentos de reconexión alcanzado. Verifica la configuración de red o del servidor AD.');
                throw new Error('No se pudo reconectar a AD después de varios intentos.');
            }
            await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2 segundos antes de reintentar
        }
    }
}

// Promisificando ad.authenticate
function authenticatePromise(sAMAccountName, password) {
    return new Promise((resolve, reject) => {
        // La modificación principal aquí es asegurarte de que el username
        // se pasa correctamente como un sAMAccountName
        //console.log(`NUEVATEL\\${sAMAccountName}`, password)
        ad.authenticate(`NUEVATEL\\${sAMAccountName}`, password, (err, auth) => {
            if (err) {
                reject(err);
            } else {
                resolve(auth);
            }
        });
    });
}

// Función principal para autenticar
async function authenticate(sAMAccountName, password) {
    try {
        await reconectarAD(3);
        const auth = await authenticatePromise(sAMAccountName, password);
        if (auth) {
            //console.log('Autenticado');
            return true
        } else {
            //console.log('Autenticación fallida - Posiblemente credenciales incorrectas');
            return false
        }
    } catch (error) {
        // Revisa las propiedades del error para determinar si es un error de credenciales inválidas
        if (error.lde_message && error.lde_message.includes('data 52e')) {
            // Si el mensaje de error contiene 'data 52e', es un error de credenciales inválidas
            //console.error('Las credenciales proporcionadas son incorrectas.');
            return false;
        } else {
            // Manejo de otros tipos de errores
            //console.error('Error durante la autenticación o reconexión:', error);
            return false;
        }
    }
}

// Función para realizar una búsqueda genérica en Active Directory
async function searchAD(query, opts) {
    return new Promise((resolve, reject) => {
        // Asegúrate de que 'opts' incluya el filtro de búsqueda 'query'
        opts.filter = query;

        ad.find(opts, (err, results) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(results);
        });
    });
}

function findUserByPartialName(displayNamePart) {
    return new Promise((resolve, reject) => {
        // Usamos findUsers pero ajustamos para actuar como findUser
        const query = `(&(objectClass=user)(cn=*${displayNamePart}*)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))`;
        const opts = {
            filter: query,
            attributes: ['displayName', 'dn', 'title'],
            //includeMembership: ['user'],  // Omitir si no necesitas información de grupo
            sizeLimit: 3  // Limitamos los resultados a 1 para simular findUser
        };

        ad.findUsers(opts, (err, users) => {
            if (err) {
                console.error('Error al buscar usuario:', err);
                reject(err);
            } else if (!users || users.length === 0) {
                console.log(`Usuario no encontrado con displayName que contiene: ${displayNamePart}`);
                reject(new Error('Usuario no encontrado.'));
            } else {
                // Devolvemos el primer usuario encontrado
                //console.log('Usuario encontrado:', users[0]);
                resolve(users); // Resuelve con el usuario encontrado
            }
        });
    });
}

module.exports = { authenticate, searchAD, findUserPromise, findUserByPartialName }
// Llamada a la función principal
/*(async () => {
    // Asegúrate de pasar un sAMAccountName aquí, no un correo electrónico
    await authenticate('isherrera', 'Nuevatel2024');
})();*/