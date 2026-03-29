from __future__ import annotations

import csv
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SOURCE_FILE = DATA_DIR / "police_enforcement_2024_fines.xlsx"
OUTPUT_RECORDS = DATA_DIR / "police_enforcement_2024_fines.cleaned.json"
OUTPUT_SUMMARY = DATA_DIR / "police_enforcement_2024_fines.summary.json"
OUTPUT_CSV = DATA_DIR / "police_enforcement_2024_fines.cleaned.csv"
OUTPUT_CATALOG = DATA_DIR / "catalog.json"

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

METRIC_LABELS = {
    "mobile_phone_use": "Mobile phone use",
    "non_wearing_seatbelts": "Seatbelt non-compliance",
    "speed_fines": "Speeding fines",
    "unlicensed_driving": "Unlicensed driving",
}

MEASURE_LABELS = {
    "fines": "Fines",
    "arrests": "Arrests",
    "charges": "Charges",
}


@dataclass
class WorkbookSheet:
    name: str
    rows: list[list[str]]


def load_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    values: list[str] = []
    for node in root.findall("main:si", NS):
        parts = [text_node.text or "" for text_node in node.iterfind(".//main:t", NS)]
        values.append("".join(parts))
    return values


def cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    raw_type = cell.attrib.get("t")
    value_node = cell.find("main:v", NS)
    inline_node = cell.find("main:is", NS)
    if raw_type == "s" and value_node is not None:
        return shared_strings[int(value_node.text)]
    if raw_type == "inlineStr" and inline_node is not None:
        return "".join(
            text.text or "" for text in inline_node.iterfind(".//main:t", NS)
        )
    return value_node.text if value_node is not None else ""


def column_index(reference: str) -> int:
    letters = "".join(character for character in reference if character.isalpha())
    index = 0
    for character in letters:
        index = (index * 26) + (ord(character.upper()) - 64)
    return index - 1


def read_workbook(path: Path) -> list[WorkbookSheet]:
    with zipfile.ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relationship_map = {
            node.attrib["Id"]: node.attrib["Target"] for node in relationships
        }
        shared_strings = load_shared_strings(archive)
        sheets: list[WorkbookSheet] = []

        for sheet in workbook.find("main:sheets", NS):
            relationship_id = sheet.attrib[
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            ]
            xml_path = "xl/" + relationship_map[relationship_id]
            root = ET.fromstring(archive.read(xml_path))
            parsed_rows: list[list[str]] = []

            for row in root.find("main:sheetData", NS).findall("main:row", NS):
                cells = row.findall("main:c", NS)
                if not cells:
                    continue
                max_index = max(column_index(cell.attrib["r"]) for cell in cells)
                values = [""] * (max_index + 1)
                for cell in cells:
                    values[column_index(cell.attrib["r"])] = cell_value(
                        cell, shared_strings
                    )
                parsed_rows.append(values)

            sheets.append(WorkbookSheet(name=sheet.attrib["name"], rows=parsed_rows))

        return sheets


def excel_serial_to_date(serial: str) -> str | None:
    try:
        days = float(serial)
    except (TypeError, ValueError):
        return None
    return (datetime(1899, 12, 30) + timedelta(days=days)).date().isoformat()


def clean_text(value: str) -> str | None:
    if value is None:
        return None
    normalized = re.sub(r"\s+", " ", str(value)).strip()
    return normalized or None


def clean_int(value: str) -> int:
    if value in (None, ""):
        return 0
    try:
        return int(float(value))
    except ValueError:
        return 0


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def metric_group(metric_key: str) -> str:
    if metric_key == "speed_fines":
        return "Speed enforcement"
    if metric_key == "mobile_phone_use":
        return "Distraction"
    if metric_key == "non_wearing_seatbelts":
        return "Vehicle safety"
    return "Licensing"


