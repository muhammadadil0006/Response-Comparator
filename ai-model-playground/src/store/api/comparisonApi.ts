import { baseApi } from '@/store/api/baseApi';
import type {
  Comparison,
  ComparisonListResponse,
  ExecuteComparisonRequest,
} from '@/types/comparison';
import { API_ENDPOINTS } from '@/config/api-endpoints';

export const comparisonApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    executeComparison: builder.mutation<Comparison, ExecuteComparisonRequest>({
      query: (request) => ({
        url: API_ENDPOINTS.COMPARISONS,
        method: 'POST',
        body: request,
      }),
      invalidatesTags: ['Comparison'],
    }),

    getComparison: builder.query<Comparison, string>({
      query: (id) => API_ENDPOINTS.COMPARISON_BY_ID(id),
      providesTags: (_result, _error, id) => [{ type: 'Comparison', id }],
    }),

    listComparisons: builder.query<
      ComparisonListResponse,
      { limit?: number; offset?: number }
    >({
      query: ({ limit = 50, offset = 0 }) =>
        `${API_ENDPOINTS.COMPARISONS}?limit=${limit}&offset=${offset}`,
      providesTags: (result) =>
        result
          ? [
              ...result.comparisons.map(({ comparison_id }) => ({
                type: 'Comparison' as const,
                id: comparison_id,
              })),
              { type: 'Comparison', id: 'LIST' },
            ]
          : [{ type: 'Comparison', id: 'LIST' }],
    }),

    deleteComparison: builder.mutation<void, string>({
      query: (id) => ({
        url: API_ENDPOINTS.COMPARISON_BY_ID(id),
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Comparison', id },
        { type: 'Comparison', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useExecuteComparisonMutation,
  useGetComparisonQuery,
  useListComparisonsQuery,
  useDeleteComparisonMutation,
} = comparisonApi;
