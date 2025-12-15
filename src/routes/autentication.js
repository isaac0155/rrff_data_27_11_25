const express = require('express');
const router = express.Router();
const passport = require('passport');
const{isLoggedIn} = require('../lib/auth')
const { isNotLoggedIn } = require('../lib/auth')
const { isAdmin } = require('../lib/auth')
const pool = require('../database');


router.get('/signup', isAdmin, async (req, res) => {
    var tipo = await pool.query('select * from rol;')
    res.render('auth/signup', { tipo });
});
//cambiar a isNotLoggedIn para registrarse sin iniciar sesion, solo en caso de emergencia
router.post('/signup', isAdmin, passport.authenticate('local.signup',{
    successRedirect: '/profile',
    failureRedirect: '/signup',
    failureFlash: true
}));

router.get('/signin/:newurl(*)', isNotLoggedIn,async (req, res) => {
    //console.log("Accediendo a: ", req.params.newurl);
    const newUrl = req.params.newurl;
    // Renderiza la plantilla, pasando el `newUrl` como una variable local
    res.render('auth/signin', { url: newUrl });
});
router.get('/signin', isNotLoggedIn, async(req, res)=>{
    res.render('auth/signin');
});

router.post('/signin', isNotLoggedIn, (req, res, next)=>{
    passport.authenticate('local.signin',{
        successRedirect: req.body.url? req.body.url : '/profile',
        failureRedirect: '/signin',
        failureFlash: true,
    })(req, res, next);
});

router.get('/profile',isLoggedIn,(req, res)=>{
    console.log(req.user)
    res.render('profile');
});

router.get('/logout', isLoggedIn, (req, res, next)=>{
    req.logOut(function(err){
        if(err){
            next(err);
        }else{
            res.redirect('/signin');
        }
    });
});

module.exports = router;