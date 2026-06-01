/**
 * Minimal read-only Reddit client using the public JSON endpoints.
 * No auth required; Reddit only asks for a descriptive User-Agent and
 * rate-limits anonymous traffic, so callers should keep request counts low.
 */

const USER_AGENT = "bart.monster-rules-assistant/1.0";

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Reddit request failed: ${response.status} ${url}`);
  }
  return response.json();
}

export interface RedditSearchHit {
  title: string;
  permalink: string;
  url: string;
  subreddit: string;
  score: number;
  numComments: number;
  snippet: string;
}

export interface RedditComment {
  author: string;
  body: string;
  score: number;
}

export interface RedditThread {
  title: string;
  selftext: string;
  comments: RedditComment[];
}

interface RedditListing<T> {
  data?: { children?: Array<{ kind?: string; data?: T }> };
}

interface RedditPostData {
  title?: string;
  permalink?: string;
  url?: string;
  subreddit?: string;
  score?: number;
  num_comments?: number;
  selftext?: string;
}

interface RedditCommentData {
  author?: string;
  body?: string;
  score?: number;
}

/**
 * Search Reddit for posts matching a query, optionally scoped to a subreddit.
 * @param subreddit - Subreddit name without the "r/" prefix; omit to search all of Reddit.
 */
export async function searchReddit(
  query: string,
  subreddit?: string,
  limit = 8,
): Promise<RedditSearchHit[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    sort: "relevance",
    t: "all",
  });
  const base = subreddit
    ? `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json`
    : "https://www.reddit.com/search.json";
  if (subreddit) params.set("restrict_sr", "1");

  const json = (await fetchJson(`${base}?${params}`)) as RedditListing<RedditPostData>;
  const children = json?.data?.children ?? [];

  return children
    .map((c) => c.data ?? {})
    .filter((d) => d.permalink)
    .map((d) => ({
      title: d.title ?? "",
      permalink: d.permalink ?? "",
      url: `https://www.reddit.com${d.permalink ?? ""}`,
      subreddit: d.subreddit ?? "",
      score: d.score ?? 0,
      numComments: d.num_comments ?? 0,
      snippet: (d.selftext ?? "").slice(0, 300),
    }));
}

/**
 * Fetch a Reddit thread's post body and top-level comments.
 * @param permalink - A reddit permalink (e.g. "/r/boardgames/comments/abc/...") or full URL.
 */
export async function getRedditThread(
  permalink: string,
  maxComments = 15,
): Promise<RedditThread> {
  const path = permalink
    .replace(/^https?:\/\/(www\.)?reddit\.com/i, "")
    .replace(/\/?$/, "");
  const json = (await fetchJson(`https://www.reddit.com${path}.json`)) as [
    RedditListing<RedditPostData>,
    RedditListing<RedditCommentData>,
  ];

  const post = json?.[0]?.data?.children?.[0]?.data ?? {};
  const commentChildren = json?.[1]?.data?.children ?? [];

  const comments: RedditComment[] = commentChildren
    .filter((c) => c.kind === "t1" && c.data?.body)
    .slice(0, maxComments)
    .map((c) => ({
      author: c.data?.author ?? "unknown",
      body: (c.data?.body ?? "").trim(),
      score: c.data?.score ?? 0,
    }));

  return {
    title: post.title ?? "",
    selftext: (post.selftext ?? "").trim(),
    comments,
  };
}
