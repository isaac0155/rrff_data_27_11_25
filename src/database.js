const mysql = require('mysql2');
const {promisify} = require('util');
const { database } = require('./keys');

const pool=mysql.createPool(database);
//console.log(pool);
pool.getConnection((err, connection)=>{
    if(err){
        if(err.code === 'PROTOCOL_CONNETION_LOST'){
            console.error('cONEXION CON LA BASE DE DATOS CERRADA');
        }
        if(err.code === 'ER_CON_COUNT_ERROR'){
            console.error('La base de datos tiene muchas conexiones activas');
        }
        if (err.code === 'ECONNREFUSED'){
            console.error('Conexion rechazada a la base de datos');
        }
    }
    if(connection) {
        connection.release();
        console.log('✅ Base de datos conectada MySQL '+ connection.config.database);
    }
        
    return
});

pool.query = promisify(pool.query);
module.exports = pool;