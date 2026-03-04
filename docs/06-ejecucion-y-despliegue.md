# Fase 6 - Tipos de implementacion

## 1) Ejecucion local

- Levantar servicios con `npm run dev`.
- Cada microservicio escucha en su puerto local.

Variables ejemplo:

### users-service

```env
PORT=3002
DATABASE_URL=postgres://users:userspass@localhost:5433/usersdb
```

### auth-service

```env
PORT=3001
USERS_SERVICE_URL=http://localhost:3002
JWT_SECRET=super-secret-change-me
JWT_EXPIRES_IN=24h
```

### posts-service

```env
PORT=3003
DATABASE_URL=postgres://posts:postspass@localhost:5434/postsdb
USERS_SERVICE_URL=http://localhost:3002
```

### comments-service

```env
PORT=3004
DATABASE_URL=postgres://comments:commentspass@localhost:5435/commentsdb
USERS_SERVICE_URL=http://localhost:3002
POSTS_SERVICE_URL=http://localhost:3003
```

### api-gateway

```env
PORT=3000
AUTH_SERVICE_URL=http://localhost:3001
USERS_SERVICE_URL=http://localhost:3002
POSTS_SERVICE_URL=http://localhost:3003
COMMENTS_SERVICE_URL=http://localhost:3004
JWT_SECRET=super-secret-change-me
```

## 2) Ejecucion contenerizada

- Un solo comando con Docker Compose.
- Red interna entre contenedores.
- Dependencias aisladas por servicio.

## 3) Implementacion en hosting

- Se recomienda Render Blueprint o despliegue por servicio.
- Publicar al menos `api-gateway` y `auth-service`.

## 4) Integracion continua (explicacion conceptual)

CI es el proceso automatizado que:

- ejecuta pruebas en cada push/PR,
- valida calidad de codigo,
- construye imagenes Docker,
- prepara artefactos para despliegue.

CD puede extender CI para desplegar automaticamente al aprobar cambios.
