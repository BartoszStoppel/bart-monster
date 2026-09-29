import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

TIERS = [(tier, tier) for tier in "SABCDF"]
CATEGORIES = [("board", "Board games"), ("party", "Party games")]
DIFFICULTIES = [
    (1, "Cuddly"),
    (2, "Tame"),
    (3, "Challenging"),
    (4, "Demanding"),
    (5, "Brutal"),
    (6, "Monstrous"),
]
METRICS = [("enjoyment", "Enjoyment"), ("difficulty", "Difficulty")]


def household_groups(users):
    """Connected partner links form one household, including one-sided legacy links."""
    users = {user.pk: user for user in users}
    links = {uid: set() for uid in users}
    for uid, user in users.items():
        if user.partner_id in users:
            links[uid].add(user.partner_id)
            links[user.partner_id].add(uid)
    remaining = set(users)
    while remaining:
        pending, members = [min(remaining)], set()
        while pending:
            uid = pending.pop()
            if uid not in members:
                members.add(uid)
                pending.extend(links[uid] - members)
        remaining -= members
        yield [users[uid] for uid in sorted(members)]


class GameQuerySet(models.QuerySet):
    def _with_score(self, field, score_name, votes_name, minimum):
        # Correlated aggregates cannot multiply votes when callers join other relations.
        votes = (
            UserGame.objects.filter(game_id=models.OuterRef("pk"), **{f"{field}__isnull": False})
            .order_by()
            .values("game_id")
            .annotate(average=models.Avg(field), count=models.Count("pk"))
        )
        return self.annotate(
            **{
                score_name: models.Subquery(votes.filter(count__gte=minimum).values("average")),
                votes_name: models.functions.Coalesce(models.Subquery(votes.values("count")), 0),
            }
        )

    def with_difficulty(self):
        return self._with_score("difficulty_tier", "difficulty", "difficulty_votes", 1)

    def with_enjoyment(self):
        return self._with_score("score", "community_score", "rankers", 3)


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    display_name = models.CharField(max_length=150)
    avatar_url = models.URLField(blank=True, max_length=1000)
    partner = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL)
    updated_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.display_name or self.username

    @property
    def household_ids(self):
        return next(
            [u.pk for u in members]
            for members in household_groups(User.objects.only("pk", "partner_id"))
            if any(u.pk == self.pk for u in members)
        )


