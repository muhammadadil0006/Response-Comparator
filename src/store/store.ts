import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import authReducer from '@/store/slices/authSlice';
import comparisonReducer from '@/store/slices/comparisonSlice';
import { baseApi } from '@/store/api/baseApi';

const authPersistConfig = {
  key: 'auth',
  storage,
  whitelist: ['user', 'access', 'refresh'],
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  comparison: comparisonReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(baseApi.middleware),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
