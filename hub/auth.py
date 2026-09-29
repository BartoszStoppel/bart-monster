"""Keep existing Google/Supabase identities, then use ordinary Django sessions."""

import base64
import hashlib
import secrets
import time
from urllib.parse import urlencode

import httpx
from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login
from django.http import HttpResponseBadRequest
from django.shortcuts import redirect
from django.views.decorators.http import require_GET, require_POST

from .models import User


@require_POST
def google_login(request):
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        messages.error(request, "Google sign-in is not configured. Use a local account below.")
        return redirect("login")
    verifier = secrets.token_urlsafe(48)
    state = secrets.token_urlsafe(32)
    request.session["oauth"] = {"verifier": verifier, "state": state, "started": time.time()}
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    )
    callback = request.build_absolute_uri("/callback") + "?" + urlencode({"state": state})
    query = urlencode(
        {
            "provider": "google",
            "redirect_to": callback,
            "code_challenge": challenge,
            "code_challenge_method": "s256",
        }
    )
    return redirect(f"{settings.SUPABASE_URL}/auth/v1/authorize?{query}")


@require_GET
def callback(request):
    flow = request.session.pop("oauth", {})
    if (
        not flow
        or time.time() - flow.get("started", 0) > 600
        or not secrets.compare_digest(request.GET.get("state", ""), flow.get("state", ""))
        or not request.GET.get("code")
    ):
        return HttpResponseBadRequest("Sign-in expired or invalid. Please start again from /login.")
    try:
        response = httpx.post(
            f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=pkce",
            headers={"apikey": settings.SUPABASE_ANON_KEY},
            timeout=20,
            json={"auth_code": request.GET["code"], "code_verifier": flow["verifier"]},
        )
        response.raise_for_status()
        identity = response.json()["user"]
        metadata = identity.get("user_metadata", {})
        user, created = User.objects.get_or_create(
            pk=identity["id"],
            defaults={
                "username": identity["id"],
                "email": identity.get("email", ""),
                "display_name": metadata.get("full_name") or metadata.get("name") or "Friend",
                "avatar_url": metadata.get("avatar_url", ""),
            },
        )
        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])
        if not user.is_active:
            return HttpResponseBadRequest("This account is disabled.")
        # Never derive staff permissions from editable OAuth user metadata.
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    except (httpx.HTTPError, ValueError, KeyError):
        messages.error(request, "Google sign-in could not be completed. Please try again.")
        return redirect("login")
    return redirect("collection")
