# Fase 4 - Desarrollo del sistema

## Requisitos minimos implementados

- Autenticacion/control de acceso:
  - Registro y login con JWT.
  - Middleware de autorizacion en API Gateway.
  - Control por roles: `admin`, `author`, `reader`.

- CRUD principal:
  - Posts: crear, listar, editar, eliminar.
  - Likes en posts.
  - Tags many-to-many + filtro por tags.
  - Busqueda por titulo + paginacion.
  - Subida de imagen y persistencia de URL.
  - Comentarios anidados.

- Interfaz funcional:
  - Frontend web multipantalla con Tailwind CSS en `api-gateway/public`.
  - Pantallas: `login.html`, `register.html`, `posts.html`, `profile.html`, `admin.html`.

- Persistencia de datos:
  - PostgreSQL para usuarios, posts y comentarios.

- Comunicacion entre microservicios:
  - Validaciones cruzadas entre servicios.

## Endpoints principales

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/verify`

### Users

- `POST /users`
- `GET /users/:id`
- `GET /internal/users/by-email/:email`
- `PATCH /users/:id`

### Posts

- `GET /posts`
- `POST /posts`
- `PUT /posts/:id`
- `DELETE /posts/:id`
- `POST /posts/:id/likes`
- `DELETE /posts/:id/likes`
- `GET /tags`
- `GET /stats`

### Comments

- `GET /comments/post/:postId`
- `POST /comments`
- `DELETE /comments/:id`
- `GET /comments/stats`
