export const APP_CONFIG = {
  USE_MOCK_DATA: true,
  API_BASE_URL: import.meta.env.VITE_API_URL || 'https://api.example.com',
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

export const toggleMockData = () => {
  APP_CONFIG.USE_MOCK_DATA = !APP_CONFIG.USE_MOCK_DATA;
  console.log(`🔄 Mock Data Mode: ${APP_CONFIG.USE_MOCK_DATA ? 'ENABLED' : 'DISABLED'}`);
  return APP_CONFIG.USE_MOCK_DATA;
};

export const setMockDataMode = (useMock: boolean) => {
  APP_CONFIG.USE_MOCK_DATA = useMock;
  console.log(`🔄 Mock Data Mode: ${useMock ? 'ENABLED' : 'DISABLED'}`);
};

// Only attach to window in browser environment
if (typeof window !== 'undefined') {
  (window as any).toggleMockData = toggleMockData;
  (window as any).setMockDataMode = setMockDataMode;

  // Log after a slight delay to ensure console is ready
  setTimeout(() => {
    console.log('💡 Mock data controls available:');
    console.log('  - toggleMockData() - Toggle between mock and API data');
    console.log('  - setMockDataMode(true/false) - Set mock mode explicitly');
    console.log(`  - Current mode: ${APP_CONFIG.USE_MOCK_DATA ? 'MOCK DATA' : 'API DATA'}`);
  }, 0);
}
