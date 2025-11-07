import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Product {
  productId: string;
  productName: string;
  productCode: string;
  skus: SKU[];
}

export interface SKU {
  skuId: string;
  skuCode: string;
  skuName: string;
  unit: string;
  unitPrice: number;
  openingStock: number;
  ytdSales: number;
  liquidated: number;
  currentStock: number;
}

export interface LiquidationEntry {
  id: string;
  distributorId: string;
  distributorName: string;
  distributorCode: string;
  location: string;
  balanceStock: number;
  balanceValue: number;
  liquidationRate: number;
  products: Product[];
  lastUpdated: string;
}

interface LiquidationState {
  entries: LiquidationEntry[];
  selectedEntry: LiquidationEntry | null;
  filters: {
    search: string;
    location: string;
    minRate: number;
    maxRate: number;
  };
  isLoading: boolean;
}

const initialState: LiquidationState = {
  entries: [],
  selectedEntry: null,
  filters: {
    search: '',
    location: '',
    minRate: 0,
    maxRate: 100,
  },
  isLoading: false,
};

const liquidationSlice = createSlice({
  name: 'liquidation',
  initialState,
  reducers: {
    setEntries: (state, action: PayloadAction<LiquidationEntry[]>) => {
      state.entries = action.payload;
      state.isLoading = false;
    },
    setSelectedEntry: (state, action: PayloadAction<LiquidationEntry | null>) => {
      state.selectedEntry = action.payload;
    },
    updateEntry: (state, action: PayloadAction<LiquidationEntry>) => {
      const index = state.entries.findIndex(e => e.id === action.payload.id);
      if (index !== -1) {
        state.entries[index] = action.payload;
      }
      if (state.selectedEntry?.id === action.payload.id) {
        state.selectedEntry = action.payload;
      }
    },
    setFilters: (state, action: PayloadAction<Partial<LiquidationState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setEntries, setSelectedEntry, updateEntry, setFilters, setLoading } = liquidationSlice.actions;
export default liquidationSlice.reducer;
