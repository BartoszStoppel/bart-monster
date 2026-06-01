import { XMLParser } from "fast-xml-parser";

const BGG_BASE_URL = "https://boardgamegeek.com/xmlapi2";

/** Parser that leaves article bodies as raw strings instead of parsing their inline HTML. */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  stopNodes: ["*.body"],
});

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/** Convert a BGG forum-post HTML body into readable plain text. */
function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function asArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

async function fetchXml(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.BGG_API_TOKEN}` },
  });
  if (!response.ok) {
    throw new Error(`BGG forum request failed: ${response.status} ${url}`);
  }
  const xml = await response.text();
  return parser.parse(xml);
}

export interface BggForum {
  id: number;
  title: string;
  numThreads: number;
  lastPostDate: string | null;
}

export interface BggForumThread {
  id: number;
  subject: string;
  author: string | null;
  numArticles: number;
  lastPostDate: string | null;
}

export interface BggForumArticle {
  id: number;
  author: string | null;
  postDate: string | null;
  body: string;
}

interface XmlForum {
  "@_id": string;
  "@_title": string;
  "@_numthreads"?: string;
  "@_lastpostdate"?: string;
}

interface XmlThread {
  "@_id": string;
  "@_subject": string;
  "@_author"?: string;
  "@_numarticles"?: string;
  "@_lastpostdate"?: string;
}

interface XmlArticle {
  "@_id": string;
  "@_username"?: string;
  "@_postdate"?: string;
  body?: string;
}

/** List the discussion forums (including the "Rules" subforum) for a game. */
export async function listForums(bggId: number): Promise<BggForum[]> {
  const parsed = (await fetchXml(
    `${BGG_BASE_URL}/forumlist?id=${bggId}&type=thing`,
  )) as { forums?: { forum?: XmlForum | XmlForum[] } };

  return asArray(parsed?.forums?.forum).map((f) => ({
    id: parseInt(f["@_id"], 10),
    title: decodeHtmlEntities(f["@_title"] ?? ""),
    numThreads: parseInt(f["@_numthreads"] ?? "0", 10),
    lastPostDate: f["@_lastpostdate"] ?? null,
  }));
}

/** List threads in a forum (most-recently-active first), one page at a time. */
export async function getForumThreads(
  forumId: number,
  page = 1,
): Promise<BggForumThread[]> {
  const parsed = (await fetchXml(
    `${BGG_BASE_URL}/forum?id=${forumId}&page=${page}`,
  )) as { forum?: { threads?: { thread?: XmlThread | XmlThread[] } } };

  return asArray(parsed?.forum?.threads?.thread).map((t) => ({
    id: parseInt(t["@_id"], 10),
    subject: decodeHtmlEntities(t["@_subject"] ?? ""),
    author: t["@_author"] ?? null,
    numArticles: parseInt(t["@_numarticles"] ?? "0", 10),
    lastPostDate: t["@_lastpostdate"] ?? null,
  }));
}

/** Fetch the posts in a thread, with bodies converted to plain text. */
export async function getThread(
  threadId: number,
  maxArticles = 20,
): Promise<{ subject: string; articles: BggForumArticle[] }> {
  const parsed = (await fetchXml(`${BGG_BASE_URL}/thread?id=${threadId}`)) as {
    thread?: {
      "@_subject"?: string;
      articles?: { article?: XmlArticle | XmlArticle[] };
    };
  };

  const subject = decodeHtmlEntities(parsed?.thread?.["@_subject"] ?? "");
  const articles = asArray(parsed?.thread?.articles?.article)
    .slice(0, maxArticles)
    .map((a) => ({
      id: parseInt(a["@_id"], 10),
      author: a["@_username"] ?? null,
      postDate: a["@_postdate"] ?? null,
      body: htmlToText(a.body ?? ""),
    }));

  return { subject, articles };
}

/** Find a game's "Rules" subforum, falling back to the general/variants forum. */
export function findRulesForum(forums: BggForum[]): BggForum | null {
  return (
    forums.find((f) => /rules/i.test(f.title)) ??
    forums.find((f) => /variant|general/i.test(f.title)) ??
    forums[0] ??
    null
  );
}
