import { createClient } from "@/lib/supabase/server";

export interface Business {
  name: string;
  logo_url: string | null;
  cover_url: string | null;
  description: string | null;
  instagram: string | null;
  address: string | null;
  phone: string | null;
}

const FALLBACK: Business = {
  name: "Amado Blends",
  logo_url: null,
  cover_url: null,
  description: null,
  instagram: null,
  address: null,
  phone: null,
};

/**
 * The shop's public identity. Read publicly (no admin session needed) and
 * degrades to the fallback when migrations 20/21 haven't run yet, so the
 * client app never breaks over branding that isn't set up.
 */
export async function getBusiness(): Promise<Business> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_settings")
    .select("name, logo_url, cover_url, description, instagram, address, phone")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) return FALLBACK;
  return { ...FALLBACK, ...data };
}
