import { baseApi } from '@/store/api/baseApi';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '@/types/auth';
import { API_ENDPOINTS } from '@/config/api-endpoints';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: API_ENDPOINTS.AUTH_LOGIN,
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['User'],
    }),

    register: builder.mutation<AuthResponse, RegisterRequest>({
      query: (userData) => ({
        url: API_ENDPOINTS.AUTH_REGISTER,
        method: 'POST',
        body: userData,
      }),
      invalidatesTags: ['User'],
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: API_ENDPOINTS.AUTH_LOGOUT,
        method: 'POST',
      }),
      invalidatesTags: ['User', 'Comparison'],
    }),

    getMe: builder.query<User, void>({
      query: () => API_ENDPOINTS.AUTH_ME,
      providesTags: ['User'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useGetMeQuery,
} = authApi;
