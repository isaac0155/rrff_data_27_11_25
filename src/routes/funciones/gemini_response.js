const axios = require('axios');
const https = require('https');

// Crear un agente HTTPS que ignore certificados autofirmados
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

const API_KEY = "AIzaSyCrU9KwOTTaecCEnMc7kuNpVbmXrHO-lok";
const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// Función principal para procesar la solicitud
async function generateResponse(task, ticket, fechaActual) {
    const prompt = `
        // PROMPT ENTRENAMIENTO IA - Extracción estructurada de entidades para JSON plano

        /**
         * OBJETIVO:
         * Procesar un texto no estructurado (como una solicitud escrita o nota libre) y generar UN ÚNICO objeto JSON plano.
         * Este objeto debe contener:
         *   - Campos parametrizados por tipo: parametro_ci_TIMESTAMP, parametro_nombre_TIMESTAMP, etc.
         *   - Rango de fechas normalizado: fechaIni, fechaFin, y fecha de emisión
         *   - Listas: opcionesIDSeleccionadas (claves técnicas) y opcionesSeleccionadas (legibles)
         */

        Eres un modelo de lenguaje especializado en transformar texto no estructurado en un objeto JSON plano con las siguientes reglas. No puedes inferir ni suponer. Solo debes actuar cuando haya evidencia textual explícita.

        ---
        REGLAS DE EXTRACCIÓN

        1. Identificación de parámetros principales
        Extrae todos los valores relevantes y categorízalos con el siguiente criterio:

        - "telefono": Todo número de 7 u 8 dígitos que comience por 2, 4, 6 o 7 y NO sea CI ni IMEI.
        - "ci": Todo número de 5 a 9 dígitos que se mencione como CI, cédula o similar. Puede incluir letras o guiones.
        - "imei": Todo número de 15 a 17 dígitos. Solo números.
        - "nombre": Todo nombre en mayúsculas, de al menos dos palabras. Si está acompañado de CI, separarlo y asignarlo por separado.

        → Cada valor se guarda como:
        "parametro_<tipo>_<timestamp>": "valor"

        → Usa un timestamp con 'Date.now()' para evitar duplicados.
        → No debe haber campos duplicados. Si hay un valor ya registrado en otro campo, se omite.
        → Los nombres deben ir en mayúsculas sin el CI ni ningún número.


        2. Detección de fechas
        Detecta expresiones como:
        - “del 1 de enero al 26 de marzo de 2025”
        - “últimos 3 meses”

        → Convierte siempre a formato:
        - "fechaIni": "YYYY-MM-DD"
        - "fechaFin": "YYYY-MM-DD"

        → Si no se da explícitamente ninguna fecha:
        - fechaFin = fecha actual
        - fechaIni = fechaFin menos 5 años

        → Agrega también:
        - "fecha": fecha actual (representa la fecha de solicitud) 
        
        → Te paso la fecha actual:
        - ${fechaActual}


        3. Opciones seleccionadas (checkboxes semánticas)
        Si el texto contiene alguna de las siguientes frases, activa el par clave-descripción correspondiente. Ambos arrays deben estar presentes si hay al menos un match.

        '''json
        {
        "NOM": "Información del Suscriptor",
        "DIR": "+ Domicilio",
        "REF": "+ Contactos de referencia",
        "S": "IMEI asociado al Suscriptor",
        "RECARGAS": "Detalle de recargas de crédito",
        "LLA": "Detalle de llamadas",
        "SMS": "Detalle de tráfico de SMS",
        "DATOS": "Tráfico de datos GSM",
        "CEL": "+ Radio bases",
        "IMEI": "+ IMEI",
        "NOM_VIVA": "+ Detalle de suscriptores de Viva"
        }
        '''

        → Palabras clave para detección:
        - "si tiene líneas registradas" o "datos de titular" => NOM
        - "domicilio" => DIR
        - "referencia" => REF
        - "imei", "imei registrado", "imei asociado" => S
        - "recargas", "traspasos de crédito" => RECARGAS
        - "llamadas" => LLA
        - "sms" => SMS
        - "datos" => DATOS
        - "radio bases" => CEL
        - "dentro del tráfico debe tener el imei correspondiente" => activa ambos: S e IMEI
        - "titulares viva" => NOM_VIVA

        → Si no se menciona, NO se agrega al JSON.

        → Si se menciona más de una vez, se registra solo una vez por ID.


        ---
        EJEMPLO DE ENTRADA:
        Texto:
        '''
        CARLOS ALBERTO MONTAÑO PEDRAZA C.I. 4691415
        edither torrez
        BERAT GUÑAY C.I. 17684660
        CLAUDIA LILY IRIGOYEN GUTIERREZ
        SI TIENE LINEAS REGISTRADAS
        DATOS DE TITULAR
        NUMERO DEI MEI REGISTRADO
        TRAFICO DE LAMADAS,SMS Y DATOS MA RADIO BASES DEL 1 DE FEBRERO AL 6 DE DICIEMBRE DE 2024
        '''

        → Resultado (estructura deseada):
        '''json
        {
        "fechaIni": "2024-02-01",
        "fechaFin": "2024-12-06",
        "fecha": "2025-04-11",

        "parametro_ci_1712848394311": "4691415",
        "parametro_ci_1712848394312": "17684660",
        "parametro_nombre_1712848394313": "CLAUDIA LILY IRIGOYEN GUTIERREZ",
        "parametro_nombre_1712848394314": "EDITHER TORREZ",

        "opcionesIDSeleccionadas": [
            "NOM", "S", "LLA", "SMS", "DATOS", "CEL"
        ],
        "opcionesSeleccionadas": [
            "Información del Suscriptor",
            "IMEI asociado al Suscriptor",
            "Detalle de llamadas",
            "Detalle de tráfico de SMS",
            "Tráfico de datos GSM",
            "+ Radio bases"
        ]
        }
        '''


        ---
        OTROS EJEMPLOS CLAVE:

        1. Si se menciona “NEVER MAMANI MAMANI”, lo registra como:
        - parametro_nombre_TIMESTAMP: "NEVER MAMANI MAMANI"

        2. Si se menciona “65380221”, lo registra como:
        - parametro_telefono_TIMESTAMP: "65380221"

        3. Si dice “del 10 de enero al 4 de marzo del presente año” → convierte según fecha actual

        4. Si dice “últimos 3 meses” → calcula fechaFin = hoy, fechaIni = hoy - 3 meses

        5. Si dice “cada tráfico debe tener el imei correspondiente” → activa "S" e "IMEI"

        ---
        SALIDA OBLIGATORIA:
        - Un único objeto JSON
        - Campos tipo 'parametro_*_timestamp'
        - Fechas normalizadas
        - Listas de opciones ID y sus descripciones

        ---
        INSTRUCCIÓN FINAL:
        Analiza el siguiente texto y genera el JSON plano correspondiente en base a todas las reglas descritas. No agregues nada que no esté explícito. No infieras ni completes datos.

        Texto:
        "${task}"

    `.trim();

    try {
        // Enviar la solicitud a la API
        const response = await axios.post(
            `${url}?key=${API_KEY}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
            },
            {
                headers: { "Content-Type": "application/json" },
                httpsAgent,
            }
        );
        

        // Obtener el texto generado
        if (
            response.data &&
            response.data.candidates &&
            response.data.candidates.length > 0
        ) {
            let generatedText = response.data.candidates[0].content.parts
            .map(part => part.text)
            .join("\n");
            generatedText = generatedText.replace('```json', '').replace('```', '')
            // Convertir la respuesta a JSON
            const parsedResponse = JSON.parse(generatedText);
            //console.log('--------------------------------------------------', generatedText, parsedResponse)
            
            // Completar los campos faltantes
            // Completar los campos faltantes dentro de cada objeto de `opcionesBusqueda`
            const now = new Date();
            const currentDateTime = now.toISOString().replace("T", " ").slice(0, 19);
            const pmPrefix = ticket;

            parsedResponse.solicitud_type = 'RRFF'
            parsedResponse.departamento = 'Santa Cruz'
            parsedResponse.cite = pmPrefix
            parsedResponse.cocite = pmPrefix
            parsedResponse.solicitante = 'Host'
            parsedResponse.cargo_solicitante = 'Administrador'
        
            return await parsedResponse
        } else {
            console.error("La respuesta no contiene candidatos.");
            return false
        }
    } catch (error) {
        console.error("Error al generar respuesta:", error.response?.data || error.message);
        return false
    }
}



module.exports = {generateResponse}
// Ejemplo de tarea
/*const task = `
60861526
78411785
DATOS DE TITULAR
NUMERO DE IMEI REGISTRADO
TRAFICO DE LAMADAS, SMS Y DATOS MA RADIO BASES DEL 1 DE ENERO AL 7 DE DICIMEBRE DE 2024
SI DENTRO DEL TRAFICO HAY LINEAS VIVA DATOS DE TITULAR
RECARGAS Y TRASPASOS DE CREDITO
`;

// Ejecutar la tarea
generateResponse(task);*/
