"use server";

import { revalidatePath } from "next/cache";
import { platformContent, isPlatformLocale } from "@/content/platform";
import { getAuthContext } from "@/lib/auth/session";
import { getLocaleCookie, setLocaleCookie } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/server";

export type LocaleActionState = { status: "success" } | { status: "error"; message: string };

/**
 * Troca o idioma da plataforma. Para visitantes, persiste apenas o cookie.
 * Para usuários autenticados, atualiza primeiro a própria linha protegida por
 * RLS e só então o cookie, evitando duas fontes de verdade divergentes.
 */
export async function updateLocaleAction(
  _previousState: LocaleActionState | undefined,
  formData: FormData,
): Promise<LocaleActionState> {
  const requested = formData.get("locale");
  const fallback = await getLocaleCookie();
  const locale = isPlatformLocale(requested) ? requested : fallback;

  if (!isPlatformLocale(requested)) {
    return { status: "error", message: platformContent[locale].localeSwitch.error };
  }

  const auth = await getAuthContext();
  if (auth) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ locale })
      .eq("id", auth.userId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return { status: "error", message: platformContent[auth.locale].localeSwitch.error };
    }
  }

  await setLocaleCookie(locale);
  revalidatePath("/", "layout");
  return { status: "success" };
}
