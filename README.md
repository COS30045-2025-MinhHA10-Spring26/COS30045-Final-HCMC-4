# COS30045 Final - Police Enforcement Observatory

Static data exploration site for BITRE police enforcement data.

## Project structure

- `index.html` - application shell
- `style.css` - visual system and responsive layout
- `script.js` - data loading, filtering, and chart rendering
- `scripts/build_police_enforcement_data.py` - workbook parsing and cleaning pipeline
- `data/catalog.json` - dataset registry for the download cards and future additions
- `data/police_enforcement_2024_fines.cleaned.json` - normalized record-level export
- `data/police_enforcement_2024_fines.summary.json` - aggregates, quality checks, and metadata
- `data/police_enforcement_2024_fines.cleaned.csv` - analysis-friendly CSV export

## Data workflow

1. Place the source workbook in `data/`.
2. Run `python scripts/build_police_enforcement_data.py`.
3. Serve the site locally, for example with `python -m http.server`.

The cleaning script currently targets the fines workbook, but the output schema and `data/catalog.json` are set up so future datasets can be added without rewriting the UI.
