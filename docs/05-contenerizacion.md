# Fase 5 - Contenerizacion

## Dockerfile por servicio

Cada servicio incluye su `Dockerfile` con:

- Base `node:20-alpine`
- Instalacion de dependencias
- Copia de codigo
- Exposicion de puerto
- Comando de inicio

## Docker Compose

Archivo: `docker-compose.yml`

Incluye:

- 3 bases de datos PostgreSQL (una por dominio)
- 4 microservicios de backend
- API Gateway con frontend

## Ejecucion

```bash
docker compose up --build
```

## Evidencia solicitada

- Captura de `docker compose ps`
- Captura de contenedores activos en Docker Desktop
- Captura de `http://localhost:3000`
