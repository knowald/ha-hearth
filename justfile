default:
    @just --list

up *args:
    docker compose -f docker-compose.dev.yml up {{args}}

backup-hearth:
    @mkdir -p data/backups
    @cp data/hearth.yaml "data/backups/hearth-$(date +%Y%m%d-%H%M%S).yaml"
    @echo "Backed up Hearth configuration to data/backups/"
