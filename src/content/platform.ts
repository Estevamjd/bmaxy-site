export type PlatformLocale = "pt" | "en";

export const PLATFORM_LOCALE_COOKIE = "bmaxy_locale";

export type PlatformShellLabels = {
  skipToContent: string;
  backToSite: string;
  logOut: string;
  expandSidebar: string;
  collapseSidebar: string;
  collapse: string;
  openMenu: string;
  closeMenu: string;
};

export type PlatformContent = {
  htmlLang: "pt-BR" | "en-US";
  common: {
    showPassword: string;
    hidePassword: string;
    wait: string;
    email: string;
    password: string;
    backToSite: string;
  };
  localeSwitch: {
    label: string;
    pt: string;
    en: string;
    pending: string;
    error: string;
  };
  shell: PlatformShellLabels;
  auth: {
    configuring: { title: string; subtitle: string; body: string };
    login: {
      metaTitle: string;
      title: string;
      subtitle: string;
      noAccount: string;
      createAccount: string;
      forgotPassword: string;
      submit: string;
      invalidLink: string;
    };
    signup: {
      metaTitle: string;
      title: string;
      subtitle: string;
      unavailableTitle: string;
      unavailableBody: string;
      successFallback: string;
      goToLogin: string;
      fullName: string;
      passwordLabel: string;
      confirmPassword: string;
      acceptPrefix: string;
      terms: string;
      acceptMiddle: string;
      privacy: string;
      submit: string;
      hasAccount: string;
    };
    forgot: {
      metaTitle: string;
      title: string;
      subtitle: string;
      submit: string;
      backToLogin: string;
    };
    reset: {
      metaTitle: string;
      expiredTitle: string;
      expiredSubtitle: string;
      recoverPassword: string;
      title: string;
      subtitle: string;
      newPassword: string;
      confirmPassword: string;
      submit: string;
    };
    denied: {
      metaTitle: string;
      title: string;
      subtitle: string;
      body: string;
      logOut: string;
    };
  };
  validation: {
    emailRequired: string;
    emailInvalid: string;
    passwordRequired: string;
    passwordMinimum: string;
    confirmPassword: string;
    confirmNewPassword: string;
    passwordsMismatch: string;
    fullNameRequired: string;
    fullNameTooLong: string;
    termsRequired: string;
  };
  actions: {
    invalidData: string;
    platformUnavailable: string;
    loginInvalid: string;
    loginRateLimited: string;
    emailNotConfirmed: string;
    loginUnavailable: string;
    resetRequestSuccess: string;
    sessionExpired: string;
    resetFailed: string;
    resetPartialFailure: string;
    signupUnavailable: string;
    signupConfirmEmail: string;
    signupSuccess: string;
    signupEmailTaken: string;
    signupFailed: string;
    securityExpired: string;
    securityFailed: string;
    securityUnavailable: string;
  };
};

