# Sistema de Automatización de Requerimientos Fiscales (SARF) - ITC Nuevatel

## Tabla de contenidos

1. [Descripción General](#descripción-general)
2. [Funcionalidades Principales](#funcionalidades-principales)
3. [Tecnologías Utilizadas](#tecnologías-utilizadas)
4. [Instalación y Configuración](#instalación-y-configuración)
5. [Uso del Sistema](#uso-del-sistema)
6. [Estructura del Proyecto](#estructura-del-proyecto)
7. [Documentación Adicional](#documentación-adicional)
8. [Pruebas](#pruebas)
9. [Contribuciones](#contribuciones)
10. [Contacto](#contacto)
11. [Licencia](#licencia)

## Descripción General

Este repositorio contiene el código fuente de SARF (Sistema de Automatización de Requerimientos Fiscales), una aplicación web desarrollada para optimizar el procesamiento de requerimientos fiscales en el departamento de IT de Nuevatel. El sistema agiliza la recepción, gestión y respuesta a solicitudes legales, minimizando el tiempo de respuesta y liberando al equipo de IT para tareas de mayor impacto.

## Funcionalidades Principales

* **Consulta de Datos de Usuarios:** Permite a los abogados buscar información específica de usuarios mediante diferentes criterios, como nombre AD, número de identificación y rangos de fechas.
* **Manejo de Auditorías Internas:** Registra y almacena un historial completo de las operaciones del sistema, incluyendo detalles de usuario, consultas realizadas e informes generados, garantizando la trazabilidad y el cumplimiento de las políticas de seguridad.
* **Generación de Informes Automatizada:** Genera informes precisos en varios formatos (texto, XLS) con la información requerida en los requerimientos fiscales, agilizando la respuesta a las solicitudes legales.
* **Interfaz de Usuario Intuitiva:**  Provee una interfaz amigable y fácil de usar que simplifica la interacción con el sistema para ingresar requerimientos, consultar datos y acceder a las funcionalidades.
* **Gestión de Roles y Permisos:** Implementa un sistema de roles y permisos granular que permite a los administradores controlar el acceso a funcionalidades específicas del sistema, garantizando la seguridad de la información.

## Tecnologías Utilizadas

**Backend:**

* Node.js: Entorno de ejecución JavaScript utilizado por su eficiencia en el manejo de operaciones de entrada/salida.
* Express.js: Framework web minimalista para Node.js que facilita la creación de APIs y el manejo de rutas.
* MySQL: Sistema de gestión de bases de datos relacional para almacenar la información de usuarios, requerimientos e historiales.
* Oracle: Base de datos donde se consultan los datos.

**Frontend:**

* Handlebars.js: Motor de plantillas para generar contenido HTML dinámico del lado del cliente.
* JavaScript: Lenguaje de programación utilizado para la lógica del lado del cliente, interacciones con la interfaz de usuario y comunicación con el servidor.

**Comunicación en Tiempo Real:**

* Socket.io: Librería JavaScript para comunicación bidireccional en tiempo real entre el cliente y el servidor, utilizada para actualizar datos en la interfaz sin necesidad de recargar la página.

## Instalación y Configuración

1. **Pre-requisitos:**

   * Instalar Node.JS.
   * Instalar el Cliente de Oracle para conexión a BBDD.
   * Instalar el Driver de Netezza para conexión de BBDD.
   * Tener instalado MySQL y crear una BBDD llamada 'rrff'.
   * Asegurarse que la herramienta 'mysqldump' esté disponible en el sistema.
2. **Configuración:**

   * Configurar las credenciales de acceso (MySQL) en el archivo `src/database.js`.
   * Configurar las credenciales de acceso (Oracle) en el archivo `src/dataBaseNetezza.js`.
   * Configurar las credenciales de acceso (Netezza) en el archivo `src/dataBaseOracle.js`.
   * Definir el puerto en el que se ejecutará el servidor en el archivo `src/config.js`.
3. **Preparación de la Base de datos:**

   * Ejecutar el script SQL (`Bse de Datos/Base de Datos.sql`) para crear el esquema de la base de datos `rrff` en MySQL.
   * Ingresar un nuevo registro en la tabla `PERSONA`. Asegurarse de que el valor del campo `AD`  corresponda a un usuario válido en Active Directory.
4. **Configuración de Roles:**

   * Registrar el rol 'Administrador' en el sistema.
   * Asignar el rol 'Administrador' al usuario creado en el paso anterior.
5. **Instalación de Dependencias:**

   * Navegar a la carpeta del proyecto en la terminal y ejecutar: `npm install`.
6. **Inicialización del Proyecto:**

   * Ejecutar: `npm run dev`.
7. **Acceso al Sistema:**

   * Abrir un navegador web y acceder a `http://localhost:[PUERTO]/` (reemplazar `[PUERTO]` con el puerto definido en el archivo `config/config.js`).
   * Iniciar sesión con las credenciales de Active Directory del usuario creado.

## Pruebas

El proyecto incluye pruebas unitarias para asegurar la calidad del código. Para ejecutar las pruebas, utilizar el comando `npm test`.

## Contribuciones

Se agradecen las contribuciones a este proyecto. Puedes contribuir:

* Reportando errores o solicitando nuevas funcionalidades a través de la sección de *issues*.
* Enviando *pull requests* con mejoras al código.

## Contacto

* Isaac Herrera Mareño -  isaac.herrera@nuevatel.com

## Licencia

De uso Interno, Software diseñado y desarrollado en Nuevate Bolivia.
