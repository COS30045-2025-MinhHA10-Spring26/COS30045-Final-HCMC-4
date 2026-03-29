# Police Enforcement Data Observatory

A public-interest data exploration site built on Australian road safety enforcement data published by BITRE and the National Road Safety Data Hub.

The site presents enforcement data as a series of narrative chapters, each anchored to real numbers from the cleaned dataset. Interactive charts respond to year, jurisdiction, and measure selections so readers can test whether national patterns hold under different lenses.

## Running locally

```
python -m http.server 4173
```

Then open `http://localhost:4173` in a browser.

## Currently available datasets

| Dataset | Status |
|---------|--------|
| Police enforcement fines | Live |
| Alcohol and drug tests | Planned |
| Positive breath tests | Planned |
| Positive drug tests | Planned |
| Data dictionary | Reference tab |

## Data sources

- [BITRE road safety enforcement data (2024)](https://www.bitre.gov.au/publications/2024/road-safety-enforcement-data)
- [National Road Safety Data Hub](https://datahub.roadsafety.gov.au/safe-systems/safe-road-use/police-enforcement)

## Project structure

```
index.html          Application shell
style.css           Visual system and responsive layout
script.js           Data loading, filtering, chart rendering, and tooltips
data/               Cleaned data assets and dataset catalog
scripts/            Workbook parsing and cleaning pipeline
MAINTAINERS.md      Contributor and future-agent documentation
```

For contributor guidelines and implementation details, see [MAINTAINERS.md](MAINTAINERS.md).
