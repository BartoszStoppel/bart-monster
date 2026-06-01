import Anthropic from "@anthropic-ai/sdk";

import { listForums, getForumThreads, getThread, findRulesForum } from "@/lib/bgg/forum";
import { searchReddit, getRedditThread } from "@/lib/reddit/client";

/** Tools the rules agent executes locally (BGG forums + Reddit). */
export const RULES_CLIENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "bgg_browse_rules_forum",
    description:
      "List recent threads in this game's BoardGameGeek 'Rules' subforum (designers and experienced players answer rules questions here). Returns thread subjects and ids. Pick relevant subjects, then call bgg_read_thread to read the discussion. Use this FIRST for any rules edge case not fully covered by the loaded rulebook.",
    input_schema: {
      type: "object" as const,
      properties: {
        page: {
          type: "number",
          description: "Page of threads (50 per page), most recently active first. Default 1.",
        },
      },
      required: [],
    },
  },
  {
    name: "bgg_read_thread",
    description:
      "Read the posts in a BoardGameGeek forum thread by its id (from bgg_browse_rules_forum). Returns the original question and replies.",
    input_schema: {
      type: "object" as const,
      properties: {
        thread_id: { type: "number", description: "The BGG thread id." },
      },
      required: ["thread_id"],
    },
  },
  {
    name: "reddit_search",
    description:
      "Search Reddit for discussion of a rules question. Defaults to r/boardgames; pass a game-specific subreddit if one exists. Returns matching threads with permalinks.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query, include the game name." },
        subreddit: {
          type: "string",
          description: "Subreddit without 'r/' (e.g. 'boardgames'). Omit to search all of Reddit.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "reddit_read_thread",
    description:
      "Read a Reddit thread's post and top comments by its permalink (from reddit_search).",
    input_schema: {
      type: "object" as const,
      properties: {
        permalink: {
          type: "string",
          description: "Reddit permalink or full URL from a reddit_search result.",
        },
      },
      required: ["permalink"],
    },
  },
];

/** The web search server tool (Anthropic-executed) for official FAQs/errata. */
export const WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 4,
};

/** Full tool set for the rules agent: local tools + the web search server tool. */
export function buildRulesToolset(): NonNullable<Anthropic.MessageCreateParams["tools"]> {
  return [...RULES_CLIENT_TOOLS, WEB_SEARCH_TOOL];
}

interface ToolCallInput {
  page?: number;
  thread_id?: number;
  query?: string;
  subreddit?: string;
  permalink?: string;
}

/**
 * Execute one local rules-agent tool call. `bggId` is supplied from the agent's
 * context so the model never has to know (or guess) the game's BGG id.
 */
export async function executeRulesTool(
  bggId: number,
  toolName: string,
  input: ToolCallInput,
): Promise<string> {
  switch (toolName) {
    case "bgg_browse_rules_forum":
      return browseRulesForum(bggId, input.page ?? 1);
    case "bgg_read_thread":
      return readThread(input.thread_id);
    case "reddit_search":
      return redditSearch(input.query, input.subreddit);
    case "reddit_read_thread":
      return redditReadThread(input.permalink);
    default:
      return `Unknown tool: ${toolName}`;
  }
}

async function browseRulesForum(bggId: number, page: number): Promise<string> {
  const forums = await listForums(bggId);
  const rulesForum = findRulesForum(forums);
  if (!rulesForum) return "No forums found for this game on BGG.";

  const threads = await getForumThreads(rulesForum.id, page);
  if (threads.length === 0) return `No threads found in the "${rulesForum.title}" forum.`;

  const lines = threads.map(
    (t) => `- [${t.id}] ${t.subject} (${t.numArticles} posts, last ${t.lastPostDate ?? "n/a"})`,
  );
  return `Forum "${rulesForum.title}" — recent threads (call bgg_read_thread with an id):\n${lines.join("\n")}`;
}

async function readThread(threadId?: number): Promise<string> {
  if (!threadId) return "thread_id is required.";
  const { subject, articles } = await getThread(threadId);
  if (articles.length === 0) return `Thread ${threadId} has no readable posts.`;

  const posts = articles.map(
    (a, i) => `--- Post ${i + 1} by ${a.author ?? "unknown"} (${a.postDate ?? "n/a"}) ---\n${a.body}`,
  );
  return `Thread "${subject}" (https://boardgamegeek.com/thread/${threadId}):\n\n${posts.join("\n\n")}`;
}

async function redditSearch(query?: string, subreddit?: string): Promise<string> {
  if (!query) return "query is required.";
  const hits = await searchReddit(query, subreddit ?? "boardgames");
  if (hits.length === 0) return `No Reddit results for "${query}".`;

  const lines = hits.map(
    (h) => `- ${h.title} (r/${h.subreddit}, ${h.score} pts, ${h.numComments} comments)\n  ${h.url}`,
  );
  return `Reddit results (call reddit_read_thread with a URL):\n${lines.join("\n")}`;
}

async function redditReadThread(permalink?: string): Promise<string> {
  if (!permalink) return "permalink is required.";
  const { title, selftext, comments } = await getRedditThread(permalink);
  const commentText = comments.map((c) => `- ${c.author} (${c.score} pts): ${c.body}`).join("\n");
  return `Reddit thread "${title}":\n${selftext}\n\nTop comments:\n${commentText}`;
}
