import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store/store';
import type { User } from '@/types/auth';

interface AuthState {
  user: User | null;
  access: string | null;
  refresh: string | null;
}

const initialState: AuthState = {
  user: null,
  access: null,
  refresh: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; access: string; refresh: string }>
    ) => {
      state.user = action.payload.user;
      state.access = action.payload.access;
      state.refresh = action.payload.refresh;
    },
    setAccessToken: (state, action: PayloadAction<string>) => {
      state.access = action.payload;
    },
    clearCredentials: (state) => {
      state.user = null;
      state.access = null;
      state.refresh = null;
    },
  },
});

export const { setCredentials, setAccessToken, clearCredentials } =
  authSlice.actions;

// Selectors
export const selectCurrentUser = (state: RootState) => state.auth.user;
export const selectAccessToken = (state: RootState) => state.auth.access;
export const selectIsAuthenticated = (state: RootState) => !!state.auth.access;

export default authSlice.reducer;
