const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const pool = require('../database');
const helpers = require('../lib/helpers');
const { route } = require('../routes');
const { authenticate, searchAD, findUserPromise } = require('./config/ad');

passport.use('local.signin', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
}, async (req, username, password, done) => {
    //console.log(username, password, done);
    const rows = await pool.query('SELECT * FROM persona WHERE ad = ?', [username]);
    if (rows.length > 0) {
        const user = rows[0];
        const exist = await authenticate(username, password)
        if (user.activo != 0){
            if (exist) {
                done(null, user, req.flash('success', "Bienvenido" + user.ad));
            } else {
                done(null, false, req.flash('danger', 'Datos Incorrectos'));
            }
        }else{
            done(null, false, req.flash('danger', 'Usuario Bloqueado - Hable con un administrador'));
        }
    } else {
        return done(null, false, req.flash('danger', 'Datos Incorrectos'))
    }
}));

passport.use('local.signup', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'username',
    passReqToCallback: true
}, async (req, username, pass, done) => {

    var { username, rol } = req.body;
    var newUser = {
        ad: username,
        idRol: rol,
        activo: req.body.activo ? true : false
    };

    newUser.password = await helpers.encryptPassword(username);
    //console.log(newUser);
    const resul = await pool.query('INSERT INTO persona SET ?', [newUser]);

    newUser.id = resul.insertId;
    //console.log(pass)

    return done(null, newUser);
}));

passport.serializeUser((user, done) => {
    var identificador;
    if (user.id) {
        identificador = user.id;
    } else {
        identificador = user.idPersona;
    }
    //console.log(identificador)
    done(null, identificador);
});

passport.deserializeUser(async (id, done) => {
    try {
        // Realiza la consulta a la base de datos para recuperar el usuario
        const rows = await pool.query('SELECT p.*, r.nombreRol AS rol FROM persona p, rol r WHERE p.idRol = r.idRol AND p.idPersona = ?', [id]);
        
        if (rows.length > 0 && rows[0].activo != 0) {
            var user = rows[0];
            if(user.rol=='Administrador'){
                user.Administrador=true;
            }
            //console.log(user);
            done(null, user);
        } else {
            // No se encontró un usuario con el ID proporcionado
            //req.flash('danger', 'Este usuario está Bloqueado')
            done(null, null);
        }
    } catch (error) {
        done(error); // Manejo de errores
    }
});
