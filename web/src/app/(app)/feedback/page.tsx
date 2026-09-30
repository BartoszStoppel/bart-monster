import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { SubmitFeedbackForm } from "./submit-form";
import { FeedbackList } from "./feedback-list";
import type { FeedbackItemWithProfile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = await isAdmin(supabase);

  const { data: items } = await supabase
    .from("feedback")
    .select("*, profiles(display_name, avatar_url)")
    .order("created_at", { ascending: false });

  const feedbackItems = (items ?? []) as FeedbackItemWithProfile[];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-stack-loose">
      <section className="flex flex-col gap-stack-compact">
        <h1 className="font-display text-display-lg text-primary">The Suggestion Box</h1>
        <p className="max-w-2xl text-on-surface-variant">
          Found a bug lurking in the dungeon, or have a feature to conjure? Scribe
          it here and track its fate.
        </p>
      </section>

      <div className="glass-card rounded-lg p-6">
        <h2 className="mb-4 font-display text-headline-lg text-on-surface">
          Submit feedback
        </h2>
        <SubmitFeedbackForm />
      </div>

      <FeedbackList
        items={feedbackItems}
        isAdmin={admin}
        userId={user?.id ?? ""}
      />
    </div>
  );
}
