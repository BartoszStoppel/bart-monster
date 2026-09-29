import { action } from "@/lib/api";
export function submitFeedback(
  title: string,
  description: string,
  category: string,
) {
  return action("submitFeedback", { title, description, category });
}
export function updateFeedbackStatus(
  feedbackId: string,
  status: string,
  adminNote?: string,
) {
  return action("updateFeedbackStatus", { feedbackId, status, adminNote });
}
export function deleteFeedback(feedbackId: string) {
  return action("deleteFeedback", { feedbackId });
}
