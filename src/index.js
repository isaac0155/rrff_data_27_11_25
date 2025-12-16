const express = require('express');
const morgan = require('morgan');
const { engine } = require('express-handlebars');
const path = require('path');
const flash = require('connect-flash');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session); // ← cambio aquí
const mysql = require('mysql2/promise'); // ← cambio aquí
const { database } = require('./keys');
const passport = require('passport');
const schedule = require('node-schedule');
const http = require('http');
const device = require('express-device');
const { Server: WebSocketServer } = require("socket.io");
const { PORT } = require('./config');
const eliminarArchivosAntiguos = require('./lib/config/deleteFiles');
const { backupDatabase, restoreDatabase, prueba } = require('./lib/config/backupMySQL');
const pool = require('./database.js');
const { initial_process, solicitud_ITC } = require('./routes/funciones/rrff/index');
const { Socket } = require('dgram');


// Inicializaciones
const app = express();
const Server = http.createServer(app);
const io = new WebSocketServer(Server);
require('./lib/passport');

app.set('views', path.join(__dirname, 'views'));
app.engine('.hbs', engine({
    defaultLayout: 'main',
    layoutsDir: path.join(app.get('views'), 'layouts'),
    patialsDir: path.join(app.get('views'), 'partials'),
    extname: '.hbs',
    helpers: require('./lib/handlebars')
}));
app.set('view engine', '.hbs');

// 📦 Manejo de sesiones con MySQLStore + mysql2/promise
async function createSessionStore() {
    try {
        const connection = await mysql.createConnection(database);
        return new MySQLStore({}, connection);
    } catch (error) {
        console.error('❌ Error creando MySQLStore:', error);
        process.exit(1);
    }
}

async function setupSessionMiddleware(app) {
    const sessionStore = await createSessionStore();

    const sessionMiddleware = session({
        secret: 'sesionrapidamysql',
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            path: '/',
            httpOnly: true,
            maxAge: 3600000,
        },
        store: sessionStore
    });

    app.use(sessionMiddleware);
    return sessionMiddleware;
}

// 🧠 Middleware y rutas dentro de la sesión
setupSessionMiddleware(app).then(sessionMiddleware => {
    app.use(device.capture());
    app.use(flash());
    app.use(morgan('dev'));
    app.use(express.json({ limit: '100mb' }));
    app.use(express.urlencoded({ limit: '100mb', extended: true }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.set('trust proxy', true);

    app.use((req, res, next) => {
        app.locals.success = req.flash('success');
        app.locals.warning = req.flash('warning');
        app.locals.danger = req.flash('danger');
        app.locals.user = req.user;
        req.device.type === 'desktop' ? app.locals.desk = true : app.locals.desk = false;
        next();
    });

    app.use(express.static(path.join(__dirname, 'public')));
    app.use(require('./routes/autentication'));
    app.use('/links', require('./routes/links')(io, initial_process, solicitud_ITC));
    app.use(require('./routes/index'));

    schedule.scheduleJob('0 4 * * *', function () {
        eliminarArchivosAntiguos();
        console.log("Revisar archivos pasados");
        console.log("Backup de Base de Datos");
        backupDatabase(false);
    });

    // Reintentar procesos fallidos automáticamente al iniciar el servidor
    let process_failed_automatic;
    setTimeout(async function () {
        io.emit('server:initialice_server', true);

        const socketSimulado = { emit: function () { } };

        for (const element of process_failed_automatic) {
            try {
                console.log(
                    'Muestra de dantos antes de enviar',
                    element.json_busqueda,
                    false,
                    'host',
                    element.id_historial_respuesta_pdf,
                    io,
                    socketSimulado
                );

                await initial_process(
                    JSON.parse(element.json_busqueda),
                    false,
                    'host',
                    element.id_historial_respuesta_pdf,
                    io,
                    socketSimulado
                );

                console.log('🔄 Reintentando proceso ID:', element.id_historial_respuesta_pdf);
            } catch (err) {
                console.error('❌ Error reintentando ID:', element.id_historial_respuesta_pdf, err);
            }
        }
    }, 3000);



    
    const dbConfig = require('./dataBaseOracle');
    const dbConfig2 = require('./oracleDbService2');
    
    // Inicialización de pools de conexiones y arranque del servidor
    // Marcamos como 'error' los procesos pendientes de PDF y consultas ODB en 'Running'
    (async () => {
        try {
            await pool.query("update historial_respuesta_pdf set estado = 'error' where estado = 'pendiente';");
            await dbConfig.initialize();
            await dbConfig2.initializeODB();
            await pool.query("update historialconsulta set estado_proceso = 'Failed' where estado_proceso = 'Running';");
            
            process_failed_automatic = await pool.query('select * from historial_respuesta_pdf where estado = "error";');

            Server.listen(PORT, () => {
                console.log('🚀 Servidor en el puerto', PORT);
            });
        } catch (err) {
            console.error('❌ Error al inicializar los pools de conexiones:', err);
        }
    })();
});