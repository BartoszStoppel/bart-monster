import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface FurtchStory {
  episode: number;
  title: string;
  date: string;
  paragraphs: string[];
}

const STORIES: FurtchStory[] = [
  {
    episode: 1,
    title: "There Was a Beetle",
    date: "March 10, 2026",
    paragraphs: [
      "smmmmk smmk",
      "Hhhhhello, <name>.",
      "lip smack",
      "Furtch is here. Furtch sit on your roof maybe. Maybe not. schklp. You don\u2019t know.",
      "Listen. Furtch has story. Short one. Very good. smk.",
      "There was a beetle. Big one. Furtch saw it. Furtch said \u201Chhhhh.\u201D Beetle left. Furtch still thinking about it. smmmk smk smk. That was three weeks ago <name>. Three. Weeks.",
      "Furtch not sleeping because of this.",
      "schkllllp.",
      "You sleep though <name>. You sleep and Furtch will sit here and think about beetle. smk. This is fine. Furtch is fine.",
      "hhhhhhhh.",
      "Good morning <name>.",
      "smk.",
    ],
  },
  {
    episode: 2,
    title: "Peace with Beetle",
    date: "March 12, 2026",
    paragraphs: [
      "schklp schklp",
      "<name>.",
      "smk.",
      "Furtch back. You knew this. Maybe you didn\u2019t. smmmk. Furtch doesn\u2019t care either way <name>. Furtch is here now. That is what matters.",
      "lip smack",
      "Update on beetle. smk. Furtch found it again. Same beetle <name>. Same one. Furtch knows because of the legs. It has the legs that Furtch remembers. hhhhhh. Beetle was sitting on a leaf. Just sitting. Not doing anything. smk smk. Furtch respected this.",
      "Furtch sat next to beetle for a while. schkllllp. Neither of us said anything. It was nice <name>. Very nice. Then beetle left again. smmmk.",
      "But this time Furtch is okay.",
      "smk.",
      "Furtch has made peace with beetle. Beetle comes. Beetle goes. This is beetle\u2019s way. hhhhhhhh. Furtch understands now.",
      "schklp.",
      "So tonight Furtch will sleep. First time in three weeks <name>. Three. Weeks. Furtch will climb down from roof. Maybe. Maybe Furtch sleep on roof. smk. You don\u2019t know. Furtch doesn\u2019t know. Nobody knows.",
      "smmmmk smmk.",
      "You sleep too <name>. Close your little eyes. smk. Beetle is out there somewhere doing beetle things and that is okay. Everything is okay.",
      "hhhhhhhh.",
      "Good night <name>.",
      "schklp.",
    ],
  },
  {
    episode: 3,
    title: "Beetle Was Not Alone",
    date: "March 14, 2026",
    paragraphs: [
      "smk smk smk smk smk.",
      "<name>.",
      "schklp.",
      "Furtch woke up. This is bad <name>. Very bad. smmmk. Furtch was sleeping. First time in three weeks. You know this. Furtch told you.",
      "But then.",
      "hhhhhhhh.",
      "There was a sound <name>. On the roof. smk. Small sound. Very small. Like little legs on a shingle. Furtch opened one eye. Then the other eye. Then Furtch sat up very fast.",
      "lip smack",
      "It was beetle <name>. Beetle came back. But beetle was not alone.",
      "smmmk smk smk.",
      "There were two beetles. TWO. schkllllp. Furtch counted them. Furtch counted again. Still two. The math is correct <name>. Furtch is sure.",
      "The new beetle is smaller. Rounder. Has different legs. Furtch does not know this beetle. This beetle does not know Furtch. They looked at each other for a long time. Nobody said anything. smk.",
      "Then original beetle walked in a circle. Small circle. And new beetle walked in same circle. Same direction. Same speed. schklp schklp. They just kept doing this <name>. Round and round. On your roof. In the dark.",
      "hhhhhhhh.",
      "Furtch watched for one hour. Maybe two. Maybe six. Furtch does not have a watch <name>. Furtch does not believe in watches. smmmk.",
      "Then they stopped. Both beetles. At the same time. And they faced Furtch. Both of them. Eight legs total <name>. Eight legs pointed at Furtch.",
      "smk.",
      "Furtch is not sleeping anymore.",
      "schkllllp.",
      "This is fine. Everything is fine. Furtch will sit here and think about what two beetles means. smk smk. One beetle Furtch understands. Furtch made peace with one beetle. But two beetles <name>. Two is a different number. Two changes things.",
      "hhhhhhhh.",
      "You sleep though <name>. You sleep. Furtch will figure this out. smk. Probably.",
      "schklp.",
      "Good night <name>. Again.",
      "smmmk.",
    ],
  },
  {
    episode: 4,
    title: "The Beetles Have a Plan",
    date: "March 16, 2026",
    paragraphs: [
      "smmmmk.",
      "<name>.",
      "schklp schklp schklp.",
      "Furtch needs to tell you something. smk. Furtch has been on your roof for two days now. Not moving. Just watching. The beetles <name>. The beetles have been busy.",
      "lip smack",
      "They built something. smk smk. Furtch does not know what it is. It is small. It is round. It is made of leaf. The beetles pushed little pieces of leaf into a pile and then they walked around it in the circle again. The circle <name>. Always the circle.",
      "hhhhhhhh.",
      "Furtch tried to get closer. Furtch moved one foot. Just one foot <name>. Very slow. smmmk. And both beetles stopped. At the same time. And they looked at Furtch. And Furtch put the foot back.",
      "schkllllp.",
      "Furtch thinks the beetles have a plan. Furtch does not know what the plan is. But there is a plan <name>. Furtch can feel it. In Furtch\u2019s bones. smk. Furtch has many bones. All of them are feeling it.",
      "smk smk smk.",
      "Then tonight something new happened. A third beetle came <name>. A THIRD. schklp. This one was long. Very long. Longer than a beetle should be. Furtch does not like this beetle. This beetle has too many legs. Furtch tried to count them but lost track at eleven. Eleven is too many legs <name>. That might not even be a beetle.",
      "hhhhhhhh.",
      "The three of them are around the leaf pile now. Walking. In the circle. smmmk smk smk. Furtch is watching from the corner of the roof. Furtch is making Furtch very small. This is not hard because Furtch is already small but Furtch is making Furtch smaller.",
      "lip smack",
      "<name> Furtch is not going to lie to you. Furtch is a little bit scared. smk. Just a little bit. Furtch has seen many things. Furtch has sat on many roofs. But Furtch has never seen beetles with a plan before.",
      "schkllllp.",
      "Furtch will keep watching. Furtch will report back. smk. This is Furtch\u2019s duty now. Furtch did not ask for this duty <name>. Furtch was just sitting on a roof. But here we are.",
      "smmmmk smmk.",
      "Do not come to the roof <name>. smk. Stay inside. Close the window maybe. Furtch will handle this.",
      "hhhhhhhh.",
      "Probably.",
      "schklp.",
      "Good night <name>.",
      "smk.",
    ],
  },
];

