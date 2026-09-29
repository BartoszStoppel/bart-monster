"""Shared schema builders for collection and rules tools; no runtime file loading."""


def parameter(kind, description, **constraints):
    return {"type": kind, "description": description, **constraints}


def tool(name, description, properties, required=()):
    return {
        "name": name,
        "description": description,
        "input_schema": {
            "type": "object",
            "properties": {
                key: {"type": value} if isinstance(value, str) else value
                for key, value in properties.items()
            },
            "required": list(required),
        },
    }


USER_NAME = parameter(
    "string",
    "Display name of the user to look up (case-insensitive). Omit to query the current user.",
)
CATEGORY = parameter("string", "Filter by category", enum=["party", "board"])
MAX_PLAYERS_GTE = parameter("number", "Games supporting at least this many players")
MAX_TIME = parameter("number", "Max playing time in minutes")
LIMIT = parameter("number", "Max games to return. Omit for all.")

DATA_TOOLS = [
    tool(
        "get_user_rankings",
        "Get a user's ranked games with their tier, score (1-10), the game's BGG rating, and the community average score. Returns ALL ranked games by default. Use this for any question about a user's ratings, preferences, or taste analysis. Omit user_name to query the current user.",
        {
            "user_name": USER_NAME,
            "order_by": parameter(
                "string",
                "Sort order. Default: score_desc",
                enum=["score_desc", "score_asc", "name"],
            ),
            "limit": parameter(
                "number",
                "Max games to return. Omit to return ALL. Only set this for 'top N' or 'bottom N' questions.",
            ),
        },
    ),
    tool(
        "get_collection",
        "Get games in the collection with metadata (player count, play time, community difficulty, BGG enjoyment rating, category, mechanics, categories). Use this for recommendations, filtering by attributes, or browsing.",
        {
            "category": CATEGORY,
            "max_players_gte": MAX_PLAYERS_GTE,
            "max_time": MAX_TIME,
            "min_difficulty": parameter(
                "number",
                "Minimum community difficulty (1–6, higher means harder; excludes unrated games)",
            ),
            "max_difficulty": parameter(
                "number",
                "Maximum community difficulty (1–6, higher means harder; excludes unrated games)",
            ),
            "order_by": parameter(
                "string",
                "Sort order. Default: name",
                enum=[
                    "name",
                    "bgg_rating_desc",
                    "difficulty_desc",
                    "difficulty_asc",
                    "time_asc",
                    "time_desc",
                ],
            ),
            "limit": LIMIT,
        },
    ),
    tool(
        "get_community_rankings",
        "Get community average scores (from 3+ tier lists) for games. Use for questions about what the group thinks, group favorites, or consensus ratings.",
        {
            "order_by": parameter(
                "string", "Sort order. Default: avg_desc", enum=["avg_desc", "avg_asc", "name"]
            ),
            "limit": LIMIT,
        },
    ),
    tool(
        "get_game_details",
        "Get full details for specific games by name. Use when the user asks about particular games.",
        {
            "game_names": parameter(
                "array",
                "Game names to look up (case-insensitive partial match)",
                items={"type": "string"},
            ),
        },
        ["game_names"],
    ),
    tool(
        "compare_scores",
        "Compare a user's scores against BGG ratings or community averages. Returns ONLY games matching the comparison with the difference pre-computed and sorted. Use this whenever the user asks about disparities, differences, over/underrated games, or 'which games do I rate higher/lower than X'. Omit user_name to query the current user.",
        {
            "user_name": USER_NAME,
            "compare_against": parameter(
                "string",
                "What to compare the user's score against. 'bgg' = BGG's global rating (from millions of users worldwide). 'community' = the friend group's average score on bart.monster (from 3+ tier lists).",
                enum=["bgg", "community"],
            ),
            "direction": parameter(
                "string",
                "Which rows to include. 'user_higher' = user score > comparison. 'user_lower' = user score < comparison. 'both' = all games with a difference.",
                enum=["user_higher", "user_lower", "both"],
            ),
            "min_difference": parameter(
                "number",
                "Minimum absolute difference to include. Default: 0 (all games). Set to e.g. 0.5 to filter out tiny differences.",
            ),
            "order_by": parameter(
                "string",
                "Sort by difference. Default: difference_desc (biggest gaps first)",
                enum=["difference_desc", "difference_asc"],
            ),
            "limit": parameter("number", "Max games to return. Omit for all matching."),
        },
        ["compare_against", "direction"],
    ),
    tool(
        "get_unranked_games",
        "Get games in the collection that a user has NOT ranked yet. Omit user_name to query the current user.",
        {
            "user_name": USER_NAME,
            "category": CATEGORY,
            "max_players_gte": MAX_PLAYERS_GTE,
            "max_time": MAX_TIME,
        },
    ),
    tool(
        "ask_game_rules",
        "Delegate a HOW-TO-PLAY question to a specialist rules agent that has the game's rulebook loaded and can search BGG forums, official FAQs, and Reddit. Use this ONLY for questions about how a specific game is played: setup, turn structure, card/ability interactions, timing, scoring mechanics, edge cases, legal moves, or errata. Spawn one call per game the user is asking about. Do NOT use this for recommendations ('what should we play tonight', 'which game for 4 players'), taste/score questions, comparisons, or anything answerable from the collection data tools — handle those yourself. If you cannot confidently tell which owned game a rules question is about, ask the user which game before calling this.",
        {
            "bgg_id": parameter("number", "The BGG id of the game the rules question is about."),
            "question": parameter(
                "string",
                "A self-contained rules question for the agent, including any context (player count, cards involved, the specific situation). The agent does not see the chat history.",
            ),
            "expansions": parameter(
                "array",
                "Names of expansions the user said are in play. Omit for base-game-only questions.",
                items={"type": "string"},
            ),
        },
        ["bgg_id", "question"],
    ),
]
DATA_TOOLS[-1]["cache_control"] = {"type": "ephemeral"}
