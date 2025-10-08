"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import {
  register as registerRequest,
  sendVerificationCode,
  verifyAccount,
  extractErrorMessage,
  type RegisterPayload,
} from "@/lib/api";
import useAuth from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { LucideIcon } from "@/components/LucideIcon";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultView?: "login" | "register" | "verify";
}

type AuthView = "login" | "register" | "verify" | "forgot";

const REGISTER_STEPS = ["Dados pessoais", "Contato", "Senha"];

export function AuthModal({ isOpen, onClose, defaultView = "login" }: AuthModalProps) {
  const { login, refresh } = useAuth();
  const router = useRouter();

  const [activeView, setActiveView] = useState<AuthView>(defaultView);
  const [registerStep, setRegisterStep] = useState(0);
  const [loginError, setLoginError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifySuccess, setVerifySuccess] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    referralCode: "",
  });
  const [verifyForm, setVerifyForm] = useState({ email: "", code: "" });
  const [forgotEmail, setForgotEmail] = useState("");

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [isViewTransitioning, setIsViewTransitioning] = useState(false);

  const translateAuthMessage = useCallback((message: string) => {
    if (!message) {
      return "Ocorreu um erro inesperado. Tente novamente.";
    }

    const normalized = message.toLowerCase();

    if (normalized.includes("invalid credentials") || normalized.includes("incorrect password") || normalized.includes("unauthorized")) {
      return "E-mail ou senha incorretos.";
    }

    if (normalized.includes("user already exists") || normalized.includes("email already") || normalized.includes("account already")) {
      return "Este e-mail j? est? cadastrado.";
    }

    if (normalized.includes("verification code") || normalized.includes("code invalid") || normalized.includes("code expired")) {
      return "C?digo de verifica??o inv?lido ou expirado.";
    }

    if (normalized.includes("too many attempts") || normalized.includes("too many requests") || normalized.includes("rate limit")) {
      return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
    }

    if (normalized.includes("password")) {
      return "Senha inv?lida. Verifique os requisitos informados.";
    }

    if (normalized.includes("user not found") || normalized.includes("no user")) {
      return "Usu?rio n?o localizado. Verifique o e-mail informado.";
    }

    if (normalized.includes("not verified")) {
      return "Sua conta ainda n?o foi verificada.";
    }

    return message;
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveView(defaultView);
    }
  }, [isOpen, defaultView]);

  useEffect(() => {
    if (!isOpen) {
      setRegisterStep(0);
      setLoginError("");
      setLoginSuccess("");
      setRegisterError("");
      setRegisterSuccess("");
      setVerifyError("");
      setVerifySuccess("");
      setForgotMessage("");
      setForgotError("");
      setLoginForm({ email: "", password: "" });
      setRegisterForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        referralCode: "",
      });
      setVerifyForm({ email: "", code: "" });
      setForgotEmail("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    body.style.overflow = "hidden";

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsOverlayVisible(false);
      return;
    }

    setIsOverlayVisible(false);

    if (typeof window === "undefined") {
      setIsOverlayVisible(true);
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setIsOverlayVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsViewTransitioning(false);
      return;
    }

    setIsViewTransitioning(true);

    if (typeof window === "undefined") {
      setIsViewTransitioning(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsViewTransitioning(false);
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeView, isOpen]);

  const loginMutation = useMutation({
    mutationFn: async () => {
      await login({ email: loginForm.email.trim(), password: loginForm.password });
    },
    onSuccess: () => {
      setLoginSuccess("Login realizado com sucesso! Redirecionando...");
      setLoginError("");
      setTimeout(() => {
        onClose();
      }, 600);
    },
    onError: (error: unknown) => {
    setLoginSuccess("");
    const errorMessage = extractErrorMessage(error);

    // Verifica especificamente pelo erro de conta não verificada
    if (errorMessage && errorMessage.toLowerCase().includes("account not verified")) {
      // Preenche o formulário de verificação com o e-mail da tentativa de login
      setVerifyForm({ email: loginForm.email.trim(), code: "" });

      // Muda para a tela de verificação
      setActiveView("verify");

      // Dispara o reenvio de um novo código de verificação
      sendVerificationCodeMutation.mutate(loginForm.email.trim());

      // Limpa o erro de login, pois o fluxo mudou
      setLoginError("");
    } else {
      // Para qualquer outro erro, exibe a mensagem no formulário de login
      setLoginError(translateAuthMessage(errorMessage));
    }
  },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const payload: RegisterPayload = {
        email: registerForm.email.trim(),
        password: registerForm.password,
        first_name: registerForm.firstName.trim(),
        last_name: registerForm.lastName.trim(),
        applied_referral_code: registerForm.referralCode.trim() || undefined,
      };
      await registerRequest(payload);
      return payload.email.trim();
    },
    onSuccess: (email) => {
      setRegisterError("");
      setRegisterSuccess("Conta criada! Enviamos um código de verificação para o seu e-mail.");
      setVerifyError("");
      setVerifySuccess("Enviamos um código de verificação. Confira seu e-mail.");
      setVerifyForm({ email, code: "" });
      setActiveView("verify");
      setRegisterStep(0);
    },
    onError: (error: unknown) => {
      setRegisterSuccess("");
      const message = extractErrorMessage(error);
      setRegisterError(translateAuthMessage(message));
    },
  });

  const sendVerificationCodeMutation = useMutation({
    mutationFn: (email: string) => sendVerificationCode(email),
    onError: (error: unknown) => {
      setVerifyError(translateAuthMessage(extractErrorMessage(error)));
    },
    onSuccess: () => {
      setVerifyError("");
      setVerifySuccess("Código reenviado com sucesso! Confira seu e-mail.");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () =>
      verifyAccount({
        email: verifyForm.email.trim(),
        code: verifyForm.code.trim(),
      }),
    onSuccess: async () => {
      setVerifyError("");
      setVerifySuccess("Conta verificada com sucesso! Redirecionando...");

      // 1. O backend já autenticou. Apenas sincronizamos o estado do frontend.
      //    A função refresh() do seu useAuth cuida disso.
      await refresh();

      // 3. Fecha o modal.
      setTimeout(() => {
        onClose();
      }, 600);
    },
    onError: (error: unknown) => {
      setVerifySuccess("");
      setVerifyError(translateAuthMessage(extractErrorMessage(error)));
    },
  });

  const passwordChecks = useMemo(() => {
    const value = registerForm.password;
    return {
      length: value.length >= 6,
      uppercase: /[A-Z]/.test(value),
      lowercase: /[a-z]/.test(value),
    };
  }, [registerForm.password]);

  const passwordFeedback = useMemo(
    () => [
      { id: "length", label: "Mínimo de 6 caracteres", met: passwordChecks.length },
      { id: "uppercase", label: "Inclua pelo menos 1 letra maiúscula", met: passwordChecks.uppercase },
      { id: "lowercase", label: "Inclua pelo menos 1 letra minúscula", met: passwordChecks.lowercase },
    ],
    [passwordChecks.length, passwordChecks.lowercase, passwordChecks.uppercase]
  );

  const isPasswordValid = useMemo(
    () => passwordFeedback.every((rule) => rule.met),
    [passwordFeedback]
  );

  const passwordsMatch = useMemo(
    () =>
      registerForm.password !== "" &&
      registerForm.password === registerForm.confirmPassword,
    [registerForm.password, registerForm.confirmPassword]
  );
  const handleLoginSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    setLoginSuccess("");
    loginMutation.mutate();
  };

  const handleRegisterNext = () => {
    if (registerStep === 0) {
      if (!registerForm.firstName.trim() || !registerForm.lastName.trim()) {
        setRegisterError("Informe nome e sobrenome.");
        return;
      }
    }
    if (registerStep === 1) {
      if (!registerForm.email.trim()) {
        setRegisterError("Informe um e-mail válido.");
        return;
      }
    }
    setRegisterError("");
    setRegisterStep((step) => Math.min(step + 1, REGISTER_STEPS.length - 1));
  };

  const handleRegisterBack = () => {
    setRegisterError("");
    setRegisterStep((step) => Math.max(step - 1, 0));
  };

  const handleRegisterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isPasswordValid || !passwordsMatch) {
      setRegisterError("Verifique a senha informada.");
      return;
    }
    setRegisterError("");
    setRegisterSuccess("");
    registerMutation.mutate();
  };

  const handleVerifySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVerifyError("");
    setVerifySuccess("");
    verifyMutation.mutate();
  };

  const handleForgotSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError("Informe um e-mail válido.");
      return;
    }
    setForgotError("");
    setForgotMessage("Enviaremos instruções para redefinição em breve.");
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={clsx(
        "auth-modal-overlay fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6",
        isOverlayVisible ? "auth-modal-overlay--visible" : "auth-modal-overlay--hidden"
      )}
      role="dialog"
      aria-modal="true"
    >
      <div
        id="auth-card"
        className={clsx(
          "auth-card relative flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl",
          isOverlayVisible ? "auth-card--entered" : "auth-card--hidden",
          isViewTransitioning && "auth-card--switching"
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 text-sm font-semibold text-red-500 hover:underline"
        >
          Fechar janela
        </button>

        <div className="border-b border-slate-200 p-5 text-center sm:p-6">
          <Image
            src="https://i.imgur.com/64Tovft.png"
            alt="Logotipo CalculaConfia"
            width={160}
            height={40}
            className="mx-auto mb-3 h-9 w-auto sm:mb-4 sm:h-10"
            priority={false}
          />
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              className={clsx(
                "auth-tab px-5 py-1.5 text-sm font-semibold rounded-md",
                activeView === "login" && "active-tab"
              )}
              onClick={() => setActiveView("login")}
            >
              Entrar
            </button>
            <button
              type="button"
              className={clsx(
                "auth-tab px-5 py-1.5 text-sm font-semibold rounded-md",
                activeView === "register" && "active-tab"
              )}
              onClick={() => setActiveView("register")}
            >
              Cadastrar
            </button>
          </div>
        </div>

        {activeView === "login" && (
          <div className={clsx("auth-view p-6 sm:p-8", isViewTransitioning && "auth-view--switching")}>
            <form onSubmit={handleLoginSubmit} className="flex h-full flex-col">
              <div className="space-y-3 sm:space-y-4">
                <div className="form-input-group">
                  <label htmlFor="login-email" className="text-sm font-medium text-slate-700">
                    E-mail
                  </label>
                  <div className="relative">
                    <LucideIcon name="Mail" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      className="has-icon"
                      placeholder="seu@email.com"
                      value={loginForm.email}
                      onChange={(event) =>
                        setLoginForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="form-input-group">
                  <label htmlFor="login-password" className="text-sm font-medium text-slate-700">
                    Senha
                  </label>
                  <div className="relative">
                    <LucideIcon name="Lock" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      required
                      className="has-icon pr-12"
                      placeholder="********"
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className={clsx("password-toggle", showLoginPassword && "is-active")}
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      aria-label={showLoginPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      <LucideIcon name={showLoginPassword ? "EyeOff" : "Eye"} className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="error-message" aria-live="polite">
                {loginError}
              </div>
              <div className="success-message" aria-live="polite">
                {loginSuccess}
              </div>
              <button
                type="submit"
                className="auth-button mt-5 sm:mt-6"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Entrando..." : "Entrar"}
              </button>
              <div className="mt-3 text-center sm:mt-4">
                <button
                  type="button"
                  onClick={() => setActiveView("forgot")}
                  className="text-sm font-medium text-green-600 hover:text-green-700"
                >
                  Esqueci minha senha
                </button>
              </div>
            </form>
            <div className="auth-footer">
              <p>
                Ainda não tem conta?{" "}
                <button
                  type="button"
                  onClick={() => setActiveView("register")}
                  className="font-bold text-green-600"
                >
                  Cadastrar
                </button>
              </p>
            </div>
          </div>
        )}

        {activeView === "register" && (
          <div className={clsx("auth-view p-6 sm:p-8", isViewTransitioning && "auth-view--switching")}>
            <form onSubmit={handleRegisterSubmit} className="flex h-full flex-col">
              <div className="text-center">
                <h3 className="text-lg font-extrabold text-slate-800 sm:text-xl">
                  Antes de começarmos, vamos criar sua conta
                </h3>
                <p className="text-xs text-slate-600 sm:text-sm">
                  Leva menos de 1 minuto. Depois você já segue para a sua análise.
                </p>
              </div>
              <div className="wizard-progress my-3">
                <div
                  className="wizard-bar"
                  style={{ width: `${((registerStep + 1) / REGISTER_STEPS.length) * 100}%` }}
                />
              </div>

              {registerStep === 0 && (
                <div className="wizard-step flex-1 space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
                    <div className="form-input-group">
                      <label htmlFor="register-firstname" className="text-sm font-medium text-slate-700">
                        Nome
                      </label>
                      <input
                        id="register-firstname"
                        type="text"
                        required
                        placeholder="Seu nome"
                        value={registerForm.firstName}
                        onChange={(event) =>
                          setRegisterForm((prev) => ({ ...prev, firstName: event.target.value }))
                        }
                      />
                    </div>
                    <div className="form-input-group">
                      <label htmlFor="register-lastname" className="text-sm font-medium text-slate-700">
                        Sobrenome
                      </label>
                      <input
                        id="register-lastname"
                        type="text"
                        required
                        placeholder="Seu sobrenome"
                        value={registerForm.lastName}
                        onChange={(event) =>
                          setRegisterForm((prev) => ({ ...prev, lastName: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <button type="button" className="auth-button mt-5 sm:mt-6" onClick={handleRegisterNext}>
                    Próximo
                  </button>
                </div>
              )}

              {registerStep === 1 && (
                <div className="wizard-step flex-1 space-y-4">
                  <div className="form-input-group">
                    <label htmlFor="register-email" className="text-sm font-medium text-slate-700">
                      Nos diga seu melhor e-mail
                    </label>
                    <div className="relative">
                      <LucideIcon name="Mail" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        id="register-email"
                        type="email"
                        required
                        className="has-icon"
                        placeholder="seu@email.com"
                        value={registerForm.email}
                        onChange={(event) =>
                          setRegisterForm((prev) => ({ ...prev, email: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="form-input-group">
                    <label htmlFor="register-referral" className="text-sm font-medium text-slate-700">
                      Código de indicação (opcional)
                    </label>
                    <input
                      id="register-referral"
                      type="text"
                      placeholder="Tem um código? Coloque aqui"
                      value={registerForm.referralCode}
                      onChange={(event) =>
                        setRegisterForm((prev) => ({ ...prev, referralCode: event.target.value }))
                      }
                    />
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={handleRegisterBack}
                      className="w-1/2 rounded-lg bg-slate-200 py-2.5 font-semibold text-slate-800"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={handleRegisterNext}
                      className="w-1/2 auth-button"
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}

              {registerStep === 2 && (
                <div className="wizard-step flex-1 space-y-4">
                  <div className="form-input-group">
                    <label htmlFor="register-password" className="text-sm font-medium text-slate-700">
                      Crie sua senha
                    </label>
                    <div className="relative">
                      <LucideIcon name="Lock" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        id="register-password"
                        type={showRegisterPassword ? "text" : "password"}
                        required
                        className="has-icon pr-12"
                        placeholder="Mínimo 6 dígitos"
                        value={registerForm.password}
                        onChange={(event) =>
                          setRegisterForm((prev) => ({ ...prev, password: event.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className={clsx("password-toggle", showRegisterPassword && "is-active")}
                        onClick={() => setShowRegisterPassword((prev) => !prev)}
                        aria-label={showRegisterPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        <LucideIcon name={showRegisterPassword ? "EyeOff" : "Eye"} className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="mt-3 space-y-1 text-xs" aria-live="polite">
                      {passwordFeedback.map((rule) => (
                        <div
                          key={rule.id}
                          className={clsx("pw-rule", rule.met ? "pw-rule--ok" : "pw-rule--pending")}
                        >
                          <LucideIcon
                            name={rule.met ? "CircleCheckBig" : "Circle"} // Mudando "CheckCircle2" para "CheckCircle"
                            className="h-4 w-4 flex-shrink-0"
                          />
                          <span>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="form-input-group">
                    <label htmlFor="register-password-confirm" className="text-sm font-medium text-slate-700">
                      Confirmar senha
                    </label>
                    <div className="relative">
                      <LucideIcon name="Lock" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        id="register-password-confirm"
                        type={showRegisterConfirmPassword ? "text" : "password"}
                        required
                        disabled={!isPasswordValid}
                        className="has-icon pr-12"
                        placeholder="Confirme sua senha"
                        value={registerForm.confirmPassword}
                        onChange={(event) =>
                          setRegisterForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className={clsx("password-toggle", showRegisterConfirmPassword && "is-active")}
                        onClick={() => setShowRegisterConfirmPassword((prev) => !prev)}
                        aria-label={showRegisterConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                        disabled={!isPasswordValid}
                      >
                        <LucideIcon name={showRegisterConfirmPassword ? "EyeOff" : "Eye"} className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="mt-2 text-xs" aria-live="polite">
                      <span className={passwordsMatch ? "pw-good" : "pw-bad"}>
                        {passwordsMatch ? "As senhas coincidem." : "As senhas precisam ser iguais."}
                      </span>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={handleRegisterBack}
                      className="w-1/2 rounded-lg bg-slate-200 py-2.5 font-semibold text-slate-800"
                    >
                      Voltar
                    </button>
                    <button type="submit" className="w-1/2 auth-button" disabled={registerMutation.isPending}>
                      {registerMutation.isPending ? "Enviando..." : "Criar Conta"}
                    </button>
                  </div>
                </div>
              )}

              <div className="error-message" aria-live="polite">
                {registerError}
              </div>
              <div className="success-message" aria-live="polite">
                {registerSuccess}
              </div>
            </form>
            <div className="auth-footer">
              <p>
                Já tem conta?{" "}
                <button
                  type="button"
                  onClick={() => setActiveView("login")}
                  className="font-bold text-green-600"
                >
                  Entrar
                </button>
              </p>
            </div>
          </div>
        )}

        {activeView === "verify" && (
          <div className={clsx("auth-view p-6 sm:p-8", isViewTransitioning && "auth-view--switching")}>
            <form onSubmit={handleVerifySubmit} className="flex h-full flex-col">
              <h3 className="mb-2 text-center font-bold text-slate-800">Verificar Conta</h3>
              <p className="mb-6 text-center text-xs text-slate-600 sm:text-sm">
                Enviamos um código de 6 dígitos para seu e-mail.
              </p>
              <div className="space-y-3 sm:space-y-4">
                <div className="form-input-group">
                  <label htmlFor="verify-email" className="text-sm font-medium text-slate-700">
                    E-mail
                  </label>
                  <div className="relative">
                    <LucideIcon name="Mail" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="verify-email"
                      type="email"
                      required
                      className="has-icon"
                      placeholder="seu@email.com"
                      value={verifyForm.email}
                      onChange={(event) =>
                        setVerifyForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="form-input-group">
                  <label htmlFor="verify-code" className="text-sm font-medium text-slate-700">
                    Código de Verificação
                  </label>
                  <div className="relative">
                    <LucideIcon name="KeyRound" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="verify-code"
                      type="text"
                      required
                      maxLength={6}
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      className="has-icon"
                      placeholder="Ex: 123456"
                      value={verifyForm.code}
                      onChange={(event) =>
                        setVerifyForm((prev) => ({ ...prev, code: event.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="error-message" aria-live="polite">
                {verifyError}
              </div>
              <div className="success-message" aria-live="polite">
                {verifySuccess}
              </div>
              <button type="submit" className="auth-button mt-5 sm:mt-6" disabled={verifyMutation.isPending}>
                {verifyMutation.isPending ? "Verificando..." : "Verificar Conta"}
              </button>
              <div className="mt-3 text-center sm:mt-4">
                <button
                  type="button"
                  className="text-sm font-medium text-green-600 hover:text-green-700"
                  onClick={() => {
                    if (verifyForm.email) {
                      sendVerificationCodeMutation.mutate(verifyForm.email);
                    } else {
                      setVerifyError("Informe o e-mail para reenviar o código.");
                    }
                  }}
                  disabled={sendVerificationCodeMutation.isPending}
                >
                  {sendVerificationCodeMutation.isPending ? "Reenviando..." : "Reenviar código"}
                </button>
              </div>
            </form>
            <div className="auth-footer">
              <p>
                <button
                  type="button"
                  onClick={() => setActiveView("login")}
                  className="font-bold text-green-600"
                >
                  Voltar para o Login
                </button>
              </p>
            </div>
          </div>
        )}

        {activeView === "forgot" && (
          <div className={clsx("auth-view p-6 sm:p-8", isViewTransitioning && "auth-view--switching")}>
            <form onSubmit={handleForgotSubmit} className="flex h-full flex-col">
              <h3 className="mb-2 text-center font-bold text-slate-800">Recuperar Senha</h3>
              <p className="mb-6 text-center text-xs text-slate-600 sm:text-sm">
                Insira seu e-mail para receber o link de redefinição.
              </p>
              <div className="form-input-group">
                <label htmlFor="forgot-email" className="text-sm font-medium text-slate-700">
                  E-mail
                </label>
                <div className="relative">
                  <LucideIcon name="Mail" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    className="has-icon"
                    placeholder="seu@email.com"
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                  />
                </div>
              </div>
              <div className="error-message" aria-live="polite">
                {forgotError}
              </div>
              <div className="success-message" aria-live="polite">
                {forgotMessage}
              </div>
              <button type="submit" className="auth-button mt-5 sm:mt-6">
                Enviar Redefinição
              </button>
            </form>
            <div className="auth-footer">
              <p>
                <button
                  type="button"
                  onClick={() => setActiveView("login")}
                  className="font-bold text-green-600"
                >
                  Voltar para o Login
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthModal;