class Record(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        abstract = True


class Game(models.Model):
    bgg_id = models.PositiveIntegerField(primary_key=True)
    name = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    image_url = models.URLField(max_length=1000, blank=True)
    thumbnail_url = models.URLField(max_length=1000, blank=True)
    category = models.CharField(max_length=5, choices=CATEGORIES, default="board", db_index=True)
    year_published = models.IntegerField(null=True, blank=True)
    min_players = models.PositiveIntegerField(null=True, blank=True)
    max_players = models.PositiveIntegerField(null=True, blank=True)
    playing_time = models.PositiveIntegerField(null=True, blank=True)
    min_play_time = models.PositiveIntegerField(null=True, blank=True)
    max_play_time = models.PositiveIntegerField(null=True, blank=True)
    min_age = models.PositiveIntegerField(null=True, blank=True)
    bgg_rating = models.FloatField(null=True, blank=True)
    categories = models.JSONField(default=list, blank=True)
    mechanics = models.JSONField(default=list, blank=True)
    designers = models.JSONField(default=list, blank=True)
    artists = models.JSONField(default=list, blank=True)
    publishers = models.JSONField(default=list, blank=True)
    alternate_names = models.JSONField(default=list, blank=True)
    expansions = models.JSONField(default=list, blank=True)
    suggested_players = models.JSONField(default=list, blank=True)
    suggested_age = models.PositiveIntegerField(null=True, blank=True)
    language_dependence = models.TextField(blank=True)
    bgg_users_rated = models.PositiveIntegerField(null=True, blank=True)
    bgg_std_dev = models.FloatField(null=True, blank=True)
    bgg_owned = models.PositiveIntegerField(null=True, blank=True)
    bgg_wanting = models.PositiveIntegerField(null=True, blank=True)
    bgg_wishing = models.PositiveIntegerField(null=True, blank=True)
    fetched_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(default=timezone.now)
    objects = GameQuerySet.as_manager()

    class Meta:
        ordering = ["name", "bgg_id"]

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return f"/games/{self.pk}"


class UserGameQuerySet(models.QuerySet):
    def ranked(self, metric="enjoyment"):
        if metric == "difficulty":
            return self.filter(difficulty_tier__isnull=False)
        if metric != "enjoyment":
            raise ValueError("Unknown ranking metric.")
        return self.exclude(tier="")

    def rated(self):
        return self.filter(rating__isnull=False)

    def collected(self):
        return self.filter(
            models.Q(owned=True)
            | models.Q(wishlist=True)
            | models.Q(wishlist_priority__isnull=False)
            | ~models.Q(wishlist_note="")
        )

    def prune_empty(self):
        return self.filter(
            owned=False,
            wishlist=False,
            wishlist_priority=None,
            wishlist_note="",
            tier="",
            difficulty_tier=None,
            rating=None,
            comment="",
        ).delete()


class UserGame(Record):
    """One association; ownership, explicit rating, and ranking remain independent."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, db_index=False)
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="user_games")
    owned = models.BooleanField(default=False)
    wishlist = models.BooleanField(default=False)
    wishlist_priority = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(3)]
    )
    wishlist_note = models.TextField(blank=True)
    collection_added_at = models.DateTimeField(null=True, blank=True)
    rating = models.FloatField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    comment = models.TextField(blank=True)
    rating_created_at = models.DateTimeField(null=True, blank=True)
    rating_updated_at = models.DateTimeField(null=True, blank=True)
    tier = models.CharField(max_length=1, choices=TIERS, blank=True)
    position = models.PositiveIntegerField(default=0)
    score = models.FloatField(null=True, blank=True)
    tier_created_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(default=timezone.now)
    difficulty_tier = models.PositiveSmallIntegerField(null=True, blank=True, choices=DIFFICULTIES)
    difficulty_position = models.PositiveIntegerField(default=0)
    difficulty_updated_at = models.DateTimeField(null=True, blank=True)
    # Retain source IDs for reconciliation; they are not additional associations.
    legacy_ids = models.JSONField(default=dict, blank=True)
    objects = UserGameQuerySet.as_manager()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "game"], name="unique_user_game"),
            models.CheckConstraint(
                condition=models.Q(difficulty_tier__isnull=True)
                | models.Q(difficulty_tier__gte=1, difficulty_tier__lte=6),
                name="valid_difficulty_tier",
            ),
            models.CheckConstraint(
                condition=models.Q(difficulty_tier__isnull=False) | models.Q(difficulty_position=0),
                name="unranked_difficulty_state",
            ),
            models.CheckConstraint(
                condition=models.Q(tier__in=["", *"SABCDF"]), name="valid_game_tier"
            ),
            models.CheckConstraint(
                condition=models.Q(rating__isnull=True) | models.Q(rating__gte=1, rating__lte=10),
                name="valid_game_rating",
            ),
            models.CheckConstraint(
                condition=models.Q(score__isnull=True) | models.Q(score__gte=1, score__lte=10),
                name="valid_game_score",
            ),
            models.CheckConstraint(
                condition=~models.Q(tier="") | models.Q(score__isnull=True, position=0),
                name="unranked_game_state",
            ),
            models.CheckConstraint(
                condition=models.Q(wishlist_priority__isnull=True)
                | models.Q(wishlist_priority__gte=1, wishlist_priority__lte=3),
                name="valid_wishlist_priority",
            ),
        ]


class Ranked(Record):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    tier = models.CharField(max_length=1, choices=TIERS)
    position = models.PositiveIntegerField(default=0)
    score = models.FloatField(null=True, blank=True)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        abstract = True


class Expansion(Record):
    game = models.ForeignKey(
        Game, on_delete=models.CASCADE, related_name="rankable_expansions", db_index=False
    )
    name = models.CharField(max_length=500)
    bgg_expansion_id = models.PositiveIntegerField(null=True, blank=True)
    thumbnail_url = models.URLField(max_length=1000, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["game", "name"], name="unique_expansion")]

    def __str__(self):
        return self.name


class ExpansionPlacement(Ranked):
    expansion = models.ForeignKey(Expansion, on_delete=models.CASCADE, related_name="placements")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "expansion"], name="unique_expansion_placement"
            ),
            models.CheckConstraint(
                condition=models.Q(tier__in=list("SABCDF")), name="valid_expansion_tier"
            ),
        ]


class DailyScore(models.Model):
    metric = models.CharField(max_length=10, choices=METRICS, default="enjoyment")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, db_index=False
    )
    game = models.ForeignKey(
        Game, on_delete=models.CASCADE, related_name="daily_scores", db_index=False
    )
    day = models.DateField(default=timezone.localdate)
    imported = models.BooleanField(default=False)
    score = models.FloatField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(metric__in=["enjoyment", "difficulty"]),
                name="valid_score_metric",
            ),
            models.UniqueConstraint(
                fields=["metric", "user", "game", "day"],
                condition=models.Q(user__isnull=False),
                name="unique_daily_player_score",
            ),
            models.UniqueConstraint(
                fields=["metric", "game", "day"],
                condition=models.Q(user__isnull=True),
                name="unique_daily_community_score",
            ),
        ]
        indexes = [models.Index(fields=["metric", "game", "day"])]
        ordering = ["day", "pk"]


class Trophy(Record):
    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=300)
    description = models.TextField()
    icon = models.CharField(max_length=30, default="🏆")

    def __str__(self):
        return self.title

    class Meta:
        abstract = True


class Achievement(Trophy):
    pass


class Award(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name="awards")
    detail = models.TextField(blank=True)
    awarded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "achievement"], name="unique_award")]


class Bounty(Trophy):
    claimed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    claimed_at = models.DateTimeField(null=True, blank=True)


class Feedback(Record):
    CATEGORIES = [(x, x.title()) for x in ["feature", "bug", "improvement"]]
    STATUSES = [(x, x.title()) for x in ["new", "planned", "in-progress", "done", "declined"]]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=300)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORIES, default="feature")
    status = models.CharField(max_length=20, choices=STATUSES, default="new")
    admin_note = models.TextField(blank=True)
    updated_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.title


class Activity(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, primary_key=True, on_delete=models.CASCADE
    )
    visit_count = models.PositiveIntegerField(default=0)
    total_seconds = models.PositiveIntegerField(default=0)
    last_seen_at = models.DateTimeField(default=timezone.now)


class Rulebook(Record):
    game = models.ForeignKey(
        Game, on_delete=models.CASCADE, related_name="rulebooks", db_index=False
    )
    module_name = models.CharField(max_length=300)
    module_type = models.CharField(
        max_length=10, choices=[("base", "Base"), ("expansion", "Expansion")], default="base"
    )
    content_md = models.TextField()
    token_estimate = models.PositiveIntegerField(null=True, blank=True)
    source = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["game", "module_name"], name="unique_rulebook")
        ]

    def __str__(self):
        return f"{self.game}: {self.module_name}"


class RulesAnswer(Record):
    game = models.ForeignKey(Game, on_delete=models.CASCADE, db_index=False)
    modules_hash = models.CharField(max_length=64)
    question_norm = models.TextField()
    answer_md = models.TextField()
    citations = models.JSONField(default=list, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["game", "modules_hash", "question_norm"], name="unique_rules_answer"
            )
        ]


class RulesRun(Record):
    game = models.ForeignKey(Game, null=True, blank=True, on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    question = models.TextField()
    answer_md = models.TextField(blank=True)
    citations = models.JSONField(default=list, blank=True)
    tool_calls = models.JSONField(default=list, blank=True)
    cache_hit = models.BooleanField(default=False)
