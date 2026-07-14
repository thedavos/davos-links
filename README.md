<p align="center">
  <img src="public/brand-mark.svg" alt="Logo de atajo" width="120">
</p>

# atajo

**atajo by davosdo** — _La ruta corta._

atajo es un acortador de URLs autohospedado y nativo de Cloudflare. El producto
público usa la marca **atajo**; `davos-links` se conserva como nombre técnico del
proyecto y de su infraestructura.

## Funcionalidades

- Creación, edición, activación, desactivación y archivado de enlaces cortos.
- Rutas públicas configurables con validación de nombres reservados.
- Dashboard protegido con autenticación por correo y contraseña.
- Organización mediante tags y campañas.
- Analíticas generales y por enlace, con comparaciones por periodo.
- Desgloses por país, referente y dispositivo.
- Exportación de analíticas en CSV.
- Resolución rápida de enlaces mediante KV, con D1 como fuente canónica.
- Telemetría de clics en Workers Analytics Engine sin bloquear la redirección.

## Stack

- TanStack Start, TanStack Router, React y TypeScript
- Tailwind CSS
- Cloudflare Workers
- Cloudflare D1
- Cloudflare KV
- Cloudflare Workers Analytics Engine
- Better Auth
- Wrangler

## Requisitos

Antes de comenzar necesitas:

