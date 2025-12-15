const express = require('express');
const router = express.Router();

router.get('/', (req, res) =>{
    //res.redirect('/links');
    res.render('index')
});
router.get('*', (req, res) => {
    res.render('vacio')
});

module.exports = router;