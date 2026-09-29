"""Import a complete JSON snapshot into the isolated Django schema, atomically."""

import json
import os
from datetime import datetime
from pathlib import Path

import httpx
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from hub import models, ranking

TABLES = {
    "profiles": models.User,
    "board_games": models.Game,
    "user_game_collection": models.UserGame,
    "game_ratings": models.UserGame,
    "tier_placements": models.UserGame,
    "game_expansions": models.Expansion,
    "expansion_tier_placements": models.ExpansionPlacement,
    "achievements": models.Achievement,
    "user_achievements": models.Award,
    "bounties": models.Bounty,
    "feedback": models.Feedback,
    "score_snapshots": models.DailyScore,
    "user_activity": models.Activity,
    "game_rules": models.Rulebook,
    "rules_answer_cache": models.RulesAnswer,
    "rules_agent_runs": models.RulesRun,
}
ALIASES = {
    "bgg_id": "game_id",
    "game_bgg_id": "game_id",
    "added_at": "created_at",
    "created_by": "created_by_id",
    "claimed_by": "claimed_by_id",
}


ASSOCIATIONS = {
    "user_game_collection": {"owned", "wishlist", "wishlist_priority", "wishlist_note", "added_at"},
    "game_ratings": {"rating", "comment", "created_at", "updated_at"},
    "tier_placements": {"tier", "position", "score", "created_at", "updated_at"},
}
OPTIONAL_TABLES = {"game_rules", "rules_answer_cache", "rules_agent_runs"}


def export_tables(allow_missing=()):
    if set(allow_missing) - OPTIONAL_TABLES:
        raise CommandError("Only the three optional rules tables may be explicitly omitted.")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not settings.SUPABASE_URL or not key:
        raise CommandError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed for a complete read-only export."
        )
    result = {}
    with httpx.Client(
        base_url=f"{settings.SUPABASE_URL}/rest/v1/",
        timeout=45,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    ) as client:
        for table in [*TABLES, "user_alignments"]:
            result[table] = []
            order = (
                "bgg_id"
                if table == "board_games"
                else "user_id"
                if table == "user_activity"
                else "id"
            )
            offset = 0
            while True:
                response = client.get(
                    table, params={"select": "*", "order": order, "offset": offset, "limit": 1000}
                )
                if response.status_code == 404 and table in allow_missing and offset == 0:
                    if response.json().get("code") == "PGRST205":
                        break  # Explicitly verified absent; never mask auth/server failures.
                if response.status_code != 200:
                    raise CommandError(
                        f"Could not export {table}: HTTP {response.status_code}. No data was imported."
                    )
                rows = response.json()
                if not isinstance(rows, list):
                    raise CommandError(f"Invalid export response for {table}.")
                result[table].extend(rows)
                if not rows:
                    break
                offset += len(rows)  # Works even when the server's row limit is below 1000.
    return result


def timestamp(value):
    result = (
        datetime.fromisoformat(value.replace("Z", "+00:00")) if isinstance(value, str) else value
    )
    if result is None or timezone.is_naive(result):
        raise CommandError("Legacy history timestamps must include a timezone.")
    return result


def merge_user_games(data):
    merged, empty = {}, 0
    for table, allowed in ASSOCIATIONS.items():
        ids, pairs = set(), set()
        for source in data[table]:
            extra = set(source) - allowed - {"id", "user_id", "bgg_id"}
            if extra:
                raise CommandError(f"Unmapped fields in {table}: {sorted(extra)}")
            key = (source["user_id"], source["bgg_id"])
            if None in key or source["id"] in ids or key in pairs:
                raise CommandError(f"Missing or duplicate association key in {table}.")
            ids.add(source["id"])
            pairs.add(key)
            if table == "user_game_collection" and not any(
                [
                    source.get("owned"),
                    source.get("wishlist"),
                    source.get("wishlist_priority"),
                    (source.get("wishlist_note") or "").strip(),
                ]
            ):
                empty += 1
                continue
            row = merged.setdefault(key, {"user_id": key[0], "game_id": key[1], "legacy_ids": {}})
            row["legacy_ids"][table] = str(source["id"])
            created = timestamp(source.get("added_at", source.get("created_at")) or timezone.now())
            row["created_at"] = min(row.get("created_at", created), created)
            if table == "user_game_collection":
                row.update({field: source.get(field) for field in allowed - {"added_at"}})
                row.update(
                    owned=bool(row["owned"]),
                    wishlist=bool(row["wishlist"]),
                    wishlist_note=row["wishlist_note"] or "",
                    collection_added_at=created,
                )
            elif table == "game_ratings":
                row.update(
                    rating=source["rating"],
                    comment=source.get("comment") or "",
                    rating_created_at=created,
                    rating_updated_at=source.get("updated_at") or created,
                )
            else:
                row.update(
                    tier=source["tier"],
                    position=source["position"],
                    score=source.get("score"),
                    tier_created_at=created,
                    updated_at=source.get("updated_at") or created,
                )
    for row in merged.values():
        user_id, game_id = row.pop("user_id"), row.pop("game_id")
        models.UserGame.objects.update_or_create(user_id=user_id, game_id=game_id, defaults=row)
    return len(merged), empty