- Node.js compatible con las dependencias del proyecto.
- [pnpm](https://pnpm.io/) 11 o posterior.
- Una cuenta de Cloudflare con acceso a Workers.
- Wrangler autenticado mediante `pnpm exec wrangler login`.
- Una base de datos D1.
- Un namespace de KV.
- Un dataset de Workers Analytics Engine.
- Un dominio o subdominio dirigido al Worker para producción.

## Arquitectura

D1 almacena los datos canónicos de autenticación, workspaces, dominios,
enlaces, tags, campañas, claves API y métricas diarias. KV mantiene payloads
compactos para resolver redirecciones con la clave
`link:${host}:${short_path_normalized}`.

El flujo de una redirección pública es:

1. Interpretar y normalizar el host y la ruta solicitada.
2. Rechazar rutas internas o reservadas.
3. Consultar el enlace en KV.
4. Consultar D1 si no existe una entrada en caché.
5. Guardar en KV los enlaces activos con un TTL.
6. Respetar enlaces inactivos, archivados, vencidos y su comportamiento de fallback.
7. Registrar la telemetría con `ctx.waitUntil()`.
8. Responder con el tipo de redirección configurado en el enlace.

El dashboard consume rutas `/api/*` protegidas. Los bindings de Cloudflare y la
sesión de Better Auth permanecen exclusivamente en el servidor.

## Configuración

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Crear los recursos de Cloudflare

Puedes crearlos desde el dashboard de Cloudflare o con Wrangler:

```bash
pnpm exec wrangler d1 create <D1_DATABASE_NAME>
pnpm exec wrangler kv namespace create <KV_NAMESPACE_NAME>
```

Analytics Engine crea el dataset cuando el Worker comienza a escribir datos;
solo debes declarar un nombre de dataset en `wrangler.jsonc`.

### 3. Configurar `wrangler.jsonc`

Reemplaza los valores de la instalación incluida en el repositorio por los de
tu entorno:

```jsonc
{
  "name": "<WORKER_NAME>",
  "vars": {
    "BETTER_AUTH_URL": "https://<YOUR_DOMAIN>",
    "CLOUDFLARE_ACCOUNT_ID": "<CLOUDFLARE_ACCOUNT_ID>"
  },
  "d1_databases": [
    {
      "binding": "LINKS_DB",
      "database_name": "<D1_DATABASE_NAME>",
      "database_id": "<D1_DATABASE_ID>",
      "migrations_dir": "migrations"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "SHORT_LINK_CACHE",
      "id": "<KV_NAMESPACE_ID>"
    }
  ],
  "analytics_engine_datasets": [
    {
      "binding": "CLICK_ANALYTICS",
      "dataset": "<ANALYTICS_ENGINE_DATASET>"
    }
  ]
}
```

No cambies los nombres de los bindings sin actualizar también el código y los
tipos generados. Si usas otro nombre para la base D1, actualiza los scripts
`db:migrate`, `db:migrate:local` y `db:seed-demo:local`, que actualmente apuntan
al nombre técnico predeterminado del repositorio.

### 4. Configurar variables locales

Copia el archivo de ejemplo:

```bash
cp .dev.vars.example .dev.vars
```

Configura `.dev.vars` sin incorporarlo al control de versiones:

```dotenv
BETTER_AUTH_SECRET="<RANDOM_SECRET>"
BETTER_AUTH_URL="http://localhost:3000"
ANALYTICS_DATA_SOURCE="demo"

# Requeridos para consultar Analytics Engine en lugar de los datos demo.
CLOUDFLARE_ACCOUNT_ID="<CLOUDFLARE_ACCOUNT_ID>"
ANALYTICS_ENGINE_API_TOKEN="<ANALYTICS_ENGINE_API_TOKEN>"
```

| Variable o binding | Finalidad | Requerido |
| --- | --- | --- |
| `LINKS_DB` | Datos canónicos y base de Better Auth en D1. | Siempre |
| `SHORT_LINK_CACHE` | Caché KV de las redirecciones públicas. | Siempre |
| `CLICK_ANALYTICS` | Escritura de eventos en Analytics Engine. | Siempre |
| `BETTER_AUTH_SECRET` | Firma y protección de las sesiones. Debe ser un secreto aleatorio robusto. | Siempre; como secreto en producción |
| `BETTER_AUTH_URL` | Origen público de la aplicación y de Better Auth. | Siempre |
| `ANALYTICS_DATA_SOURCE` | Usa `demo` para desgloses locales; cualquier otro valor consulta Analytics Engine. | Opcional; recomendado en local |
| `CLOUDFLARE_ACCOUNT_ID` | Cuenta utilizada para consultar la API de Analytics Engine. | Solo para analíticas reales |
| `ANALYTICS_ENGINE_API_TOKEN` | Token con permiso de lectura de Account Analytics. | Solo para analíticas reales; como secreto |

El modo `demo` solo está permitido en orígenes locales y obtiene de D1 los
desgloses sembrados. Los totales y series temporales del dashboard también se
calculan a partir de D1.

### 5. Adaptar dominio y datos predeterminados

Esta versión todavía conserva algunos valores de la instalación original fuera
de `wrangler.jsonc`. Antes de desplegar una instancia propia, revisa:

- `src/lib/constants.ts`: origen público, dominio, workspace y dominio predeterminados.
- `src/lib/auth/server.ts`: `trustedOrigins`, fallback local y prefijo de cookies.
- `migrations/0001_initial_schema.sql`: workspace y dominio insertados inicialmente.
- `scripts/seed-demo-local.mjs` y `scripts/seed-demo-data.sql`: usuario y contenido demo.

Usa el mismo host en `BETTER_AUTH_URL`, los orígenes confiables, el dominio
predeterminado y la ruta de producción del Worker.

### 6. Preparar y ejecutar el entorno local

```bash
pnpm cf-typegen
pnpm db:migrate:local
pnpm db:seed-demo:local
pnpm dev
```

El script de seed crea un usuario local y muestra sus credenciales en la
terminal. Cámbialas dentro del script antes de usarlo si no quieres emplear los
valores demo incluidos en el repositorio.

## Autenticación y usuario inicial

Better Auth atiende en `/api/auth/*`. El inicio de sesión con correo y
contraseña está habilitado, pero el registro público está desactivado. Por ello,
debes crear intencionalmente al menos un usuario mediante uno de estos métodos:

- Ejecutar `pnpm db:seed-demo:local` para desarrollo local.
- Adaptar el script de seed para crear tus propias credenciales.
- Insertar un usuario y una cuenta de credenciales mediante un proceso
  administrativo seguro que genere un hash compatible con Better Auth.

No copies usuarios demo a producción ni almacenes contraseñas en texto plano.

## Scripts

| Comando | Descripción |
| --- | --- |
| `pnpm dev` | Inicia el servidor de desarrollo de Vite. |
| `pnpm generate-routes` | Regenera el árbol de rutas de TanStack Router. |
| `pnpm typecheck` | Ejecuta TypeScript sin emitir archivos. |
| `pnpm build` | Compila la aplicación y ejecuta el typecheck estricto. |
| `pnpm preview` | Previsualiza el build localmente. |
| `pnpm test` | Ejecuta Vitest con cobertura. |
| `pnpm test:watch` | Ejecuta Vitest en modo interactivo. |
| `pnpm deploy` | Compila y despliega el Worker con Wrangler. |
| `pnpm cf-typegen` | Regenera los tipos de bindings de Cloudflare. |
| `pnpm db:migrate:local` | Aplica las migraciones de D1 en local. |
| `pnpm db:seed-demo:local` | Crea el usuario y los datos demo locales. |
| `pnpm db:migrate` | Aplica las migraciones a la base D1 remota. |
| `pnpm ui:detect` | Ejecuta el detector visual de Impeccable. |

Ejecuta `pnpm generate-routes` después de agregar o cambiar rutas.

## Rutas principales

### Aplicación

- `/`: presentación pública.
- `/login`: inicio de sesión.
- `/dashboard`: resumen de actividad.
- `/dashboard/links`: listado de enlaces.
- `/dashboard/links/new`: creación de enlaces.
- `/dashboard/links/:id`: detalle y analíticas de un enlace.
- `/dashboard/links/:id/edit`: edición de un enlace.
- `/dashboard/tags`: gestión de tags.
- `/dashboard/campaigns`: gestión de campañas.
- `/dashboard/settings`: configuración.
- `/:shortPath`: redirección pública.

### API

- `/api/auth/*`
- `/api/links`, `/api/links/check-path` y `/api/links/:id`
- `/api/links/:id/disable` y `/api/links/:id/archive`
- `/api/links/:id/tags` y `/api/links/:id/campaigns`
- `/api/links/:id/analytics`
- `/api/tags` y `/api/tags/:id`
- `/api/campaigns` y `/api/campaigns/:id`
- `/api/analytics/overview`
- `/api/analytics/export.csv`
- `/health`

Las rutas `dashboard`, `api`, `health`, `assets`, `_build`, `_static`,
`favicon.ico`, `robots.txt`, `sitemap.xml`, `login`, `logout`, `register`,
`settings`, `admin` y `app` no se pueden usar como rutas cortas. También se
rechazan las rutas que comienzan con `dashboard/`, `api/`, `assets/`, `_build/`
o `_static/`.

## Despliegue

1. Configura el dominio, D1, KV y Analytics Engine en `wrangler.jsonc`.
2. Adapta los valores predeterminados descritos en la sección de configuración.
3. Genera un secreto fuerte y guárdalo en Cloudflare:

   ```bash
   pnpm exec wrangler secret put BETTER_AUTH_SECRET
   ```

4. Para consultar Analytics Engine, crea un token de API limitado a la cuenta
   con permiso `Account > Account Analytics > Read` y guárdalo:

   ```bash
   pnpm exec wrangler secret put ANALYTICS_ENGINE_API_TOKEN
   ```

5. Genera los tipos, migra D1, valida y despliega:

   ```bash
   pnpm cf-typegen
   pnpm db:migrate
   pnpm test
   pnpm deploy
   ```

6. Configura la ruta o el dominio personalizado del Worker en Cloudflare y
   verifica `/health`, el login y una redirección antes de compartir la instancia.

## Diseño y marca

La identidad pública es **atajo by davosdo**, con el lema _La ruta corta._ y
una marca geométrica en forma de A. La interfaz es clara, compacta y orientada a
herramientas para desarrolladores, con tipografías sans y mono, superficies
cálidas, azul atajo y coral de ruta. El sistema mantiene contraste WCAG AA,
foco visible y soporte para movimiento reducido.

El subconjunto de Dither Kit incluido en `src/components/dither-kit/` conserva
su referencia de procedencia en `src/components/dither-kit/UPSTREAM.md`.

## Limitaciones actuales

- Los desgloses de Analytics Engine están sujetos a la retención y límites de la
  plataforma de Cloudflare.
- La instancia parte de un único workspace y dominio predeterminados; no existe
  todavía un flujo público de onboarding multi-tenant.
- El registro público está deshabilitado y la creación de usuarios requiere un
  proceso administrativo.
- Cambiar los nombres técnicos de bindings o recursos exige actualizar la
  configuración, los scripts y los tipos generados de forma coordinada.
