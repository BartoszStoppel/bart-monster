import { invalidateData } from "@/lib/api";
export function revalidatePath(_path: string) {
  invalidateData(true);
}