def import_daily_history(rows):
    daily, ids, instants = {}, set(), {}
    for source in rows:
        extra = set(source) - {"id", "user_id", "bgg_id", "score", "snapshot_at"}
        if extra:
            raise CommandError(f"Unmapped fields in score_snapshots: {sorted(extra)}")
        key = source["id"]
        if key in ids:
            raise CommandError("Duplicate primary key in score_snapshots.")
        ids.add(key)
        recorded = timestamp(source["snapshot_at"])
        score = float(source["score"]) if source["score"] is not None else None
        instant = (source.get("user_id"), source["bgg_id"], recorded)
        if instant in instants and instants[instant] != score:
            raise CommandError(
                "Conflicting history scores share a timestamp; resolve their order first."
            )
        instants[instant] = score
        day_key = (*instant[:2], timezone.localdate(recorded))
        if day_key not in daily or recorded > daily[day_key][0]:
            daily[day_key] = (recorded, score)
    for (user_id, game_id, day), (_, score) in daily.items():
        models.DailyScore.objects.update_or_create(
            metric="enjoyment",
            user_id=user_id,
            game_id=game_id,
            day=day,
            defaults={"score": score, "imported": True},
        )
    return len(daily)


def capture_current_day():
    """Start a truthful current baseline; never synthesize missing historical votes."""
    current = {
        (uid, gid): score
        for uid, gid, score in models.UserGame.objects.ranked().values_list(
            "user_id", "game_id", "score"
        )
    }
    pairs = (
        set(
            models.DailyScore.objects.filter(metric="enjoyment", user__isnull=False)
            .order_by()
            .values_list("user_id", "game_id")
        )
        | current.keys()
    )
    day = timezone.localdate()
    for uid, gid in pairs:
        models.DailyScore.objects.update_or_create(
            metric="enjoyment",
            user_id=uid,
            game_id=gid,
            day=day,
            defaults={"score": current.get((uid, gid)), "imported": False},
        )
    games = set(
        models.DailyScore.objects.filter(metric="enjoyment")
        .order_by()
        .values_list("game_id", flat=True)
    ) | {gid for _, gid in current}
    ranking.record_community_scores(games, "enjoyment", day)


