# Fase 1 - Analisis del sistema

## Problema

Muchos creadores de contenido necesitan una plataforma simple para publicar articulos, autenticarse de forma segura y permitir interaccion por comentarios.

## Usuarios

- Administrador tecnico: despliega y monitorea servicios.
- Autor registrado: crea cuenta, inicia sesion, publica y edita sus posts.
- Visitante: consulta publicaciones y comentarios.

## Funcionalidades

- Registro y login con JWT.
- Gestion de perfil basica.
- CRUD de publicaciones.
- Creacion y eliminacion de comentarios.
- Visualizacion publica de posts.

## Valor del sistema

- Separa responsabilidades por microservicio.
- Facilita mantenimiento y escalabilidad.
- Simula escenario real de despliegue profesional.
- Permite aplicar Git, Docker y hosting en un flujo integrado.

## Alcance inicial

- Version web responsive.
- API Gateway + 4 microservicios.
- Persistencia en PostgreSQL por dominio.
- Contenerizacion con Docker Compose.
- Guia de despliegue en Render.