def build_records(sheet: WorkbookSheet) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    header = [
        clean_text(value) or f"column_{index + 1}"
        for index, value in enumerate(sheet.rows[0])
    ]
    required_columns = [
        "YEAR",
        "START_DATE",
        "END_DATE",
        "JURISDICTION",
        "LOCATION",
        "AGE_GROUP",
        "METRIC",
        "DETECTION_METHOD",
        "FINES",
        "ARRESTS",
        "CHARGES",
    ]
    missing_columns = [column for column in required_columns if column not in header]
    if missing_columns:
        raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")

    records: list[dict[str, Any]] = []
    quality = {
        "rows_seen": 0,
        "rows_emitted": 0,
        "rows_skipped": 0,
        "missing_required_values": defaultdict(int),
        "unknown_metric_keys": [],
    }
    unknown_metrics: set[str] = set()

    for row_index, row in enumerate(sheet.rows[1:], start=2):
        quality["rows_seen"] += 1
        row_map = {
            header[index]: clean_text(row[index]) if index < len(row) else None
            for index in range(len(header))
        }
        period_start = excel_serial_to_date(row_map.get("START_DATE"))
        period_end = excel_serial_to_date(row_map.get("END_DATE"))
        jurisdiction = row_map.get("JURISDICTION")
        metric_key = row_map.get("METRIC")

        required_values = {
            "YEAR": row_map.get("YEAR"),
            "START_DATE": period_start,
            "END_DATE": period_end,
            "JURISDICTION": jurisdiction,
            "LOCATION": row_map.get("LOCATION"),
            "AGE_GROUP": row_map.get("AGE_GROUP"),
            "METRIC": metric_key,
        }
        failed = False
        for column, value in required_values.items():
            if value is None:
                quality["missing_required_values"][column] += 1
                failed = True
        if failed:
            quality["rows_skipped"] += 1
            continue

        if metric_key not in METRIC_LABELS:
            unknown_metrics.add(metric_key)

        fines = clean_int(row_map.get("FINES"))
        arrests = clean_int(row_map.get("ARRESTS"))
        charges = clean_int(row_map.get("CHARGES"))

        record = {
            "id": f"fines-{row_index - 1:05d}",
            "source_file": SOURCE_FILE.name,
            "dataset_key": "police-enforcement-fines",
            "series_year": clean_int(row_map.get("YEAR")),
            "period_start": period_start,
            "period_end": period_end,
            "period_label": date.fromisoformat(period_start).strftime("%b %Y"),
            "jurisdiction": jurisdiction,
            "jurisdiction_slug": slugify(jurisdiction),
            "location": row_map.get("LOCATION"),
            "location_slug": slugify(row_map.get("LOCATION")),
            "age_group": row_map.get("AGE_GROUP"),
            "age_group_slug": slugify(row_map.get("AGE_GROUP")),
            "metric_key": metric_key,
            "metric_label": METRIC_LABELS.get(
                metric_key, metric_key.replace("_", " ").title()
            ),
            "metric_group": metric_group(metric_key),
            "detection_method": row_map.get("DETECTION_METHOD") or "Unknown",
            "detection_method_slug": slugify(
                row_map.get("DETECTION_METHOD") or "Unknown"
            ),
            "fines": fines,
            "arrests": arrests,
            "charges": charges,
            "total_actions": fines + arrests + charges,
        }
        records.append(record)
        quality["rows_emitted"] += 1

    quality["missing_required_values"] = dict(
        sorted(quality["missing_required_values"].items())
    )
    quality["unknown_metric_keys"] = sorted(unknown_metrics)
    return records, quality


