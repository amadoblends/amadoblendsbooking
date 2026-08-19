import { createClient } from "@/lib/supabase/server";
import { DEFAULT_BIRTHDAY, type BirthdaySettings } from "@/lib/client-rules";

/**
 * The birthday rules the barber set, read from the client's side.
 *
 * Falls back to the defaults — which have the discount switched off — when the
 * columns aren't there yet, so a pending migration shows no offer rather than
 * breaking the home screen.
 */
export async function getBirthdaySettings(): Promise<BirthdaySettings> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_settings")
    .select(
      "birthday_enabled, birthday_kind, birthday_amount, birthday_window_days, birthday_service_ids"
    )
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_BIRTHDAY;

  return {
    birthday_enabled: Boolean(data.birthday_enabled),
    birthday_kind: data.birthday_kind === "fixed" ? "fixed" : "percent",
    birthday_amount: Number(data.birthday_amount ?? DEFAULT_BIRTHDAY.birthday_amount),
    birthday_window_days: Number(
      data.birthday_window_days ?? DEFAULT_BIRTHDAY.birthday_window_days
    ),
    birthday_service_ids: (data.birthday_service_ids as string[] | null) ?? [],
  };
}
