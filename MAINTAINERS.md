# Maintainer Notes

This document is for future maintainers and contributors to the Police Enforcement Data Observatory.

## Project Structure

- `index.html` — Application shell and semantic markup
- `style.css` — Visual system, responsive layout, and component styles
- `script.js` — Data loading, filtering, chart rendering, and tooltip interactions
- `scripts/build_police_enforcement_data.py` — Workbook parsing and cleaning pipeline
- `data/catalog.json` — Dataset registry (source of truth for available tabs)
- `data/*.cleaned.json` — Normalized record-level exports
- `data/*.summary.json` — Aggregates, quality checks, and metadata
- `data/*.cleaned.csv` — Analysis-friendly CSV exports

## Data Workflow

1. Place the source workbook in `data/`
2. Run `python scripts/build_police_enforcement_data.py`
3. Serve the site locally: `python -m http.server 4173`
4. Open `http://localhost:4173` in a browser

## Adding a New Dataset

1. **Add metadata to `data/catalog.json`**  
   Create a new entry with:
   - `key`: Unique identifier for the dataset
   - `title` and `short_title`: Display names
   - `description`: One-sentence summary
   - `status`: `"ready"`, `"planned"`, or `"reference"`
   - `expected_source_file`: Name of the source workbook
   - `hero`: Eyebrow, headline, and deck text for the hero section
   - `story_sections`: Planned narrative chapters
   - `planned_visuals`: List of intended charts
   - `expected_fields`: Schema hints for the cleaner
   - `downloads`: File metadata for the download section

2. **Create or extend the cleaning script**  
   If the new dataset has a different schema, extend `scripts/build_police_enforcement_data.py` to:
   - Parse the source workbook
   - Normalize dates, categories, and numeric fields
   - Preserve zero values as observed data
   - Emit cleaned JSON, CSV, and summary outputs

3. **Update METRIC_LABELS if needed**  
   If the workbook introduces new offence categories, add them to the `METRIC_LABELS` dictionary in the cleaning script.

4. **Test locally**  
   Run the cleaning pipeline and serve the site to verify:
   - Landing section renders correct narrative
   - All charts display and respond to filters
   - Tooltips show correct values
   - Download links point to the right files

## Design Principles

- **Narrative-first**: Each dataset tells a story. The UI should make that story visible, not hide it behind controls.
- **Data as public interest**: This is not a dashboard for operators. It is a public-facing explanation of what is being measured and why it matters.
- **Scaffold, don't hardcode**: New datasets plug into `catalog.json` and reuse the same story layout. Avoid adding special cases in the UI.
- **Keep cleaning visible**: Quality notes and methodological caveats stay part of the story. Users should understand what they are seeing and where caution is needed.

## Browser Testing

The site is tested in Thorium Browser via Playwright CLI:

```bash
playwright-cli open http://localhost:4173
playwright-cli snapshot
playwright-cli screenshot --filename=check.png
playwright-cli close
```

## Git Hygiene

- Commits should be atomic and message should explain the "why"
- Do not commit generated data assets unless they are part of a release
- Keep the git history readable for future collaborators

## Future Work

- Import the remaining BITRE files (alcohol/drug tests, positive breath tests, positive drug tests)
- Add cross-chart linked highlighting
- Consider adding annotations for major policy or technology shifts in the time series
- Expand the data dictionary tab into a searchable glossary