const pt: PlatformContent = {
  htmlLang: "pt-BR",
  common: {
    showPassword: "Mostrar",
    hidePassword: "Ocultar",
    wait: "Aguarde…",
    email: "E-mail",
    password: "Senha",
    backToSite: "Voltar ao site",
  },
  localeSwitch: {
    label: "Idioma",
    pt: "PT-BR",
    en: "English",
    pending: "Alterando idioma…",
    error: "Não foi possível alterar o idioma. Tente novamente.",
  },
  shell: {
    skipToContent: "Pular para o conteúdo",
    backToSite: "Voltar ao site",
    logOut: "Sair",
    expandSidebar: "Expandir o menu lateral",
    collapseSidebar: "Recolher o menu lateral",
    collapse: "Recolher",
    openMenu: "Abrir o menu",
    closeMenu: "Fechar o menu",
  },
  auth: {
    configuring: {
      title: "Plataforma em configuração",
      subtitle: "Volte em breve.",
      body: "Esta área depende de uma integração que ainda está sendo configurada. Ela não afeta o restante do site.",
    },
    login: {
      metaTitle: "Entrar",
      title: "Entrar",
      subtitle: "Acesse a área do aluno ou o painel administrativo.",
      noAccount: "Ainda não tem conta?",
      createAccount: "Criar conta",
      forgotPassword: "Esqueci minha senha",
      submit: "Entrar",
      invalidLink:
        "Esse link de e-mail não vale mais. Ele expira depois de um tempo, só funciona uma vez e precisa ser aberto no mesmo navegador em que você pediu a recuperação. Peça um novo em “Esqueci minha senha”.",
    },
    signup: {
      metaTitle: "Criar conta",
      title: "Criar conta",
      subtitle: "A conta é o que libera a aula 1 do curso Seu Livro, sem custo.",
      unavailableTitle: "O cadastro está sendo ativado.",
      unavailableBody:
        "O formulário abaixo já valida os dados, mas ainda não existe conta no fim dele — nada é salvo e nada é enviado por e-mail. Assim que o cadastro entrar no ar, ele passa a funcionar nesta mesma tela.",
      successFallback: "Conta criada. Você já pode entrar.",
      goToLogin: "Ir para o login",
      fullName: "Nome completo",
      passwordLabel: "Senha (mínimo {minimum} caracteres)",
      confirmPassword: "Confirmar senha",
      acceptPrefix: "Li e aceito os",
      terms: "Termos de Uso",
      acceptMiddle: "e a",
      privacy: "Política de Privacidade",
      submit: "Criar conta",
      hasAccount: "Já tenho uma conta",
    },
    forgot: {
      metaTitle: "Recuperar senha",
      title: "Recuperar senha",
      subtitle: "Enviamos um link de redefinição para o seu e-mail cadastrado.",
      submit: "Enviar link de redefinição",
      backToLogin: "Voltar para o login",
    },
    reset: {
      metaTitle: "Redefinir senha",
      expiredTitle: "Link expirado",
      expiredSubtitle: "Peça um novo link de redefinição.",
      recoverPassword: "Recuperar senha",
      title: "Definir nova senha",
      subtitle: "Escolha uma senha com pelo menos 8 caracteres.",
      newPassword: "Nova senha",
      confirmPassword: "Confirmar nova senha",
      submit: "Salvar nova senha",
    },
    denied: {
      metaTitle: "Acesso não disponível",
      title: "Acesso não disponível",
      subtitle: "Sua conta ainda não tem um perfil configurado nesta plataforma.",
      body: "Fale com o administrador para liberar seu acesso. Se você acha que isso é um erro, tente sair e entrar novamente.",
      logOut: "Sair",
    },
  },
  validation: {
    emailRequired: "Digite seu e-mail.",
    emailInvalid: "E-mail inválido.",
    passwordRequired: "Digite sua senha.",
    passwordMinimum: "A senha precisa ter pelo menos {minimum} caracteres.",
    confirmPassword: "Confirme a senha.",
    confirmNewPassword: "Confirme a nova senha.",
    passwordsMismatch: "As senhas não coincidem.",
    fullNameRequired: "Digite seu nome completo.",
    fullNameTooLong: "Nome muito longo.",
    termsRequired: "É preciso aceitar os termos para continuar.",
  },
  actions: {
    invalidData: "Dados inválidos.",
    platformUnavailable: "A plataforma ainda está sendo configurada. Tente novamente mais tarde.",
    loginInvalid: "E-mail ou senha incorretos.",
    loginRateLimited: "Muitas tentativas de entrada. Aguarde alguns minutos e tente de novo.",
    emailNotConfirmed:
      "Confirme seu e-mail antes de entrar. Procure a mensagem de confirmação na sua caixa de entrada — veja também o spam.",
    loginUnavailable: "Não foi possível entrar agora. Tente de novo em alguns instantes.",
    resetRequestSuccess:
      "Se esse e-mail estiver cadastrado, enviamos um link de redefinição de senha para ele.",
    sessionExpired: "Sessão expirada. Peça um novo link de redefinição de senha.",
    resetFailed: "Não foi possível redefinir a senha. Tente novamente.",
    resetPartialFailure:
      "Sua senha foi alterada, mas não conseguimos concluir a liberação do acesso. Entre novamente com a senha nova; se esta tela pedir a troca outra vez, fale com o suporte.",
    signupUnavailable:
      "O cadastro ainda está sendo ativado, então a sua conta não foi criada. Nada do que você digitou foi salvo.",
    signupConfirmEmail: "Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar.",
    signupSuccess: "Conta criada. Você já pode entrar.",
    signupEmailTaken: "Já existe uma conta com este e-mail.",
    signupFailed: "Não foi possível criar a conta agora. Tente novamente em instantes.",
    securityExpired: "A verificação de segurança expirou. Tente enviar novamente.",
    securityFailed:
      "Não foi possível concluir a verificação de segurança. Recarregue a página e tente de novo.",
    securityUnavailable:
      "A verificação de segurança está indisponível no momento. Tente novamente em alguns instantes.",
  },
};

