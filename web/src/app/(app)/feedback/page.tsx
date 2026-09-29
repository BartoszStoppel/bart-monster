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
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Feedback
      </h1>

      <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
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
