import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CachedData {
  [key: string]: {
    data: any;
    timestamp: number;
    expiresIn: number;
  };
}

interface DataState {
  cache: CachedData;
  isOnline: boolean;
  pendingSync: any[];
}

const initialState: DataState = {
  cache: {},
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingSync: [],
};

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    setCachedData: (state, action: PayloadAction<{ key: string; data: any; expiresIn?: number }>) => {
      const { key, data, expiresIn = 300000 } = action.payload;
      state.cache[key] = {
        data,
        timestamp: Date.now(),
        expiresIn,
      };
    },
    removeCachedData: (state, action: PayloadAction<string>) => {
      delete state.cache[action.payload];
    },
    clearExpiredCache: (state) => {
      const now = Date.now();
      Object.keys(state.cache).forEach(key => {
        const cached = state.cache[key];
        if (now - cached.timestamp > cached.expiresIn) {
          delete state.cache[key];
        }
      });
    },
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    addPendingSync: (state, action: PayloadAction<any>) => {
      state.pendingSync.push(action.payload);
    },
    removePendingSync: (state, action: PayloadAction<string>) => {
      state.pendingSync = state.pendingSync.filter(item => item.id !== action.payload);
    },
    clearPendingSync: (state) => {
      state.pendingSync = [];
    },
  },
});

export const {
  setCachedData,
  removeCachedData,
  clearExpiredCache,
  setOnlineStatus,
  addPendingSync,
  removePendingSync,
  clearPendingSync,
} = dataSlice.actions;

export default dataSlice.reducer;
