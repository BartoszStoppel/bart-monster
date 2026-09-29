from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from hub.bgg import BGGError, details
from hub.models import Game


class Command(BaseCommand):
    help = "Add BGG IDs or refresh metadata for the existing catalog (preserves local categories)."

    def add_arguments(self, parser):
        parser.add_argument("ids", nargs="*", type=int)
        parser.add_argument("--refresh-all", action="store_true")

    def handle(self, *args, **options):
        ids = options["ids"]
        if options["refresh_all"]:
            ids = list(Game.objects.values_list("pk", flat=True))
        if not ids:
            raise CommandError("Provide BGG IDs or --refresh-all.")
        failures = []
        for game_id in ids:
            try:
                data = details(game_id)
                data["fetched_at"] = timezone.now()
                game, _ = Game.objects.update_or_create(pk=game_id, defaults=data)
                self.stdout.write(f"{game_id}: {game.name}")
            except BGGError as exc:
                failures.append(game_id)
                self.stderr.write(f"{game_id}: {exc}")
        if failures:
            raise CommandError(f"Could not fetch IDs: {failures}. Retry these later.")
