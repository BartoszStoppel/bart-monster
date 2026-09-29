"""Small, cached, bounded XML API client. Tokens never reach the browser."""

import hashlib
import html
import json

import httpx
from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException
from django.conf import settings
from django.core.cache import cache
from django.utils.html import strip_tags


class BGGError(Exception):
    pass


def fetch(endpoint, **params):
    key = (
        "bgg:" + hashlib.sha256(json.dumps([endpoint, params], sort_keys=True).encode()).hexdigest()
    )
    xml = cache.get(key)
    if xml is None:
        try:
            response = httpx.get(
                f"https://boardgamegeek.com/xmlapi2/{endpoint}",
                params=params,
                headers={"Authorization": f"Bearer {settings.BGG_API_TOKEN}"},
                timeout=20,
            )
            if response.status_code in (202, 429):
                raise BGGError("BoardGameGeek is busy. Please try again in a moment.")
            response.raise_for_status()
            if len(response.content) > 8_000_000:
                raise BGGError("BoardGameGeek returned too much data.")
            xml = response.content
            root = ElementTree.fromstring(xml)
            if root.find("error") is not None or root.tag == "errors":
                raise BGGError("BoardGameGeek could not find that item.")
            cache.set(key, xml, 3600)
            return root
        except (httpx.HTTPError, ElementTree.ParseError, DefusedXmlException) as exc:
            raise BGGError("BoardGameGeek is unavailable. Please try again later.") from exc
    return ElementTree.fromstring(xml)


def value(item, name, cast=str):
    node = item.find(name)
    raw = node.get("value") if node is not None else None
    try:
        return cast(raw) if raw not in (None, "", "N/A", "Not Ranked") else None
    except (ValueError, TypeError):
        return None


def search(query):
    root = fetch("search", query=query[:200], type="boardgame")
    return [
        {
            "bgg_id": int(item.get("id")),
            "name": value(item, "name"),
            "year_published": value(item, "yearpublished", int),
        }
        for item in root.findall("item")
    ]


def details(bgg_id):
    root = fetch("thing", id=int(bgg_id), stats=1)
    item = root.find("item")
    if item is None:
        raise BGGError("Game not found on BoardGameGeek.")
    result = {
        "name": value(item, "name[@type='primary']") or value(item, "name"),
        "description": strip_tags(html.unescape(item.findtext("description", ""))),
        "image_url": item.findtext("image", ""),
        "thumbnail_url": item.findtext("thumbnail", ""),
    }
    for field, tag in {
        "year_published": "yearpublished",
        "min_players": "minplayers",
        "max_players": "maxplayers",
        "playing_time": "playingtime",
        "min_play_time": "minplaytime",
        "max_play_time": "maxplaytime",
        "min_age": "minage",
    }.items():
        result[field] = value(item, tag, int)
    for field, tag in {
        "categories": "boardgamecategory",
        "mechanics": "boardgamemechanic",
        "designers": "boardgamedesigner",
        "artists": "boardgameartist",
        "publishers": "boardgamepublisher",
    }.items():
        result[field] = [link.get("value") for link in item.findall(f"link[@type='{tag}']")]
    result["alternate_names"] = [n.get("value") for n in item.findall("name[@type='alternate']")]
    result["expansions"] = [
        {"id": int(n.get("id")), "name": n.get("value")}
        for n in item.findall("link[@type='boardgameexpansion']")
        if n.get("inbound") != "true"
    ]
    for field, tag in {
        "bgg_rating": "average",
        "bgg_std_dev": "stddev",
        "bgg_users_rated": "usersrated",
        "bgg_owned": "owned",
        "bgg_wanting": "wanting",
        "bgg_wishing": "wishing",
    }.items():
        result[field] = value(
            item,
            f"statistics/ratings/{tag}",
            float if field in ("bgg_rating", "bgg_std_dev") else int,
        )
    result["suggested_players"] = []
    for poll in item.findall("poll[@name='suggested_numplayers']/results"):
        votes = {n.get("value"): int(n.get("numvotes", 0)) for n in poll.findall("result")}
        result["suggested_players"].append(
            {
                "numPlayers": poll.get("numplayers"),
                "best": votes.get("Best", 0),
                "recommended": votes.get("Recommended", 0),
                "notRecommended": votes.get("Not Recommended", 0),
            }
        )
    for name, field in [
        ("suggested_playerage", "suggested_age"),
        ("language_dependence", "language_dependence"),
    ]:
        options = item.findall(f"poll[@name='{name}']/results/result")
        if options:
            winner = max(options, key=lambda n: int(n.get("numvotes", 0)))
            raw = winner.get("value", "")
            result[field] = (
                int(raw.rstrip("+"))
                if field == "suggested_age" and raw.rstrip("+").isdigit()
                else (None if field == "suggested_age" else raw)
            )
    return result
