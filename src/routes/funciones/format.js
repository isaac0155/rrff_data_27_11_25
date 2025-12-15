const TZ = 'America/La_Paz';

// Construye un Date local preservando la "hora de reloj" del valor dado
function toLocalPreservingClock(value) {
  // Si es número (epoch) o Date, conviértelo a Date
  const src = (value instanceof Date) ? value : new Date(value);

  // Si no es válido, intenta un parse manual de string ISO local
  if (isNaN(src)) {
    const s = String(value).replace(/Z$/i, '');
    const m = s.match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
    );
    if (!m) return new Date(NaN);
    let [, Y, M, D, h, min, sec = '0', ms = '0'] = m;
    ms = (ms + '000').slice(0, 3);
    return new Date(+Y, +M - 1, +D, +h, +min, +sec, +ms);
  }

  // Si el valor representa un INSTANTE con zona explícita (Z u offset)
  const hasTZ = typeof value === 'string' && /Z$|[+-]\d{2}:\d{2}$/.test(value);

  // Para Date (ya perdido el string original), asumimos que venía como instante UTC
  if (value instanceof Date || hasTZ) {
    // Toma componentes UTC y créalo como LOCAL con esos mismos números
    return new Date(
      src.getUTCFullYear(),
      src.getUTCMonth(),
      src.getUTCDate(),
      src.getUTCHours(),
      src.getUTCMinutes(),
      src.getUTCSeconds(),
      src.getUTCMilliseconds()
    );
  }

  // Si era string sin zona (local naivo), ya tenemos src correcto
  return src;
}

// Formateadores en La Paz
function fmtDateLP(dt) {
  return dt.toLocaleDateString('es-BO', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ
  }).replace(',', '');
}

function fmtTimeLP(dt) {
  return dt.toLocaleTimeString('es-BO', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: TZ
  });
}

// API pedida
function convertirFecha(fecha) {
  //console.log('input fecha:', fecha, 'tipo:', typeof fecha, fecha instanceof Date ? '(Date)' : '');
  const dtLocal = toLocalPreservingClock(fecha);
  if (isNaN(dtLocal)) {
    console.warn('Fecha inválida tras parseo:', fecha);
    return '';
  }
  const out = `${fmtDateLP(dtLocal)} - ${fmtTimeLP(dtLocal)}`;
  //console.log('output fecha:', out);
  return out;
}




// Función para extraer todos los números precedidos por un guion y seguidos por un espacio en una cadena de texto
function extraerNumeros(texto) {
    // Definición de la expresión regular para identificar los números con el patrón especificado
    const regex = /-\d+\s/g;
    // Aplicación de la expresión regular al texto para encontrar coincidencias
    const numerosEncontrados = texto.match(regex);

    // Verificación de si se encontraron números
    if (numerosEncontrados) {
        // Mapeo de los números encontrados para eliminar guiones y espacios, y encapsularlos entre comillas simples
        return numerosEncontrados
            .map((numero) => `'${numero.replace(/-|\s/g, "").trim()}'`)
            .join(",");
    } else {
        // Retorno de una cadena vacía si no se encontraron números
        return "";
    }
}

// Exportación de las funciones para permitir su uso en otros archivos
module.exports = {
    convertirFecha,
    extraerNumeros
};
