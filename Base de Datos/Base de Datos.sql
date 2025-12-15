create table documents
(
    id        int auto_increment
        primary key,
    content   longtext null,
    pdf_file  longblob null,
    name      text     null,
    status    int      null,
    name_show text     null
);

create table historial_respuesta_pdf
(
    id_historial_respuesta_pdf bigint auto_increment
        primary key,
    json_consultas             longtext                             null,
    tipo_solicitud             text                                 null,
    fecha_inicio               date                                 null,
    fecha_fin                  date                                 null,
    fecha_solicitud            date                                 null,
    user                       text                                 null,
    departamento               text                                 null,
    cite                       text                                 null,
    cocite                     text                                 null,
    solicitante                text                                 null,
    cargo_solicitante          text                                 null,
    json_busqueda              longtext                             null,
    estado                     text                                 null,
    tiempo_solucion            time                                 null,
    ip                         text                                 null,
    user_id                    int                                  null,
    pdf_file                   longblob                             null,
    creado                     datetime default current_timestamp() null
);

create table historialconsulta
(
    idHistorialConsulta bigint auto_increment
        primary key,
    idPersona           bigint      null,
    fecha               datetime    null,
    rangoBusqueda       text        null,
    entradaBusqueda     text        null,
    datoSolicitado      text        null,
    nombre              text        null,
    resultado           text        null,
    archivo             int         null,
    tipoBusqueda        text        null,
    pm                  text        null,
    body                text        null,
    ip                  text        null,
    estado_proceso      varchar(30) null
);

create table rol
(
    idRol     bigint auto_increment
        primary key,
    nombreRol text null
);

create table persona
(
    idPersona bigint auto_increment
        primary key,
    ad        text   null,
    password  text   null,
    idRol     bigint null,
    activo    int    null,
    foto      text   null,
    constraint persona_ibfk_1
        foreign key (idRol) references rol (idRol)
);

create table historialcambios
(
    idHistorialCambios bigint auto_increment
        primary key,
    cambio             text     null,
    idPersona          bigint   null,
    fecha              datetime null,
    accion             text     null,
    constraint historialcambios_ibfk_1
        foreign key (idPersona) references persona (idPersona)
);

create index idPersona
    on historialcambios (idPersona);

create index idRol
    on persona (idRol);

create table peticionescc
(
    idPeticionescc bigint auto_increment
        primary key,
    ticket         text                                  null,
    telefono       text                                  null,
    fecha          timestamp default current_timestamp() not null,
    fechaIni       date                                  null,
    fechaFin       date                                  null,
    idPersona      bigint                                null,
    resultado      longtext                              null,
    ip             text                                  null,
    ofuscado       int                                   null,
    constraint peticionescc_ibfk_1
        foreign key (idPersona) references persona (idPersona)
);

create index idPersona
    on peticionescc (idPersona);

create table sessions
(
    session_id varchar(128) collate utf8mb4_bin not null
        primary key,
    expires    int(11) unsigned                 not null,
    data       mediumtext collate utf8mb4_bin   null
);