def import_rows(data):
    missing = set(TABLES) - data.keys()
    if missing:
        raise CommandError("Incomplete snapshot; missing tables: " + ", ".join(sorted(missing)))
    unknown = set(data) - set(TABLES) - {"user_alignments"}
    if unknown:
        raise CommandError("Unknown tables: " + ", ".join(sorted(unknown)))
    for table in TABLES:
        if not isinstance(data[table], list):
            raise CommandError(f"{table} must contain a JSON array.")
    partners = []
    counts = {table: len(data[table]) for table in TABLES}
    for table, model in TABLES.items():
        if table in ASSOCIATIONS or table == "score_snapshots":
            continue
        rows = data[table]
        fields = {f.attname: f for f in model._meta.concrete_fields}
        primary_key = model._meta.pk.attname
        seen = set()
        for source in rows:
            row = dict(source)
            if table == "profiles":
                partners.append((row["id"], row.pop("partner_id", None)))
                row["is_staff"] = row["is_superuser"] = bool(row.pop("is_admin", False))
                row["username"] = row["id"]
                row["date_joined"] = row.pop("created_at")
                row["partner_id"] = None
            elif table == "board_games":
                # Retired source metadata remains in the original raw export.
                row.pop("bgg_weight", None)
                row.pop("bgg_num_weights", None)
            else:
                row = {ALIASES.get(key, key): value for key, value in row.items()}
            if table == "expansion_tier_placements":
                game_id = row.pop("game_id")
                if not models.Expansion.objects.filter(
                    pk=row["expansion_id"], game_id=game_id
                ).exists():
                    raise CommandError("Expansion placement belongs to the wrong game.")
            extra = set(row) - set(fields)
            if extra:
                raise CommandError(f"Unmapped fields in {table}: {sorted(extra)}")
            for key, value in row.items():
                field = fields[key]
                if value is None and not field.null:
                    if field.get_internal_type() in (
                        "CharField",
                        "TextField",
                        "URLField",
                        "EmailField",
                    ):
                        row[key] = ""
                    elif field.has_default():
                        row[key] = field.get_default()
            key = row.pop(primary_key)
            if str(key) in seen:
                raise CommandError(f"Duplicate primary key in {table}.")
            seen.add(str(key))
            if table == "profiles":
                user, created = model.objects.update_or_create(pk=key, defaults=row)
                if created:
                    user.set_unusable_password()
                    user.save(update_fields=["password"])
            else:
                model.objects.update_or_create(pk=key, defaults=row)
        counts[table] = len(rows)
    for user_id, partner_id in partners:
        models.User.objects.filter(pk=user_id).update(partner_id=partner_id)
    counts["user_games"], counts["empty_collections_removed"] = merge_user_games(data)
    counts["imported_daily_scores"] = import_daily_history(data["score_snapshots"])
    counts.update(ranking.recompute_all())
    capture_current_day()
    return counts


class Command(BaseCommand):
    help = "Validate a full Supabase snapshot; add --apply to import it. Dry-run by default."

    def add_arguments(self, parser):
        source = parser.add_mutually_exclusive_group(required=True)
        source.add_argument(
            "--file", type=Path, help="JSON object mapping each public table to an array of rows"
        )
        source.add_argument(
            "--from-supabase",
            action="store_true",
            help="Read the legacy REST API using a service-role key",
        )
        parser.add_argument(
            "--export", type=Path, help="Save the read-only snapshot (contains personal data)"
        )
        parser.add_argument(
            "--allow-missing-table",
            action="append",
            default=[],
            choices=sorted(OPTIONAL_TABLES),
            help="Explicitly allow a verified absent rules table; other failures still abort",
        )
        parser.add_argument(
            "--export-only",
            action="store_true",
            help="Write the raw export without opening the Django database",
        )
        parser.add_argument(
            "--apply", action="store_true", help="Write to the configured Django database"
        )

    def handle(self, *args, **options):
        try:
            if options["export_only"] and (not options["export"] or options["apply"]):
                raise CommandError(
                    "--export-only requires --export and cannot be combined with --apply."
                )
            data = (
                json.loads(options["file"].read_text())
                if options["file"]
                else export_tables(options["allow_missing_table"])
            )
            if not isinstance(data, dict):
                raise CommandError("Snapshot must be a JSON object.")
            if options["export"]:
                # Don't accidentally replace the only copy of a previous snapshot.
                fd = os.open(options["export"], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "w", encoding="utf-8") as output:
                    json.dump(data, output, ensure_ascii=False, indent=2)
            if options["export_only"]:
                for table, rows in data.items():
                    self.stdout.write(f"{table}: {len(rows)}")
                self.stdout.write(
                    self.style.SUCCESS("Raw export saved. No Django database changes.")
                )
                return
            with transaction.atomic():
                counts = import_rows(data)
                # Check deferred FK constraints before reporting a successful dry run.
                from django.db import connection

                connection.check_constraints()
                if not options["apply"]:
                    transaction.set_rollback(True)
            for table, count in counts.items():
                self.stdout.write(f"{table}: {count}")
            self.stdout.write("user_alignments: derived on demand; no stored copy needed")
            self.stdout.write(
                self.style.SUCCESS(
                    "Imported."
                    if options["apply"]
                    else "Validated. Dry run rolled back; use --apply to import."
                )
            )
        except CommandError:
            raise
        except Exception as exc:
            raise CommandError(
                f"Import failed ({type(exc).__name__}); transaction rolled back. Check snapshot fields and foreign keys."
            ) from exc
