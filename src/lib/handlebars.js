const {format, register} = require('timeago.js');

register('es_ES', (number, index, total_sec) => [
    ['justo ahora', 'ahora mismo'],
    ['hace %s segundos', 'en %s segundos'],
    ['hace 1 minuto', 'en 1 minuto'],
    ['hace %s minutos', 'en %s minutos'],
    ['hace 1 hora', 'en 1 hora'],
    ['hace %s horas', 'in %s horas'],
    ['hace 1 dia', 'en 1 dia'],
    ['hace %s dias', 'en %s dias'],
    ['hace 1 semana', 'en 1 semana'],
    ['hace %s semanas', 'en %s semanas'],
    ['1 mes', 'en 1 mes'],
    ['hace %s meses', 'en %s meses'],
    ['hace 1 año', 'en 1 año'],
    ['hace %s años', 'en %s años']
][index]);

const helpers = {};

helpers.timeago = (timestamp) => {
    return format(timestamp, 'es_ES');
};

// Agregar un nuevo helper para comparar igualdad
helpers.equals = function (arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
};

// Mayor que
helpers.gt = function (arg1, arg2, options) {
    return (arg1 > arg2) ? options.fn(this) : options.inverse(this);
};

// Menor que
helpers.lt = function (arg1, arg2, options) {
    return (arg1 < arg2) ? options.fn(this) : options.inverse(this);
};

// Mayor o igual que
helpers.gte = function (arg1, arg2, options) {
    return (arg1 >= arg2) ? options.fn(this) : options.inverse(this);
};

// Menor o igual que
helpers.lte = function (arg1, arg2, options) {
    return (arg1 <= arg2) ? options.fn(this) : options.inverse(this);
};

// Desigualdad
helpers.neq = function (arg1, arg2, options) {
    return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
};

// Y lógico
helpers.and = function (arg1, arg2, options) {
    return (arg1 && arg2) ? options.fn(this) : options.inverse(this);
};

// O lógico
helpers.or = function (arg1, arg2, options) {
    return (arg1 || arg2) ? options.fn(this) : options.inverse(this);
};

// Helper para verificar si el usuario tiene alguno de los roles especificados
helpers.hasAnyRole = function (user, roles, options) {
    var rolesArray = roles.split(','); // Convierte la cadena de roles en un array
    var hasRole = rolesArray.some(role => user.rol === role.trim()); // Verifica si alguno de los roles coincide
    return hasRole ? options.fn(this) : options.inverse(this);
};


module.exports = helpers;