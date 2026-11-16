import { configureStore, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { User } from '../types';
import { STAFF_SESSION_KEYS, clearSessionKeys, markSignedIn, purgeExpiredSessions } from '../api/sessionLife';

// Drop sessions older than 12 hours before any component reads them.
purgeExpiredSessions();

interface AuthState {
  token: string | null;
  user: User | null;
  sessionId: string | null;
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: localStorage.getItem('tms_token'),
    user: (() => {
      try { return JSON.parse(localStorage.getItem('tms_user') ?? 'null'); }
      catch { return null; }
    })(),
    sessionId: null,
  } as AuthState,
  reducers: {
    setSessionId(state, action: PayloadAction<string>) {
      state.sessionId = action.payload;
    },
    loginSuccess(state, action: PayloadAction<{ token: string; user: User }>) {
      state.token = action.payload.token;
      state.user  = action.payload.user;
      localStorage.setItem('tms_token', action.payload.token);
      localStorage.setItem('tms_user',  JSON.stringify(action.payload.user));
      markSignedIn(STAFF_SESSION_KEYS.access); // also covers demo mode, which has no API session
    },
    logout(state) {
      state.token     = null;
      state.user      = null;
      state.sessionId = null;
      // Remove only our session keys: demo mode keeps its user directory in localStorage too.
      clearSessionKeys(STAFF_SESSION_KEYS.access, STAFF_SESSION_KEYS.others);
    },
  },
});

export const store = configureStore({ reducer: { auth: authSlice.reducer } });

export const { setSessionId, loginSuccess, logout } = authSlice.actions;
export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <T>(sel: (s: RootState) => T) => useSelector(sel);
