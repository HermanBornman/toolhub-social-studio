#!/usr/bin/env python3
"""Create a target-ready, local-only JSON snapshot from the Phase 1 SQLite DB.

The snapshot can contain encrypted session/provider data and application records.
It must remain under the ignored tmp/ directory and must never be committed.
This script performs no network access and never writes to the source database.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import sqlite3
import tempfile
from pathlib import Path
from typing import Any


TABLE_ORDER = [
    "Branch",
    "User",
    "Product",
    "MascotMood",
    "Template",
    "ApplicationSetting",
    "SocialChannel",
    "PlanningRule",
    "AIUsage",
    "AuthThrottle",
    "Advertisement",
    "AdvertisementAsset",
    "SocialPost",
    "SocialPostChannel",
    "PublishingAttempt",
    "AdvertisementCaption",
    "ContentPlan",
    "ContentPlanItem",
    "PdfImport",
    "PdfImportPage",
    "AuditLog",
    "AuthSession",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        default="prisma/dev.phase1-backup.db",
        help="Consistent SQLite backup to read (opened read-only)",
    )
    parser.add_argument(
        "--output",
        default="tmp/postgres-migration-snapshot.json",
        help="Ignored local snapshot path",
    )
    return parser.parse_args()


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def convert_value(value: Any, declared_type: str) -> Any:
    if value is None:
        return None
    kind = declared_type.upper()
    if kind == "BOOLEAN":
        return bool(value)
    if kind == "DATETIME":
        # Prisma stores SQLite DateTime values as Unix epoch milliseconds.
        timestamp = dt.datetime.fromtimestamp(value / 1000, tz=dt.timezone.utc)
        return timestamp.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    if isinstance(value, bytes):
        raise ValueError("BLOB columns are not supported by this migration snapshot")
    return value


def main() -> None:
    args = parse_args()
    source = Path(args.source).resolve()
    output = Path(args.output).resolve()
    if not source.is_file():
        raise SystemExit("SQLite backup not found")
    if "tmp" not in {part.lower() for part in output.parts}:
        raise SystemExit("Snapshot output must stay in an ignored tmp directory")

    connection = sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise SystemExit("SQLite integrity check failed")
        fk_issues = connection.execute("PRAGMA foreign_key_check").fetchall()
        if fk_issues:
            raise SystemExit("SQLite foreign-key check failed")

        actual_tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master "
                "WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
        }
        if actual_tables != set(TABLE_ORDER):
            missing = sorted(set(TABLE_ORDER) - actual_tables)
            extra = sorted(actual_tables - set(TABLE_ORDER))
            raise SystemExit(f"Unexpected table inventory; missing={missing}, extra={extra}")

        snapshot_created_at = dt.datetime.now(dt.timezone.utc)
        snapshot: dict[str, Any] = {
            "formatVersion": 1,
            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "createdAt": snapshot_created_at.isoformat().replace("+00:00", "Z"),
            "tableOrder": TABLE_ORDER,
            "tables": {},
        }
        counts: dict[str, int] = {}
        for table in TABLE_ORDER:
            column_info = connection.execute(
                f"PRAGMA table_info({quote_identifier(table)})"
            ).fetchall()
            columns = [row[1] for row in column_info]
            declared_types = {row[1]: row[2] for row in column_info}
            rows = []
            for source_row in connection.execute(
                f"SELECT * FROM {quote_identifier(table)}"
            ):
                rows.append(
                    {
                        column: convert_value(source_row[column], declared_types[column])
                        for column in columns
                    }
                )
            snapshot["tables"][table] = {"columns": columns, "rows": rows}
            counts[table] = len(rows)

        expected_import_counts = dict(counts)
        for ephemeral_table in ("AuthSession", "AuthThrottle"):
            expected_import_counts[ephemeral_table] = sum(
                1
                for row in snapshot["tables"][ephemeral_table]["rows"]
                if dt.datetime.fromisoformat(row["expiresAt"].replace("Z", "+00:00"))
                > snapshot_created_at
            )
        snapshot["expectedImportCounts"] = expected_import_counts

        users = snapshot["tables"]["User"]["rows"]
        manager_matches = [
            row
            for row in users
            if row.get("name") == "Toolhub Store Manager Test"
            and row.get("mobileE164") == "+27794902832"
            and row.get("role") == "STORE_MANAGER"
            and row.get("active") is True
        ]
        active_mobile_matches = [
            row
            for row in users
            if row.get("mobileE164") == "+27794902832" and row.get("active") is True
        ]
        if len(manager_matches) != 1 or len(active_mobile_matches) != 1:
            raise SystemExit("Production Store Manager identity validation failed")

        output.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"))
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=output.parent, delete=False
        ) as temp_file:
            temp_file.write(payload)
            temp_name = temp_file.name
        os.replace(temp_name, output)

        print("SNAPSHOT_CREATED=YES")
        print(f"SNAPSHOT_SHA256={hashlib.sha256(payload.encode('utf-8')).hexdigest()}")
        print(f"TABLE_COUNT={len(TABLE_ORDER)}")
        print(f"TOTAL_ROWS={sum(counts.values())}")
        print(f"EXPECTED_IMPORT_ROWS={sum(expected_import_counts.values())}")
        print(f"EXCLUDED_EXPIRED_AUTH_ROWS={sum(counts.values()) - sum(expected_import_counts.values())}")
        for table in TABLE_ORDER:
            print(f"ROWS_{table}={counts[table]}")
        print("PRODUCTION_STORE_MANAGER_VALID=YES")
        print("ACTIVE_MOBILE_DUPLICATE=NO")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
