from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.http import JsonResponse
from django.urls import path
from django.views.generic import RedirectView

from hub import auth, chat, views

urlpatterns = [
    path("health", lambda request: JsonResponse({"status": "ok"})),
    path(
        "login",
        auth_views.LoginView.as_view(
            template_name="hub/login.html", redirect_authenticated_user=True
        ),
        name="login",
    ),
    path("login/google", auth.google_login, name="google-login"),
    path("callback", auth.callback, name="callback"),
    path("logout", auth_views.LogoutView.as_view(), name="logout"),
    path("", views.collection, name="collection"),
    path("search", views.search, name="search"),
    path("games/<int:bgg_id>", views.game_detail, name="game"),
    path("games/<int:bgg_id>/<str:action>", views.game_action, name="game-action"),
    path("tier-list", views.tier_list, name="tiers"),
    path("rankings/difficulty/<str:cat>/move", views.move_tier, {"metric": "difficulty"}),
    path("api/rankings/difficulty/<str:cat>", views.save_tiers, {"metric": "difficulty"}),
    path("rankings/<str:cat>/move", views.move_tier),
    path("rankings/expansions/<int:bgg_id>/move", views.move_tier),
    path("api/rankings/<str:cat>", views.save_tiers),
    path("api/rankings/expansions/<int:bgg_id>", views.save_tiers),
    path("community", views.community, name="community"),
    path("profile", views.profile, name="profile"),
    path("users/<uuid:user_id>", views.profile, name="user"),
    path("wishlist", views.wishlist, name="wishlist"),
    path("picker", views.picker, name="picker"),
    path("statistics", views.statistics, name="statistics"),
    path("achievements", views.achievements, name="achievements"),
    path("feedback", views.feedback, name="feedback"),
    path("feedback/<uuid:pk>/delete", views.delete_feedback),
    path("furtch", views.furtch, name="furtch"),
    path("chat", chat.chat_page, name="chat"),
    path("api/chat", chat.chat_api),
    path("api/heartbeat", views.heartbeat),
    path("api/bgg/search", views.bgg_search),
    path("api/bgg/game/<int:bgg_id>", views.bgg_game),
    path("api/rules/convert", chat.convert_pdf),
    path("admin/rules", views.rules, name="rules"),
    path("admin", RedirectView.as_view(url="/admin/")),
    path("admin/", admin.site.urls),
]
