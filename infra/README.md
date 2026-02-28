# Infra

Infrastructure entrypoints are currently:

- `docker-compose.yml` at repository root.
- `.env.example` for local environment variable template.

Next step in refactor:

- move compose and related manifests under this directory,
- keep root wrappers for backward compatibility.
