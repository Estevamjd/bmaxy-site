import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { getAuthContext } from "@/lib/auth/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  isPlatformLocale,
  PLATFORM_LOCALE_COOKIE,
  platformHomePath,
  platformContent,
  type PlatformContent,
  type PlatformLocale,
} from "@/content/platform";

export { PLATFORM_LOCALE_COOKIE } from "@/content/platform";

export const localeHomePath = platformHomePath;

export async function getLocaleCookie(): Promise<PlatformLocale> {
  const value = (await cookies()).get(PLATFORM_LOCALE_COOKIE)?.value;
  return isPlatformLocale(value) ? value : "pt";
}

/**
 * Na plataforma, o perfil autenticado é a fonte de verdade. O cookie existe
 * para as telas anteriores ao login e para preservar a preferência após sair.
 */
export const getPlatformLocale = cache(async (): Promise<PlatformLocale> => {
  const auth = await getAuthContext();
  return auth?.locale ?? getLocaleCookie();
});

export async function getPlatformContent(): Promise<PlatformContent> {
  return platformContent[await getPlatformLocale()];
}

export async function setLocaleCookie(locale: PlatformLocale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PLATFORM_LOCALE_COOKIE, locale, {
    httpOnly: true,
    secure: getSupabaseEnv().siteUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
