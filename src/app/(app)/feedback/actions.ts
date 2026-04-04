"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import type { FeedbackCategory, FeedbackStatus } from "@/types/database";

/**
 * Submit a new feedback item.
 * @param title - Short summary of the request
 * @param description - Detailed description
 * @param category - "feature" | "bug" | "improvement"
 */
export async function submitFeedback(
  title: string,
  description: string,
  category: FeedbackCategory,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  if (!trimmedTitle || !trimmedDescription) {
    throw new Error("Title and description are required");
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    title: trimmedTitle,
    description: trimmedDescription,
    category,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/feedback");
}

/**
 * Update the status and optional admin note on a feedback item. Admin-only.
 * @param feedbackId - UUID of the feedback item
 * @param status - New status value
 * @param adminNote - Optional note from admin
 */
export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
  adminNote?: string,
) {
  const supabase = await createClient();

  const admin = await isAdmin(supabase);
  if (!admin) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("feedback")
    .update({
      status,
      admin_note: adminNote?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", feedbackId);

  if (error) throw new Error(error.message);

  revalidatePath("/feedback");
}

/**
 * Delete a feedback item. Only the owner can delete, and only while status is 'new'.
 * @param feedbackId - UUID of the feedback item
 */
export async function deleteFeedback(feedbackId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("feedback")
    .delete()
    .eq("id", feedbackId)
    .eq("user_id", user.id)
    .eq("status", "new");

  if (error) throw new Error(error.message);

  revalidatePath("/feedback");
}