def aggregate_timeseries(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    monthly: dict[str, dict[str, Any]] = {}
    for record in records:
        period = record["period_start"]
        bucket = monthly.setdefault(
            period,
            {
                "period_start": period,
                "period_label": record["period_label"],
                "fines": 0,
                "arrests": 0,
                "charges": 0,
                "total_actions": 0,
            },
        )
        bucket["fines"] += record["fines"]
        bucket["arrests"] += record["arrests"]
        bucket["charges"] += record["charges"]
        bucket["total_actions"] += record["total_actions"]
    return [monthly[key] for key in sorted(monthly.keys())]


def aggregate_latest_year(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    latest_year = max(record["series_year"] for record in records)
    grouped: dict[tuple[str, str], int] = defaultdict(int)
    for record in records:
        if record["series_year"] != latest_year:
            continue
        grouped[(record["jurisdiction"], record["metric_label"])] += record[
            "total_actions"
        ]

    rows = [
        {
            "jurisdiction": jurisdiction,
            "metric_label": metric_label,
            "total_actions": total_actions,
        }
        for (jurisdiction, metric_label), total_actions in grouped.items()
    ]
    return sorted(
        rows,
        key=lambda row: (
            -row["total_actions"],
            row["jurisdiction"],
            row["metric_label"],
        ),
    )


def aggregate_metric_totals(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for record in records:
        bucket = grouped.setdefault(
            record["metric_key"],
            {
                "metric_key": record["metric_key"],
                "metric_label": record["metric_label"],
                "metric_group": record["metric_group"],
                "fines": 0,
                "arrests": 0,
                "charges": 0,
                "total_actions": 0,
            },
        )
        bucket["fines"] += record["fines"]
        bucket["arrests"] += record["arrests"]
        bucket["charges"] += record["charges"]
        bucket["total_actions"] += record["total_actions"]
    return sorted(grouped.values(), key=lambda row: -row["total_actions"])


def aggregate_detection_mix(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    latest_year = max(record["series_year"] for record in records)
    grouped: dict[tuple[str, str], int] = defaultdict(int)
    for record in records:
        if record["series_year"] != latest_year:
            continue
        grouped[(record["metric_label"], record["detection_method"])] += record["fines"]
    rows = [
        {"metric_label": metric_label, "detection_method": method, "fines": fines}
        for (metric_label, method), fines in grouped.items()
    ]
    return sorted(
        rows,
        key=lambda row: (row["metric_label"], -row["fines"], row["detection_method"]),
    )


def aggregate_jurisdiction_totals(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    latest_year = max(record["series_year"] for record in records)
    grouped: dict[str, dict[str, Any]] = {}
    for record in records:
        if record["series_year"] != latest_year:
            continue
        bucket = grouped.setdefault(
            record["jurisdiction"],
            {
                "jurisdiction": record["jurisdiction"],
                "fines": 0,
                "arrests": 0,
                "charges": 0,
                "total_actions": 0,
            },
        )
        bucket["fines"] += record["fines"]
        bucket["arrests"] += record["arrests"]
        bucket["charges"] += record["charges"]
        bucket["total_actions"] += record["total_actions"]
    return sorted(grouped.values(), key=lambda row: -row["total_actions"])


def build_summary(
    records: list[dict[str, Any]], quality: dict[str, Any]
) -> dict[str, Any]:
    latest_year = max(record["series_year"] for record in records)
    latest_records = [
        record for record in records if record["series_year"] == latest_year
    ]
    totals = {
        "fines": sum(record["fines"] for record in records),
        "arrests": sum(record["arrests"] for record in records),
        "charges": sum(record["charges"] for record in records),
        "total_actions": sum(record["total_actions"] for record in records),
    }
    latest_totals = {
        "fines": sum(record["fines"] for record in latest_records),
        "arrests": sum(record["arrests"] for record in latest_records),
        "charges": sum(record["charges"] for record in latest_records),
        "total_actions": sum(record["total_actions"] for record in latest_records),
    }
    period_starts = sorted({record["period_start"] for record in records})
    period_ends = sorted({record["period_end"] for record in records})
    return {
        "dataset_key": "police-enforcement-fines",
        "title": "Police enforcement fines",
        "description": "Cleaned monthly police enforcement records published by BITRE and the National Road Safety Data Hub.",
        "source": {
            "name": "Bureau of Infrastructure and Transport Research Economics (BITRE)",
            "publication_url": "https://www.bitre.gov.au/publications/2024/road-safety-enforcement-data",
            "dataset_url": "https://datahub.roadsafety.gov.au/safe-systems/safe-road-use/police-enforcement",
            "source_file": SOURCE_FILE.name,
        },
        "schema_version": 1,
        "generated_at": datetime.now(UTC)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "record_count": len(records),
        "latest_year": latest_year,
        "period_coverage": {
            "start": period_starts[0],
            "end": period_ends[-1],
            "count": len(period_starts),
        },
        "totals": totals,
        "latest_year_totals": latest_totals,
        "dimensions": {
            "jurisdictions": sorted({record["jurisdiction"] for record in records}),
            "locations": sorted({record["location"] for record in records}),
            "age_groups": sorted({record["age_group"] for record in records}),
            "metrics": [
                {"key": key, "label": METRIC_LABELS[key]}
                for key in sorted({record["metric_key"] for record in records})
            ],
            "measures": [
                {"key": key, "label": label} for key, label in MEASURE_LABELS.items()
            ],
            "detection_methods": sorted(
                {record["detection_method"] for record in records}
            ),
        },
        "quality": quality,
        "aggregates": {
            "timeseries": aggregate_timeseries(records),
            "metric_totals": aggregate_metric_totals(records),
            "latest_year_by_jurisdiction": aggregate_jurisdiction_totals(records),
            "latest_year_metric_by_jurisdiction": aggregate_latest_year(records),
            "latest_year_detection_mix": aggregate_detection_mix(records),
        },
        "notes": [
            "The source workbook mixes police-issued and camera-issued enforcement depending on metric and jurisdiction.",
            "Zero values are retained as observed values rather than treated as missing data.",
            "Date serials from Excel are converted to ISO 8601 calendar dates for easier downstream use.",
            "Future datasets can be added to catalog.json and processed with a similar normalized schema.",
        ],
    }


def write_csv(records: list[dict[str, Any]], path: Path) -> None:
    fieldnames = list(records[0].keys())
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)


def write_catalog(summary: dict[str, Any]) -> None:
    catalog = {
        "datasets": [
            {
                "key": summary["dataset_key"],
                "title": summary["title"],
                "short_title": "Fines",
                "description": summary["description"],
                "status": "ready",
                "source_file": summary["source"]["source_file"],
                "summary_file": OUTPUT_SUMMARY.name,
                "records_file": OUTPUT_RECORDS.name,
                "csv_file": OUTPUT_CSV.name,
                "category": "Police enforcement",
                "reference_period": f"{summary['period_coverage']['start']} to {summary['period_coverage']['end']}",
                "record_count": summary["record_count"],
                "schema_version": summary["schema_version"],
                "hero": {
                    "eyebrow": "Dataset now available",
                    "headline": "How visible enforcement responds to risky road behaviour",
                    "deck": "This release tracks the scale and mix of fines, charges, and arrests across Australian jurisdictions, giving policy and research users a public-interest view of where enforcement is concentrated and how it is detected.",
                },
                "story_sections": [
                    {
                        "slug": "national-pattern",
                        "title": "National pattern",
                        "summary": "Start with the long-run national series, then move down into metric-specific and jurisdiction-specific pressure points.",
                    },
                    {
                        "slug": "enforcement-mix",
                        "title": "Enforcement mix",
                        "summary": "Separate police-issued and camera-led activity so users can distinguish behavioural monitoring from direct officer enforcement.",
                    },
                ],
                "future_agent_notes": [
                    "Append new datasets to this catalog instead of hardcoding cards in the UI.",
                    "Keep normalized field names aligned with the current cleaned JSON structure.",
                    "If a workbook introduces new metrics, update METRIC_LABELS and metric grouping rules.",
                ],
                "planned_visuals": [
                    "Long-run national trend with hoverable period values",
                    "Metric comparison showing where total actions are concentrated",
                    "Jurisdiction-by-metric matrix for identifying state and territory hotspots",
                    "Detection-method breakdown to compare police-issued and camera-led fines",
                ],
                "downloads": [
                    {
                        "title": "Original workbook",
                        "kind": "xlsx",
                        "href": summary["source"]["source_file"],
                        "status": "ready",
                    },
                    {
                        "title": "Cleaned CSV",
                        "kind": "csv",
                        "href": OUTPUT_CSV.name,
                        "status": "ready",
                    },
                    {
                        "title": "Cleaned JSON",
                        "kind": "json",
                        "href": OUTPUT_RECORDS.name,
                        "status": "ready",
                    },
                    {
                        "title": "Summary JSON",
                        "kind": "json",
                        "href": OUTPUT_SUMMARY.name,
                        "status": "ready",
                    },
                ],
            },
            {
                "key": "police-enforcement-alcohol-drug-tests",
                "title": "Alcohol and drug tests",
                "short_title": "Alcohol and drug tests",
                "description": "Scaffold for BITRE roadside alcohol and drug testing counts, rates, and supporting time-series visuals.",
                "status": "planned",
                "category": "Police enforcement",
                "expected_source_file": "police_enforcement_2024_alcohol_drug_tests.xlsx",
                "reference_period": "Expected 2008 to 2024 coverage",
                "hero": {
                    "eyebrow": "Dataset pending import",
                    "headline": "Testing volume is the first story, not just the positives",
                    "deck": "This tab is reserved for the test-volume dataset so future work can tell the compliance story before moving to detected offences.",
                },
                "story_sections": [
                    {
                        "slug": "testing-coverage",
                        "title": "Testing coverage",
                        "summary": "Show how roadside testing activity changes over time and by jurisdiction.",
                    },
                    {
                        "slug": "licence-holder-rates",
                        "title": "Licence-holder rates",
                        "summary": "Normalize test volumes so cross-jurisdiction comparisons are fairer.",
                    },
                ],
                "planned_visuals": [
                    "Trend line for annual alcohol and drug tests conducted",
                    "Jurisdiction ranking for tests per 10,000 licence holders",
                    "Narrative callout linking testing intensity to subsequent positive-rate datasets",
                ],
                "expected_fields": [
                    "YEAR",
                    "JURISDICTION",
                    "TEST_TYPE",
                    "TESTS_CONDUCTED",
                    "LICENCE_RATE",
                ],
                "future_agent_notes": [
                    "Create a cleaner that preserves test volume and standardized licence-holder rates.",
                    "Link this tab narratively to the positive-breath and positive-drug tabs.",
                ],
                "downloads": [
                    {
                        "title": "Alcohol and drug tests workbook",
                        "kind": "xlsx",
                        "href": "police_enforcement_2024_alcohol_drug_tests.xlsx",
                        "status": "planned",
                    }
                ],
            },
            {
                "key": "police-enforcement-positive-breath-tests",
                "title": "Positive breath tests",
                "short_title": "Positive breath tests",
                "description": "Scaffold for positive random breath test results and rates over time.",
                "status": "planned",
                "category": "Police enforcement",
                "expected_source_file": "police_enforcement_2024_positive_breath_tests.xlsx",
                "reference_period": "Expected 2008 to 2024 coverage",
                "hero": {
                    "eyebrow": "Dataset pending import",
                    "headline": "Positive rates tell a different story than raw testing volume",
                    "deck": "This tab should explain whether reductions in drink-driving positives reflect stronger deterrence, changing testing patterns, or both.",
                },
                "story_sections": [
                    {
                        "slug": "positivity-rate",
                        "title": "Positivity rate",
                        "summary": "Plot the national trend in positive rates and call out breaks in pattern.",
                    },
                    {
                        "slug": "jurisdiction-rate",
                        "title": "Jurisdiction rate",
                        "summary": "Show per-licence-holder variation without losing the national picture.",
                    },
                ],
                "planned_visuals": [
                    "Dual-axis chart for tests conducted and positive-rate trend",
                    "State comparison using standardized rates",
                    "Story note tying drink-driving enforcement to fatal-crash risk behaviour context",
                ],
                "expected_fields": [
                    "YEAR",
                    "JURISDICTION",
                    "POSITIVE_TESTS",
                    "POSITIVE_RATE",
                ],
                "future_agent_notes": [
                    "Keep percentage fields numeric and expose both counts and rates.",
                    "Support a chart pairing absolute positives with percentage positivity.",
                ],
                "downloads": [
                    {
                        "title": "Positive breath tests workbook",
                        "kind": "xlsx",
                        "href": "police_enforcement_2024_positive_breath_tests.xlsx",
                        "status": "planned",
                    }
                ],
            },
            {
                "key": "police-enforcement-positive-drug-tests",
                "title": "Positive drug tests",
                "short_title": "Positive drug tests",
                "description": "Scaffold for positive roadside drug testing outcomes and rate-based comparison.",
                "status": "planned",
                "category": "Police enforcement",
                "expected_source_file": "police_enforcement_2024_positive_drug_tests.xlsx",
                "reference_period": "Expected 2008 to 2024 coverage",
                "hero": {
                    "eyebrow": "Dataset pending import",
                    "headline": "Drug-driving detection needs its own narrative, not a footnote",
                    "deck": "This future tab is intended to explain how test volume, positive rates, and state variation have evolved as roadside drug testing expanded nationally.",
                },
                "story_sections": [
                    {
                        "slug": "national-drug-pattern",
                        "title": "National drug-driving pattern",
                        "summary": "Explain the long rise in roadside drug testing and the recent decline in positivity rates.",
                    },
                    {
                        "slug": "state-outliers",
                        "title": "State outliers",
                        "summary": "Identify which jurisdictions report especially high or low positive rates per 10,000 licence holders.",
                    },
                ],
                "planned_visuals": [
                    "Trend line for positive drug test rate",
                    "Ranked comparison by jurisdiction",
                    "Annotation band describing major shifts after 2020",
                ],
                "expected_fields": [
                    "YEAR",
                    "JURISDICTION",
                    "POSITIVE_DRUG_TESTS",
                    "POSITIVE_RATE",
                ],
                "future_agent_notes": [
                    "Preserve both absolute counts and rates to support mixed charts.",
                    "Reuse shared tooltip and story-section components from the fines tab.",
                ],
                "downloads": [
                    {
                        "title": "Positive drug tests workbook",
                        "kind": "xlsx",
                        "href": "police_enforcement_2024_positive_drug_tests.xlsx",
                        "status": "planned",
                    }
                ],
            },
            {
                "key": "police-enforcement-dictionary",
                "title": "Data dictionary",
                "short_title": "Dictionary",
                "description": "Reference tab reserved for the official police enforcement data dictionary PDF.",
                "status": "reference",
                "category": "Documentation",
                "expected_source_file": "Road safety enforcement data dictionary 2024.pdf",
                "reference_period": "Reference material",
                "hero": {
                    "eyebrow": "Reference material",
                    "headline": "Definitions, caveats, and reporting scope belong in the same experience",
                    "deck": "This tab is for glossary-level context so future users can inspect caveats, offence definitions, and collection notes without leaving the site.",
                },
                "story_sections": [
                    {
                        "slug": "definitions",
                        "title": "Definitions",
                        "summary": "Map enforcement terms to plain-language explanations and original source definitions.",
                    },
                    {
                        "slug": "limitations",
                        "title": "Limitations",
                        "summary": "Keep data consistency caveats visible beside every analytical story.",
                    },
                ],
                "planned_visuals": [
                    "No chart required; this tab should foreground searchable definitions and caveats",
                    "Cross-links back to dataset tabs where each term is used",
                ],
                "future_agent_notes": [
                    "When the PDF is added, provide deep links into the glossary and methodology sections.",
                    "Mirror key caveats in dataset-specific story footers.",
                ],
                "downloads": [
                    {
                        "title": "Police enforcement data dictionary",
                        "kind": "pdf",
                        "href": "Road safety enforcement data dictionary 2024.pdf",
                        "status": "planned",
                    }
                ],
            },
        ]
    }
    OUTPUT_CATALOG.write_text(json.dumps(catalog, indent=2), encoding="utf-8")


def main() -> None:
    sheets = read_workbook(SOURCE_FILE)
    target_sheet = next(
        sheet for sheet in sheets if sheet.name == "police_enforcement_2024_fines"
    )
    records, quality = build_records(target_sheet)
    records.sort(
        key=lambda record: (
            record["period_start"],
            record["jurisdiction"],
            record["location"],
            record["age_group"],
            record["metric_label"],
            record["detection_method"],
        )
    )
    summary = build_summary(records, quality)

    OUTPUT_RECORDS.write_text(json.dumps(records, indent=2), encoding="utf-8")
    OUTPUT_SUMMARY.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    write_csv(records, OUTPUT_CSV)
    write_catalog(summary)


if __name__ == "__main__":
    main()
