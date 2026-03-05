# Blog con autenticacion usando microservicios

Proyecto completo para la practica integradora. Implementa un blog funcional con registro/login, CRUD de publicaciones y comentarios, usando una arquitectura de microservicios, Docker y despliegue en hosting.

## 1. Sistema implementado

- **Tema**: Blog con autenticacion.
- **Microservicios obligatorios**:
  - `auth-service`: registro, login, validacion JWT.
  - `users-service`: gestion de usuarios y perfil.
  - `posts-service`: CRUD de publicaciones (servicio principal del negocio).
  - `comments-service`: operaciones de comentarios.
- **Componente de integracion**:
  - `api-gateway`: orquesta llamadas entre servicios y sirve el frontend.

## Pantallas del frontend (Tailwind CSS)

- `login.html`: inicio de sesion.
- `register.html`: registro con seleccion de rol.
- `posts.html`: muro principal de publicaciones y comentarios.
- `profile.html`: edicion de perfil.
- `admin.html`: panel exclusivo de administrador.

## Funcionalidades nuevas implementadas

- Likes en publicaciones.
- Comentarios con soporte de respuestas anidadas.
- Tags con relacion many-to-many (`posts` <-> `tags`).
- Filtro por tag.
- Paginacion de publicaciones.
- Buscador por titulo.
- Subida de imagen en posts (se guarda URL).
- Mini dashboard admin con estadisticas basicas.

## Roles implementados

- `reader`: puede leer y comentar.
- `author`: puede crear/editar/eliminar sus posts y comentar.
- `admin`: control total (posts, comentarios y panel de usuarios).

## 2. Arquitectura

```text
Frontend (api-gateway/public)
        |
        v
API Gateway (3000)
  |        |         |         |
  v        v         v         v
Auth     Users      Posts    Comments
(3001)   (3002)     (3003)   (3004)
           |          |         |
           v          v         v
        users-db   posts-db  comments-db
```

## 3. Estructura del repositorio

```text
api-gateway/
  src/
  public/
services/
  auth-service/
  users-service/
  posts-service/
  comments-service/
docs/
docker-compose.yml
```

## 4. Ejecucion local (sin contenedores)

### Requisitos

- Node.js 20+
- PostgreSQL (o usar solo las BD por Docker y correr servicios en local)

### Pasos

1. Instalar dependencias por servicio:

```bash
cd services/users-service && npm install
cd ../auth-service && npm install
cd ../posts-service && npm install
cd ../comments-service && npm install
cd ../../api-gateway && npm install
```

2. Configurar variables de entorno en cada servicio (puedes copiar desde el bloque en `docs/06-ejecucion-y-despliegue.md`).

3. Levantar cada servicio en una terminal distinta:

```bash
npm run dev
```

4. Abrir:

- `http://localhost:3000`

## 5. Ejecucion con Docker Compose

```bash
docker compose up --build
```

Accesos:

- Frontend + API Gateway: `http://localhost:3000`
- Auth: `http://localhost:3001/health`
- Users: `http://localhost:3002/health`
- Posts: `http://localhost:3003/health`
- Comments: `http://localhost:3004/health`

Para detener:

```bash
docker compose down
```

Para detener y borrar volumenes:

```bash
docker compose down -v
```

## 6. Pruebas obligatorias cubiertas

- Registro/Login: endpoints `/api/auth/register`, `/api/auth/login`.
- Operacion principal: CRUD de posts en `/api/posts`.
- Comunicacion entre microservicios:
  - `auth-service` llama a `users-service`.
  - `posts-service` valida autor en `users-service`.
  - `comments-service` valida post en `posts-service` y autor en `users-service`.
- Funcionamiento en contenedor: `docker compose up --build`.
- Hosting: guia en `docs/07-despliegue-render.md`.

## 7. Git y flujo de trabajo sugerido

```bash
git init
git checkout -b develop
git checkout -b feature/auth-service
git add .
git commit -m "feat: create auth service"
git push -u origin feature/auth-service
```

Luego crear Pull Request hacia `develop` y finalmente merge a `main`.

## 8. Documentacion de fases

- [Fase 1 - Analisis](./docs/01-analisis.md)
- [Fase 2 - Diseno](./docs/02-diseno-arquitectura.md)
- [Fase 3 - Git](./docs/03-git-y-repositorio.md)
- [Fase 4 - Desarrollo](./docs/04-desarrollo.md)
- [Fase 5 - Docker](./docs/05-contenerizacion.md)
- [Fase 6 - Tipos de implementacion](./docs/06-ejecucion-y-despliegue.md)
- [Fase 7 - Hosting](./docs/07-despliegue-render.md)
- [Fase 8 - Documentacion final](./docs/08-documentacion-final.md)
- [Fase 9 - Checklist de entrega](./docs/09-checklist-entrega.md)

## 9. Verificacion rapida pre-entrega

Con el stack levantado, ejecutar:

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-local.ps1
```

Si todos los checks salen en `OK`, la base tecnica esta lista para demo.

## 10. Defensa oral (guia rapida)

Ver `docs/08-documentacion-final.md`, seccion "Guion de defensa oral".
