# Fase 8 - Documentacion final

## Descripcion del sistema

Sistema web de blog con autenticacion y arquitectura de microservicios.

## Arquitectura

- API Gateway central.
- Servicios desacoplados para auth, usuarios, posts y comentarios.
- Persistencia separada por dominio.

## Instrucciones de ejecucion

- Local: ejecutar cada microservicio con Node.
- Docker: `docker compose up --build`.
- Hosting: guia de Render en `docs/07-despliegue-render.md`.

## Capturas solicitadas (pendiente de adjuntar)

Crear carpeta `docs/evidencias/` y agregar:

- `01-login.png`
- `02-crud-posts.png`
- `03-microservices-running.png`
- `04-render-url.png`
- `05-mobile-test.png`

## Problemas encontrados y soluciones

1. Dependencia de arranque entre servicios y BD.
- Solucion: estrategia de reintentos al iniciar conexion PostgreSQL.

2. Autorizacion distribuida.
- Solucion: JWT validado en API Gateway para centralizar seguridad.

3. Consistencia entre servicios.
- Solucion: validaciones cruzadas (usuario/post existente) antes de guardar datos.

## Guion de defensa oral

1. Problema resuelto
- Plataforma de blog segura para publicar y comentar.

2. Arquitectura seleccionada
- Microservicios para separar responsabilidades y escalar por dominio.

3. Razon para usar microservicios
- Mantenimiento, escalabilidad y despliegues independientes.

4. Uso de Git
- Ramas `feature/*`, commits por modulo y PR antes de merge.

5. Uso de contenedores
- Dockerfile por servicio y orquestacion con Docker Compose.

6. Proceso de despliegue
- Publicacion en GitHub + despliegue en Render (servicio publico).

7. Dificultades
- Comunicacion entre servicios y sincronizacion de arranque.

8. Mejoras futuras
- API Gateway con rate limit.
- Tests automatizados.
- Observabilidad (logs centralizados + metricas).