const en: PlatformContent = {
  htmlLang: "en-US",
  common: {
    showPassword: "Show",
    hidePassword: "Hide",
    wait: "Please wait…",
    email: "Email",
    password: "Password",
    backToSite: "Back to the website",
  },
  localeSwitch: {
    label: "Language",
    pt: "PT-BR",
    en: "English",
    pending: "Changing language…",
    error: "We couldn't change the language. Please try again.",
  },
  shell: {
    skipToContent: "Skip to content",
    backToSite: "Back to the website",
    logOut: "Log Out",
    expandSidebar: "Expand sidebar",
    collapseSidebar: "Collapse sidebar",
    collapse: "Collapse",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
  auth: {
    configuring: {
      title: "Platform setup in progress",
      subtitle: "Please check back soon.",
      body: "This area depends on an integration that is still being configured. The rest of the website is available.",
    },
    login: {
      metaTitle: "Log In",
      title: "Log In",
      subtitle: "Access the Student Portal or the admin dashboard.",
      noAccount: "Don't have an account yet?",
      createAccount: "Sign Up",
      forgotPassword: "Forgot your password?",
      submit: "Log In",
      invalidLink:
        "This email link is no longer valid. Links expire, work only once, and must be opened in the same browser where you requested the reset. Request a new one from “Forgot your password?”.",
    },
    signup: {
      metaTitle: "Sign Up",
      title: "Sign Up",
      subtitle: "Your account unlocks the free first lesson of Write Your Book.",
      unavailableTitle: "Sign-up is being activated.",
      unavailableBody:
        "The form already validates your information, but it cannot create an account yet. Nothing is saved and no email is sent. Once sign-up is available, this same page will work without any extra steps.",
      successFallback: "Account created. You can now log in.",
      goToLogin: "Go to Log In",
      fullName: "Full name",
      passwordLabel: "Password ({minimum} characters minimum)",
      confirmPassword: "Confirm password",
      acceptPrefix: "I have read and agree to the",
      terms: "Terms of Use",
      acceptMiddle: "and the",
      privacy: "Privacy Policy",
      submit: "Sign Up",
      hasAccount: "I already have an account",
    },
    forgot: {
      metaTitle: "Reset Password",
      title: "Reset Password",
      subtitle: "We'll send a reset link to the email address on your account.",
      submit: "Send Reset Link",
      backToLogin: "Back to Log In",
    },
    reset: {
      metaTitle: "Set a New Password",
      expiredTitle: "Link Expired",
      expiredSubtitle: "Request a new password reset link.",
      recoverPassword: "Reset Password",
      title: "Set a New Password",
      subtitle: "Choose a password with at least 8 characters.",
      newPassword: "New password",
      confirmPassword: "Confirm new password",
      submit: "Save New Password",
    },
    denied: {
      metaTitle: "Access Unavailable",
      title: "Access Unavailable",
      subtitle: "Your account does not have a platform profile yet.",
      body: "Contact the administrator to enable your access. If you believe this is a mistake, log out and try again.",
      logOut: "Log Out",
    },
  },
  validation: {
    emailRequired: "Enter your email address.",
    emailInvalid: "Enter a valid email address.",
    passwordRequired: "Enter your password.",
    passwordMinimum: "Your password must be at least {minimum} characters.",
    confirmPassword: "Confirm your password.",
    confirmNewPassword: "Confirm your new password.",
    passwordsMismatch: "The passwords do not match.",
    fullNameRequired: "Enter your full name.",
    fullNameTooLong: "Your name is too long.",
    termsRequired: "You must accept the terms to continue.",
  },
  actions: {
    invalidData: "The information provided is invalid.",
    platformUnavailable: "The platform is still being configured. Please try again later.",
    loginInvalid: "Incorrect email or password.",
    loginRateLimited: "Too many login attempts. Wait a few minutes and try again.",
    emailNotConfirmed: "Confirm your email before logging in. Check your inbox and spam folder.",
    loginUnavailable: "We couldn't log you in right now. Please try again in a moment.",
    resetRequestSuccess:
      "If that email address is registered, we sent it a password reset link.",
    sessionExpired: "Your session has expired. Request a new password reset link.",
    resetFailed: "We couldn't reset your password. Please try again.",
    resetPartialFailure:
      "Your password was changed, but we couldn't finish restoring access. Log in again with your new password. If you are asked to change it again, contact support.",
    signupUnavailable:
      "Sign-up is still being activated, so your account was not created. None of the information you entered was saved.",
    signupConfirmEmail: "Account created. Check your email and confirm your account before logging in.",
    signupSuccess: "Account created. You can now log in.",
    signupEmailTaken: "An account already exists for this email address.",
    signupFailed: "We couldn't create your account right now. Please try again in a moment.",
    securityExpired: "The security check expired. Please submit the form again.",
    securityFailed: "We couldn't complete the security check. Reload the page and try again.",
    securityUnavailable: "The security check is temporarily unavailable. Please try again in a moment.",
  },
};

export const platformContent: Record<PlatformLocale, PlatformContent> = { pt, en };

export function isPlatformLocale(value: unknown): value is PlatformLocale {
  return value === "pt" || value === "en";
}

export function platformHomePath(locale: PlatformLocale): "/" | "/en" {
  return locale === "en" ? "/en" : "/";
}
