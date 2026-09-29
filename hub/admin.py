from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.db import transaction
from django.utils import timezone

from . import models
from .ranking import lock_ids, recompute_all, record_community_scores

admin.site.site_header = "bart.monster administration"
admin.site.site_title = "bart.monster"
admin.site.index_title = "Manage the game hub"


@admin.register(models.User)
class HubUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Game hub", {"fields": ("display_name", "avatar_url", "partner")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (("Game hub", {"fields": ("display_name",)}),)
    list_display = ["display_name", "email", "is_staff", "is_active"]
    search_fields = ["display_name", "email", "username"]

    @transaction.atomic
    def delete_queryset(self, request, queryset):
        # Same lock order as ranking saves; capture affected games before cascading.
        lock_ids(models.User.objects.all())
        affected = {
            metric: set(
                models.UserGame.objects.ranked(metric)
                .filter(user__in=queryset)
                .values_list("game_id", flat=True)
            )
            for metric, _ in models.METRICS
        }
        lock_ids(models.Game.objects.filter(pk__in=set().union(*affected.values())))
        super().delete_queryset(request, queryset)
        day = timezone.localdate()
        for metric, game_ids in affected.items():
            record_community_scores(game_ids, metric, day)

    def delete_model(self, request, obj):
        self.delete_queryset(request, models.User.objects.filter(pk=obj.pk))


class RecalculateAdmin(admin.ModelAdmin):
    @transaction.atomic
    def save_model(self, request, obj, form, change):
        lock_ids(models.User.objects.all())
        super().save_model(request, obj, form, change)
        recompute_all()

    @transaction.atomic
    def delete_queryset(self, request, queryset):
        lock_ids(models.User.objects.all())
        super().delete_queryset(request, queryset)
        recompute_all()

    def delete_model(self, request, obj):
        self.delete_queryset(request, type(obj).objects.filter(pk=obj.pk))


@admin.register(models.Game)
class GameAdmin(RecalculateAdmin):
    list_display = ["name", "category", "bgg_id", "bgg_rating"]
    list_filter = ["category"]
    search_fields = ["name"]


@admin.register(models.Expansion)
class ExpansionAdmin(RecalculateAdmin):
    list_display = ["name", "game"]
    search_fields = ["name", "game__name"]
    autocomplete_fields = ["game"]


@admin.register(models.Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ["title", "user", "category", "status", "created_at"]
    list_filter = ["status", "category"]
    readonly_fields = ["user", "title", "description", "category", "created_at"]


@admin.register(models.Rulebook)
class RulebookAdmin(admin.ModelAdmin):
    list_display = ["module_name", "game", "module_type", "updated_at"]
    search_fields = ["module_name", "game__name"]
    autocomplete_fields = ["game"]


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


for model in [
    models.UserGame,
    models.ExpansionPlacement,
    models.DailyScore,
    models.Activity,
    models.RulesRun,
]:
    admin.site.register(model, ReadOnlyAdmin)
for model in [
    models.Achievement,
    models.Award,
    models.Bounty,
    models.RulesAnswer,
]:
    admin.site.register(model)
