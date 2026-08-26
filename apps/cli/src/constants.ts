export const VERSION = '1.5.1'

// The LearnOrbit application image release line. `release.yaml` publishes one
// immutable tag per `lo-X.Y.Z` git tag — `lo-1.0.0` → `:1.0.0` — and
// deliberately never `:latest` (docs/DEPLOYMENT_PLAN.md §12.4), so a default
// install has to name a concrete version. This is that version; bump it when a
// new `lo-` tag is published.
//
// It is deliberately its own number. VERSION above is this CLI's npm version
// (upstream's `cli-*` release line), and apps/web|collab|api carry the
// inherited upstream application version — neither describes what LearnOrbit
// publishes to ghcr.io/williammuigai612-cell/learnorbit.
export const APP_IMAGE_VERSION = '1.0.0'
export const APP_IMAGE = `ghcr.io/williammuigai612-cell/learnorbit:${APP_IMAGE_VERSION}`
export const DEV_IMAGE = 'ghcr.io/williammuigai612-cell/learnorbit:dev'
export const NGINX_IMAGE = 'nginx:alpine'
export const POSTGRES_IMAGE = 'pgvector/pgvector:pg16'
export const POSTGRES_AI_IMAGE = 'pgvector/pgvector:pg16'
export const REDIS_IMAGE = 'redis:7.2.3-alpine'
export const HEALTH_CHECK_URL_PATH = '/api/v1/health'
export const HEALTH_CHECK_TIMEOUT_MS = 180_000 // 3 minutes
export const HEALTH_CHECK_INTERVAL_MS = 3_000
export const CONFIG_FILENAME = 'learnhouse.config.json'

// ── Enterprise Edition ───────────────────────────────────────────────────────
// EE images are pulled from the license-gated registry; the license key is the
// docker-login password.
export const EE_REGISTRY = 'images.learnhouse.app'
export const EE_REGISTRY_USERNAME = 'license'
export const EE_BACKEND_IMAGE = 'images.learnhouse.app/enterprise-backend'
export const EE_FRONTEND_IMAGE = 'images.learnhouse.app/enterprise-frontend'
export const EE_COLLAB_IMAGE = 'images.learnhouse.app/enterprise-collab'
export const EE_LICENSE_SERVER = 'https://partners.learnhouse.app'
export const EE_DEFAULT_IMAGE_TAG = 'prod'
export const INSTANCE_INFO_PATH = '/api/v1/instance/info'
export const EE_READY_TIMEOUT_MS = 360_000 // 6 minutes (image pull + license activation)
