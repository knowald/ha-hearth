default:
    @just --list

up *args:
    docker compose --env-file .env.docker -f docker-compose.dev.yml up {{args}}

backup-hearth:
    @mkdir -p data/backups
    @cp data/hearth.yaml "data/backups/hearth-$(date +%Y%m%d-%H%M%S).yaml"
    @echo "Backed up Hearth configuration to data/backups/"

translations-check *args:
    node scripts/check-translations.mjs {{args}}

translations-missing locale *args:
    node scripts/translations-missing.mjs {{locale}} {{args}}

translations-apply locale file:
    node scripts/translations-apply.mjs {{locale}} {{file}}

hooks:
    git config core.hooksPath .githooks
    @echo "Git hooks now run from .githooks/"
