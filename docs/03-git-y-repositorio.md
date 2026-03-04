# Fase 3 - Configuracion de repositorio y Git

## Pasos realizados/sugeridos

1. Inicializar repositorio:

```bash
git init
```

2. Crear ramas de trabajo:

```bash
git checkout -b develop
git checkout -b feature/auth-service
git checkout -b feature/users-service
git checkout -b feature/posts-comments
```

3. Commits organizados por modulo:

```bash
git add services/auth-service
git commit -m "feat(auth): implement register and login with JWT"
```

4. Pull Request

- Crear PR de cada `feature/*` a `develop`.
- Revisar y aprobar.
- Merge final de `develop` a `main`.

## Evidencia esperada para evaluacion

- Historial con mensajes claros.
- Uso de ramas.
- Al menos un PR documentado (captura).
