# Producción: bootstrap de base de datos

El backend de MalaFama usa Sequelize + migraciones SQL/JS.

## Problema común
En producción, si apuntas a una base de datos vacía (sin tablas), las migraciones tipo `ALTER TABLE ...` fallan porque las tablas base aún no existen.

## Solución (automática)
El backend ahora hace **bootstrap automático** cuando detecta que faltan tablas core (por ejemplo `usuarios` o `locales`):

1. Crea la extensión `uuid-ossp` si no existe.
2. Ejecuta `sequelize.sync()` cargando los modelos y relaciones.
3. Luego ejecuta las migraciones incrementales.

Esto permite que un despliegue en una DB nueva cree todas las tablas *con la estructura real definida por los modelos*, sin tener que ejecutar manualmente un `schema.sql`.

## Obtener un schema.sql “real” (opcional)
Si quieres un `schema.sql` completo, no lo mantengas a mano: expórtalo desde una base que ya funciona:

- Linux/macOS: `scripts/export-schema.sh`
- Windows: `scripts/export-schema.ps1`

Ejemplo (Linux):

```bash
DB_HOST=localhost DB_PORT=5432 DB_NAME=malafama DB_USER=postgres DB_PASSWORD=... ./scripts/export-schema.sh
```

Genera `database/schema.sql` usando `pg_dump --schema-only`.
