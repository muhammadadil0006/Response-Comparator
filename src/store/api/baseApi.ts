import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '@/store/store';
import { setAccessToken, clearCredentials } from '@/store/slices/authSlice';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { API_ENDPOINTS, API_BASE_URL } from '@/config/api-endpoints';
import { HttpStatus } from '@/types/enums';

/** Shape of the refresh token API response */
interface RefreshTokenResponse {
  access: string;
}

const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.access;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === HttpStatus.UNAUTHORIZED) {
    const refreshToken = (api.getState() as RootState).auth.refresh;

    if (refreshToken) {
      const refreshResult = await baseQuery(
        {
          url: API_ENDPOINTS.AUTH_REFRESH,
          method: 'POST',
          body: { refresh: refreshToken },
        },
        api,
        extraOptions
      );

      if (refreshResult.data) {
        const refreshData = refreshResult.data as RefreshTokenResponse;
        api.dispatch(setAccessToken(refreshData.access));
        // Retry original request
        result = await baseQuery(args, api, extraOptions);
      } else {
        api.dispatch(clearCredentials());
      }
    } else {
      api.dispatch(clearCredentials());
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Comparison'],
  endpoints: () => ({}),
});
