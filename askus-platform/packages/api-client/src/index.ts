import type {
  AuthTokens,
  BusinessSummaryDto,
  CustomerProfileDto,
  DocRef,
  InsuranceRequestDto,
  RequestStatus,
  Role,
  UserDto,
} from '@askus/shared-types';

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  /** Called once on a 401; return a fresh access token to retry the request, or null to give up. */
  refreshAccessToken?: () => Promise<string | null>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface VehicleLookup {
  makeModel?: string;
  variant?: string;
  fuel?: string;
  registrationDate?: string;
  manufactureMonth?: string;
  prevInsurer?: string;
  prevExpiry?: string;
}

export function createApiClient({ baseUrl, getAccessToken, refreshAccessToken }: ApiClientOptions) {
  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const send = (token: string | null | undefined) => {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      return fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    };

    let res = await send(getAccessToken?.());
    if (res.status === 401 && refreshAccessToken) {
      const fresh = await refreshAccessToken();
      if (fresh) res = await send(fresh);
    }
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      const message = Array.isArray(err?.message) ? err.message.join(', ') : err?.message;
      throw new ApiError(res.status, message ?? res.statusText);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  return {
    request,
    auth: {
      requestOtp: (identifier: string) =>
        request<{ sent: boolean }>('/auth/request-otp', 'POST', { identifier }),
      verifyOtp: (identifier: string, code: string) =>
        request<AuthTokens>('/auth/verify-otp', 'POST', { identifier, code }),
      refresh: (refreshToken: string) =>
        request<AuthTokens>('/auth/refresh', 'POST', { refreshToken }),
      logout: (refreshToken: string) =>
        request<void>('/auth/logout', 'POST', { refreshToken }),
    },
    customer: {
      me: () => request<CustomerProfileDto>('/customer/me'),
      update: (patch: Partial<Pick<CustomerProfileDto, 'displayName' | 'city' | 'address' | 'pincode' | 'contactEmail'>>) =>
        request<CustomerProfileDto>('/customer/me', 'PATCH', patch),
    },
    admin: {
      listUsers: () => request<UserDto[]>('/admin/users'),
      setRoles: (userId: string, roles: Role[]) =>
        request<UserDto>(`/admin/users/${userId}/roles`, 'PATCH', { roles }),
    },
    reporting: {
      summary: () => request<BusinessSummaryDto[]>('/reporting/summary'),
    },
    insurance: {
      myRequests: () => request<InsuranceRequestDto[]>('/insurance/requests/mine'),
      createOffline: (body: Record<string, unknown>) =>
        request<{ id: string }>('/insurance/requests/offline', 'POST', body),
      createDocuments: (body: Record<string, unknown>) =>
        request<{ id: string }>('/insurance/requests/documents', 'POST', body),
      signUpload: (body: { requestId: string; index: number; extension: string; size: number }) =>
        request<{ key: string; contentType: string; url: string }>('/insurance/documents/sign', 'POST', body),
      downloadUrl: (key: string) => request<{ url: string }>('/insurance/documents/download', 'POST', { key }),
      lookupVehicle: (regNumber: string) =>
        request<{ vehicle: VehicleLookup }>('/insurance/vehicle/lookup', 'POST', { regNumber }),
      adminRequests: () => request<InsuranceRequestDto[]>('/insurance/admin/requests'),
      review: (id: string, patch: { status: RequestStatus; adminNote: string }) =>
        request<InsuranceRequestDto>(`/insurance/admin/requests/${id}`, 'PATCH', patch),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
export type { DocRef };
