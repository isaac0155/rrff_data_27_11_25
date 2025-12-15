create database notificaion_tickets;
use notificaion_tickets;
create table enviado
(
    id_enviado   bigint auto_increment
        primary key,
    code         text                                  null,
    vencimiento  datetime                              null,
    enviado      timestamp default current_timestamp() not null,
    mail_enviado text                                  null
);

create table enviado1hora
(
    id_enviado1hora bigint auto_increment
        primary key,
    code            text                                  null,
    vencimiento     datetime                              null,
    enviado         timestamp default current_timestamp() not null,
    responsable     text                                  null,
    mail_enviado    text                                  null
);

create table enviadogrupo
(
    id_enviadogrupo bigint auto_increment
        primary key,
    enviado         timestamp default current_timestamp() not null,
    mail_enviado    text                                  null,
    tiques          text                                  null
);

create table enviadovencido
(
    id_enviadovencido bigint auto_increment
        primary key,
    code              text                                  null,
    vencimiento       datetime                              null,
    enviado           timestamp default current_timestamp() not null,
    responsable       text                                  null,
    mail_enviado      text                                  null
);

create table grupo
(
    id_grupo bigint auto_increment
        primary key,
    grupo    text null,
    mail     text null
);

create table sin_catalogar
(
    id_sin_catalogar bigint auto_increment
        primary key,
    code             text                                  null,
    fecha_envio      timestamp default current_timestamp() not null,
    mail             text                                  null,
    tiempo           text                                  null
);