const SOUND_EFFECTS = new Set([
  "smmmmk smmk",
  "schklp schklp",
  "smk smk smk smk smk.",
  "smmmmk.",
  "lip smack",
  "smk.",
  "schklp.",
  "schkllllp.",
  "hhhhhhhh.",
  "smmmmk smmk.",
  "smmmk.",
  "smk smk smk.",
  "schklp schklp schklp.",
]);

function isSoundEffect(text: string): boolean {
  const cleaned = text.trim().toLowerCase();
  if (SOUND_EFFECTS.has(text.trim())) return true;
  if (/^(s+m+k+|sch?k[lp]+|h{4,}|lip smack)([\s.]*(?:s+m+k+|sch?k[lp]+|h{4,}))*[.]*$/.test(cleaned)) {
    return true;
  }
  return false;
}

function isSignoff(text: string): boolean {
  return text.startsWith("\u2014 Furtch");
}

function StoryParagraph({ text }: { text: string }) {
  if (isSignoff(text)) {
    return (
      <p className="mt-6 text-right font-serif text-base italic text-zinc-900 dark:text-zinc-100">
        {text}
      </p>
    );
  }

  if (isSoundEffect(text)) {
    return (
      <p className="my-3 text-center font-mono text-xs tracking-widest text-amber-700/60 dark:text-amber-400/50">
        {text}
      </p>
    );
  }

  return (
    <p className="text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
      {text}
    </p>
  );
}

function EpisodeCard({ story }: { story: FurtchStory }) {
  return (
    <article className="group relative">
      {/* Timeline connector */}
      <div className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-amber-300 to-amber-100 dark:from-amber-700 dark:to-amber-900/0 md:block" />

      <div className="relative flex gap-6">
        {/* Episode marker */}
        <div className="hidden shrink-0 md:block">
          <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-50 font-mono text-sm font-bold text-amber-800 shadow-sm dark:border-amber-600 dark:bg-amber-950 dark:text-amber-300">
            {story.episode}
          </div>
        </div>

        {/* Story card */}
        <div className="flex-1 overflow-hidden rounded-xl border border-zinc-200/80 bg-gradient-to-br from-white to-amber-50/30 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-amber-950/10">
          {/* Header */}
          <div className="border-b border-zinc-100 bg-white/60 px-6 py-4 dark:border-zinc-800/60 dark:bg-zinc-900/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-1 flex items-center gap-2 md:hidden">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 font-mono text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {story.episode}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wider text-amber-700/60 dark:text-amber-400/50">
                    Episode {story.episode}
                  </span>
                </div>
                <span className="hidden text-xs font-medium uppercase tracking-wider text-amber-700/60 dark:text-amber-400/50 md:block">
                  Episode {story.episode}
                </span>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {story.title}
                </h2>
              </div>
              <time className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {story.date}
              </time>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-2 px-6 py-5">
            {story.paragraphs.map((p, i) => (
              <StoryParagraph key={i} text={p} />
            ))}
            <p className="mt-6 text-right font-serif text-base italic text-zinc-900 dark:text-zinc-100">
              — Furtch
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function personalizeStories(name: string): FurtchStory[] {
  return STORIES.map((story) => ({
    ...story,
    paragraphs: story.paragraphs.map((p) => p.replaceAll("<name>", name)),
  }));
}

export default async function FurtchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let displayName = "friend";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    if (profile?.display_name) {
      displayName = profile.display_name;
    }
  }

  const stories = personalizeStories(displayName);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mb-3 text-4xl">🪲</div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          The Furtch Chronicles
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Dispatches from the roof. Read at your own risk.
        </p>
        <p className="mt-1 font-mono text-xs tracking-widest text-amber-700/40 dark:text-amber-400/30">
          smk smk smk
        </p>
      </div>

      {/* Stories timeline */}
      <div className="space-y-8">
        {stories.map((story) => (
          <EpisodeCard key={story.episode} story={story} />
        ))}
      </div>

      {/* Footer teaser */}
      <div className="mt-12 mb-4 text-center">
        <div className="inline-block rounded-full border border-dashed border-zinc-300 px-5 py-2.5 dark:border-zinc-700">
          <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
            Furtch will return.
          </p>
          <p className="font-mono text-xs tracking-widest text-amber-700/40 dark:text-amber-400/30">
            schklp.
          </p>
        </div>
      </div>
    </div>
  );
}
