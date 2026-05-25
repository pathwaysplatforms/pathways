# Pathways Scrapers

Python scraper system for populating Supabase with immigration data.

## Two scrapers

- **pathway_scraper.py** — Fetches official immigration pages, chunks and
  embeds them into pgvector. Runs every 7 days via GitHub Actions.
- **draws_scraper.py** — Fetches draw result pages, parses structured data
  (cutoff scores, invitation counts), upserts into immigration_draws table.
  Runs every 2 days via GitHub Actions.

## Local development

```bash
cd scrapers
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # fill in your keys
python -m scrapers.pathway_scraper
python -m scrapers.draws_scraper
```

## Branch policy

Workflows currently target the `develop` branch. When the project promotes
to `main`, update the `ref:` and `branches:` fields in both workflow YAMLs
and update this note.

## Adding a new country

1. Add URL entries to `config/sources.yaml` under `pathways:` and/or `draws:`
2. If the country has draw rounds, create `parsers/{country}_draws.py`
3. Test locally with `python -m scrapers.draws_scraper`
4. Open a PR to `develop`
