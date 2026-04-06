from __future__ import annotations

import csv
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SOURCE_FILE = DATA_DIR / "police_enforcement_2024_positive_breath_tests.xlsx"
OUTPUT_RECORDS = DATA_DIR / "police_enforcement_2024_positive_breath_tests.cleaned.json"
OUTPUT_SUMMARY = DATA_DIR / "police_enforcement_2024_positive_breath_tests.summary.json"
OUTPUT_CSV = DATA_DIR / "police_enforcement_2024_positive_breath_tests.cleaned.csv"

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

METRIC_LABELS = {
    "positive_breath_tests": "Positive breath tests",
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
        "COUNT",
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

        count = clean_int(row_map.get("COUNT"))
        fines = clean_int(row_map.get("FINES"))
        arrests = clean_int(row_map.get("ARRESTS"))
        charges = clean_int(row_map.get("CHARGES"))

        record = {
            "id": f"breath-{row_index - 1:05d}",
            "source_file": SOURCE_FILE.name,
            "dataset_key": "police-enforcement-positive-breath-tests",
            "series_year": clean_int(row_map.get("YEAR")),
            "period_start": period_start,
            "period_end": period_end,
            "period_label": str(clean_int(row_map.get("YEAR"))),
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
            "detection_method": row_map.get("DETECTION_METHOD") or "Unknown",
            "detection_method_slug": slugify(
                row_map.get("DETECTION_METHOD") or "Unknown"
            ),
            "count": count,
            "fines": fines,
            "arrests": arrests,
            "charges": charges,
            "total_actions": count + fines + arrests + charges,
        }
        records.append(record)
        quality["rows_emitted"] += 1

    quality["missing_required_values"] = dict(
        sorted(quality["missing_required_values"].items())
    )
    quality["unknown_metric_keys"] = sorted(unknown_metrics)
    return records, quality


def aggregate_timeseries(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    yearly: dict[int, dict[str, Any]] = {}
    for record in records:
        year = record["series_year"]
        bucket = yearly.setdefault(
            year,
            {
                "year": year,
                "positive_tests": 0,
                "fines": 0,
                "arrests": 0,
                "charges": 0,
                "total_actions": 0,
            },
        )
        bucket["positive_tests"] += record["count"]
        bucket["fines"] += record["fines"]
        bucket["arrests"] += record["arrests"]
        bucket["charges"] += record["charges"]
        bucket["total_actions"] += record["total_actions"]
    return [yearly[key] for key in sorted(yearly.keys())]


def aggregate_by_jurisdiction(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    latest_year = max(record["series_year"] for record in records)
    grouped: dict[str, dict[str, Any]] = {}
    for record in records:
        if record["series_year"] != latest_year:
            continue
        bucket = grouped.setdefault(
            record["jurisdiction"],
            {
                "jurisdiction": record["jurisdiction"],
                "positive_tests": 0,
                "fines": 0,
                "arrests": 0,
                "charges": 0,
                "total_actions": 0,
            },
        )
        bucket["positive_tests"] += record["count"]
        bucket["fines"] += record["fines"]
        bucket["arrests"] += record["arrests"]
        bucket["charges"] += record["charges"]
        bucket["total_actions"] += record["total_actions"]
    return sorted(grouped.values(), key=lambda row: -row["total_actions"])


def aggregate_by_jurisdiction_timeseries(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    grouped: dict[tuple[int, str], int] = defaultdict(int)
    for record in records:
        grouped[(record["series_year"], record["jurisdiction"])] += record["count"]
    rows = [
        {
            "year": year,
            "jurisdiction": jurisdiction,
            "positive_tests": count,
        }
        for (year, jurisdiction), count in grouped.items()
    ]
    return sorted(rows, key=lambda row: (row["year"], row["jurisdiction"]))


def build_summary(
    records: list[dict[str, Any]], quality: dict[str, Any]
) -> dict[str, Any]:
    latest_year = max(record["series_year"] for record in records)
    latest_records = [
        record for record in records if record["series_year"] == latest_year
    ]
    totals = {
        "total_positive_tests": sum(record["count"] for record in records),
        "total_fines": sum(record["fines"] for record in records),
        "total_arrests": sum(record["arrests"] for record in records),
        "total_charges": sum(record["charges"] for record in records),
        "total_actions": sum(record["total_actions"] for record in records),
    }
    latest_totals = {
        "total_positive_tests": sum(record["count"] for record in latest_records),
        "total_fines": sum(record["fines"] for record in latest_records),
        "total_arrests": sum(record["arrests"] for record in latest_records),
        "total_charges": sum(record["charges"] for record in latest_records),
        "total_actions": sum(record["total_actions"] for record in latest_records),
    }
    years = sorted({record["series_year"] for record in records})
    period_starts = sorted({record["period_start"] for record in records})
    period_ends = sorted({record["period_end"] for record in records})
    return {
        "dataset_key": "police-enforcement-positive-breath-tests",
        "title": "Positive breath tests",
        "description": "Cleaned annual police positive breath test records published by BITRE and the National Road Safety Data Hub.",
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
            "count": len(years),
        },
        "totals": totals,
        "latest_year_totals": latest_totals,
        "dimensions": {
            "jurisdictions": sorted({record["jurisdiction"] for record in records}),
            "locations": sorted({record["location"] for record in records}),
            "age_groups": sorted({record["age_group"] for record in records}),
        },
        "quality": quality,
        "aggregates": {
            "timeseries": aggregate_timeseries(records),
            "by_jurisdiction": aggregate_by_jurisdiction(records),
            "by_jurisdiction_timeseries": aggregate_by_jurisdiction_timeseries(records),
        },
        "notes": [
            "Data is reported at annual granularity only; no monthly or quarterly breakdown is available.",
            "The COUNT field represents positive breath test outcomes. Fines, arrests, and charges are recorded separately but are typically zero for this metric.",
            "Cross-jurisdiction comparisons should be read as indicative because state and territory reporting systems are not fully harmonised.",
            "Zero values are retained as observed values rather than treated as missing data.",
            "Date serials from Excel are converted to ISO 8601 calendar dates for easier downstream use.",
        ],
    }


def write_csv(records: list[dict[str, Any]], path: Path) -> None:
    fieldnames = list(records[0].keys())
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)


def main() -> None:
    sheets = read_workbook(SOURCE_FILE)
    target_sheet = next(sheet for sheet in sheets if "positiv" in sheet.name.lower())
    records, quality = build_records(target_sheet)
    records.sort(
        key=lambda record: (
            record["series_year"],
            record["jurisdiction"],
            record["location"],
            record["age_group"],
            record["detection_method"],
        )
    )
    summary = build_summary(records, quality)

    OUTPUT_RECORDS.write_text(json.dumps(records, indent=2), encoding="utf-8")
    OUTPUT_SUMMARY.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    write_csv(records, OUTPUT_CSV)

    print(f"Wrote {len(records)} records to {OUTPUT_RECORDS}")
    print(f"Wrote summary to {OUTPUT_SUMMARY}")
    print(f"Wrote CSV to {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
