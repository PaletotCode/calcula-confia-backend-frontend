import axios, { AxiosError } from "axios";

const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:8000/api/v1"
    : "https://calculaconfia.com.br/api/v1");

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

export interface RegistrationResponse extends ApiMessageResponse {
  requires_verification?: boolean;
  expires_in_minutes?: number;
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

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_info?: User;
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
  amount?: number;
  credits?: number;
  sandbox_init_point?: string;
  [key: string]: unknown;
}

export interface ConfirmPaymentPayload {
  payment_id: string;
  status?: string | null;
  preference_id?: string | null;
}

export interface ConfirmPaymentResponse {
  payment_id: string;
  status?: string | null;
  credits_added: boolean;
  already_processed: boolean;
  credits_balance?: number | null;
  detail?: string | null;
}

export type PaymentState =
  | "ready_for_platform"
  | "awaiting_payment"
  | "needs_payment"
  | "payment_failed";

export interface PaymentStateDetails {
  payment_id?: string | null;
  preference_id?: string | null;
  status?: string | null;
  mercadopago_status?: string | null;
  detail?: string | null;
  credits_amount?: number | null;
  amount?: number | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_sync_at?: string | null;
}

export interface PaymentStateResponse {
  state: PaymentState;
  can_access_platform: boolean;
  credits_balance: number;
  payment?: PaymentStateDetails | null;
}

export interface ProcessPixPaymentPayload {
  preference_id: string;
  idempotency_key?: string;
}

export interface PixPaymentResponse {
  id: string | number;
  status?: string | null;
  status_detail?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CreditsBalanceResponse {
  user_id: number;
  valid_credits: number;
  legacy_credits: number;
  timestamp: string;
}

export interface ReferralStatsResponse {
  referral_code: string;
  total_referrals: number;
  referral_credits_earned: number;
  referral_credits_remaining: number;
}

export interface CreditHistoryItem {
  id: string | number;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  expires_at?: string | null;
  metadata?: Record<string, unknown> | string | null;
  details?: Record<string, unknown> | string | null;
  payload?: Record<string, unknown> | string | null;
}

export interface CreditHistoryCollectionResponse {
  items?: CreditHistoryItem[];
  results?: CreditHistoryItem[];
  transactions?: CreditHistoryItem[];
  history?: CreditHistoryItem[];
  data?: CreditHistoryItem[];
  [key: string]: unknown;
}

export type CreditHistoryResponse = CreditHistoryItem[] | CreditHistoryCollectionResponse;

export interface DetailedHistoryBill {
  issue_date?: string | null;
  icms_value?: number | null;
  [key: string]: unknown;
}

export interface DetailedHistoryItem {
  id: string | number;
  calculated_value?: number | null;
  created_at?: string | null;
  credits_used?: number | null;
  bills?: DetailedHistoryBill[];
  [key: string]: unknown;
}

export interface GetDetailedHistoryParams {
  limit?: number;
  offset?: number;
}

export interface GetCreditsHistoryParams {
  limit?: number;
}

export const register = async (payload: RegisterPayload) => {
  const { data } = await api.post<RegistrationResponse>("/register", payload);
  return data;
};

export const login = async ({ email, password }: LoginPayload) => {
  const body = new URLSearchParams({
    username: email,
    password,
  });
  const { data } = await api.post<AuthTokenResponse>("/login", body, {
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
  const { data } = await api.post<AuthTokenResponse>(
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

export const confirmPayment = async (payload: ConfirmPaymentPayload) => {
  const { data } = await api.post<ConfirmPaymentResponse>(
    "/payments/confirm",
    payload
  );
  return data;
};

export const getPaymentState = async () => {
  const { data } = await api.get<PaymentStateResponse>("/payments/status");
  return data;
};

export const processPixPayment = async (payload: ProcessPixPaymentPayload) => {
  const { data } = await api.post<PixPaymentResponse>(
    "/payments/process",
    payload
  );
  return data;
};

export const getCreditsBalance = async () => {
  const { data } = await api.get<CreditsBalanceResponse>("/credits/balance");
  return data;
};

export const getCreditsHistory = async (params?: GetCreditsHistoryParams) => {
  const { data } = await api.get<CreditHistoryResponse>("/credits/history", {
    params,
  });

  if (Array.isArray(data)) {
    return data;
  }

  const collection =
    data.items ??
    data.results ??
    data.transactions ??
    data.history ??
    data.data ??
    [];

  return collection as CreditHistoryItem[];
};

export const getDetailedHistory = async (params?: GetDetailedHistoryParams) => {
  const { data } = await api.get<DetailedHistoryItem[]>("/historico/detalhado", {
    params,
  });

  if (!Array.isArray(data)) {
    return [] as DetailedHistoryItem[];
  }

  return data;
};

export const getReferralStats = async () => {
  const { data } = await api.get<ReferralStatsResponse>("/referral/stats");
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
