# Fase 9 - Checklist de entrega

## 1) Arranque tecnico

- Levantar stack con Docker:

```bash
docker compose up --build -d
```

- Ejecutar smoke checks:

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-local.ps1
```

## 2) Flujo funcional minimo

- Login y registro funcionan.
- `posts.html`: lista, filtro, busqueda, like, navegacion a detalle.
- `post.html`: lectura completa + comentarios visibles.
- `my-posts.html` (author/admin): crear, editar, eliminar, comentar.
- `admin.html` (admin): dashboard y usuarios.

## 3) Validacion de roles

- `reader`: no ve acciones de CRUD de posts.
- `author`: puede gestionar solo sus posts en `my-posts.html`.
- `admin`: acceso total + panel admin.

## 4) Git y release

- Ramas de feature cerradas via PR.
- `main` actualizado y limpio.
- Ultimo `git status` sin cambios.

## 5) Cierre de demo

- Tener dos usuarios de prueba listos (`author` y `admin`).
- Mostrar rutas clave en orden:
  - `/posts.html`
  - `/post.html?id=<id>`
  - `/my-posts.html`
  - `/admin.html`

