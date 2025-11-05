import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ModalState {
  isOpen: boolean;
  type: string | null;
  data: any;
}

interface UIState {
  isLoading: boolean;
  modal: ModalState;
  sidebarCollapsed: boolean;
  toast: {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning' | null;
  };
}

const initialState: UIState = {
  isLoading: false,
  modal: {
    isOpen: false,
    type: null,
    data: null,
  },
  sidebarCollapsed: false,
  toast: {
    message: '',
    type: null,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    openModal: (state, action: PayloadAction<{ type: string; data?: any }>) => {
      state.modal.isOpen = true;
      state.modal.type = action.payload.type;
      state.modal.data = action.payload.data || null;
    },
    closeModal: (state) => {
      state.modal.isOpen = false;
      state.modal.type = null;
      state.modal.data = null;
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    showToast: (state, action: PayloadAction<{ message: string; type: 'success' | 'error' | 'info' | 'warning' }>) => {
      state.toast.message = action.payload.message;
      state.toast.type = action.payload.type;
    },
    hideToast: (state) => {
      state.toast.message = '';
      state.toast.type = null;
    },
  },
});

export const { setLoading, openModal, closeModal, toggleSidebar, showToast, hideToast } = uiSlice.actions;
export default uiSlice.reducer;
