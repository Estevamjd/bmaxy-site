import { z } from "zod";
import { platformContent, type PlatformLocale } from "@/content/platform";

export function createLoginSchema(locale: PlatformLocale) {
  const messages = platformContent[locale].validation;
  return z.object({
    email: z.string().trim().min(1, messages.emailRequired).email(messages.emailInvalid),
    password: z.string().min(1, messages.passwordRequired),
  });
}

export function createForgotPasswordSchema(locale: PlatformLocale) {
  const messages = platformContent[locale].validation;
  return z.object({
    email: z.string().trim().min(1, messages.emailRequired).email(messages.emailInvalid),
  });
}

export function createResetPasswordSchema(locale: PlatformLocale) {
  const messages = platformContent[locale].validation;
  return z
    .object({
      password: z.string().min(8, messages.passwordMinimum.replace("{minimum}", "8")),
      confirmPassword: z.string().min(1, messages.confirmNewPassword),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: messages.passwordsMismatch,
      path: ["confirmPassword"],
    });
}

/** Compatibilidade com os testes e consumidores PT existentes. */
export const loginSchema = createLoginSchema("pt");
export const forgotPasswordSchema = createForgotPasswordSchema("pt");
export const resetPasswordSchema = createResetPasswordSchema("pt");

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
