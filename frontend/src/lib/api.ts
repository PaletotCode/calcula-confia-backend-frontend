import axios, { AxiosError } from "axios";

const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:8000/api/v1"
    : "https://calculaconfia-production.up.railway.app/api/v1");

export const api = axios.create({
  baseURL: DEFAULT_API_BASE,
  // Mirrors `fetch(..., { credentials: "include" })` so that the browser keeps
  // sending/receiving the HttpOnly `access_token` cookie issued by the backend.
  withCredentials: true,
});

export interface ApiMessageResponse {
  message?: string;
  detail?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  applied_referral_code?: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface User {
  id: string | number;
  email: string;
  first_name: string;
  last_name: string;
  credits?: number;
  referral_code?: string | null;
  referral_credits_earned?: number;
  is_verified?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface VerificationPayload {
  email: string;
  code: string;
}

export interface BillPayload {
  icms_value: number;
  issue_date: string; // YYYY-MM
}

export interface CalcularPayload {
  bills: BillPayload[];
}

export interface CalcularResponse {
  valor_calculado: number;
  creditos_restantes: number;
  calculation_id: number;
  processing_time_ms: number;
  [key: string]: unknown;
}

export interface CreateOrderResponse {
  preference_id: string;
  init_point: string;
  sandbox_init_point?: string;
  [key: string]: unknown;
}

export interface CreditsBalanceResponse {
  balance?: number;
  credits?: number;
  creditos?: number;
  valid_credits?: number;
  available_credits?: number;
  [key: string]: unknown;
}

export interface CreditHistoryItem {
  id?: string | number;
  transaction_type?: string;
  type?: string;
  description?: string;
  reason?: string;
  amount?: number;
  created_at?: string;
  [key: string]: unknown;
}

export type CreditHistoryResponse =
  | CreditHistoryItem[]
  | {
      items?: CreditHistoryItem[];
      results?: CreditHistoryItem[];
      transactions?: CreditHistoryItem[];
      history?: CreditHistoryItem[];
      data?: CreditHistoryItem[];
      [key: string]: unknown;
    };

export const register = async (payload: RegisterPayload) => {
  const { data } = await api.post<ApiMessageResponse>("/register", payload);
  return data;
};

export const login = async ({ email, password }: LoginPayload) => {
  const body = new URLSearchParams({
    username: email,
    password,
  });
  const { data } = await api.post<ApiMessageResponse>("/login", body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data;
};

export const getMe = async () => {
  const { data } = await api.get<User>("/me");
  return data;
};

export const sendVerificationCode = async (email: string) => {
  const { data } = await api.post<ApiMessageResponse>(
    "/auth/send-verification-code",
    { email }
  );
  return data;
};

export const verifyAccount = async (payload: VerificationPayload) => {
  const { data } = await api.post<ApiMessageResponse>(
    "/auth/verify-account",
    payload
  );
  return data;
};

export const createOrder = async () => {
  const { data } = await api.post<CreateOrderResponse>(
    "/payments/create-order"
  );
  return data;
};

export const getCreditsBalance = async () => {
  const { data } = await api.get<CreditsBalanceResponse>(
    "/credits/balance"
  );
  return data;
};

export const getCreditsHistory = async () => {
  const { data } = await api.get<CreditHistoryResponse>(
    "/credits/history"
  );
  return data;
};

export const calcular = async (payload: CalcularPayload) => {
  const { data } = await api.post<CalcularResponse>("/calcular", payload);
  return data;
};

export const logout = async () => {
  // FastAPI clears the cookie via `response.delete_cookie`, so the important
  // piece here is keeping the credentials flag enabled when we call POST /logout.
  const { data } = await api.post<ApiMessageResponse>("/logout");
  return data;
};

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiMessageResponse>;
    const responseData = axiosError.response?.data;
    if (typeof responseData === "string") {
      return responseData;
    }
    if (responseData?.detail) {
      return Array.isArray(responseData.detail)
        ? responseData.detail.join(" ")
        : String(responseData.detail);
    }
    if (responseData?.message) {
      return responseData.message;
    }
    if (axiosError.response?.statusText) {
      return axiosError.response.statusText;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Ocorreu um erro inesperado. Tente novamente.";
}
