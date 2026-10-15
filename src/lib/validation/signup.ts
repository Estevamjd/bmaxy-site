import { z } from "zod";
import { platformContent, type PlatformLocale } from "@/content/platform";

/**
 * Schema do cadastro público (`/cadastro`).
 *
 * Vive separado de `auth.ts` porque é o único formulário da plataforma que
 * NÃO tem provedor ligado ainda — quando o provedor real entrar, é este
 * schema que valida a entrada antes de qualquer chamada de rede, e ele não
 * deve mudar por causa disso.
 *
 * As mesmas regras rodam no cliente (feedback imediato, sem ida ao servidor)
 * e no Server Action. O cliente é conveniência; o servidor é a validação que
 * vale — ver src/lib/actions/signup.ts.
 */

export const MIN_PASSWORD_LENGTH = 8;

export function createSignupSchema(locale: PlatformLocale) {
  const messages = platformContent[locale].validation;
  return z
    .object({
      fullName: z
        .string()
        .trim()
        .min(3, messages.fullNameRequired)
        .max(120, messages.fullNameTooLong),
      email: z
        .string()
        .trim()
        .min(1, messages.emailRequired)
        .email(messages.emailInvalid),
      password: z
        .string()
        .min(
          MIN_PASSWORD_LENGTH,
          messages.passwordMinimum.replace("{minimum}", String(MIN_PASSWORD_LENGTH)),
        ),
      confirmPassword: z.string().min(1, messages.confirmPassword),
      // Vem como boolean, não como o "on" cru do FormData: quem converte é o
      // Server Action, para o schema servir igual a um formulário JSON no dia
      // em que existir um.
      acceptTerms: z.boolean(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: messages.passwordsMismatch,
      path: ["confirmPassword"],
    })
    .refine((data) => data.acceptTerms, {
      message: messages.termsRequired,
      path: ["acceptTerms"],
    });
}

/** Compatibilidade com os testes e consumidores PT existentes. */
export const signupSchema = createSignupSchema("pt");

export type SignupInput = z.infer<typeof signupSchema>;
export type SignupField = keyof SignupInput;
