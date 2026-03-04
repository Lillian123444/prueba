# Fase 7 - Despliegue en Render

## Opcion A: desplegar API Gateway (recomendada)

1. Crear repositorio en GitHub y subir el proyecto.
2. Entrar a Render -> New -> Web Service.
3. Conectar repo.
4. Configurar:
- Root Directory: `api-gateway`
- Build Command: `npm install`
- Start Command: `npm start`
5. Definir variables:
- `AUTH_SERVICE_URL`
- `USERS_SERVICE_URL`
- `POSTS_SERVICE_URL`
- `COMMENTS_SERVICE_URL`
- `JWT_SECRET`

## Opcion B: Render Blueprint con `render.yaml`

- Subir archivo `render.yaml` del proyecto.
- Render crea servicios y base PostgreSQL segun blueprint.

## Evidencia solicitada

- URL publica funcional.
- Captura del panel de Render.
- Captura del sistema abierto en movil.

## Prueba movil

- Abrir URL publica desde navegador movil.
- Validar login y visualizacion de posts.
- Adjuntar capturas en `docs/evidencias/`.
