# Mock Data Mode

The application includes a **Mock Data Mode** feature that allows you to test the application without making actual API calls. This is useful for:

- Development and testing
- Demos and presentations
- Offline work
- Reducing API load during development

## Default Behavior

**By default, the application uses MOCK DATA** to prevent accidental API calls during testing.

## How to Toggle

### Method 1: UI Toggle Button

A toggle button is available in the header (top-right corner):

- **Amber badge with beaker icon**: Mock mode is active
- **Blue badge with database icon**: API mode is active

Click the badge to switch between modes.

### Method 2: Browser Console

Open your browser's developer console (F12) and use these commands:

```javascript
// Toggle between mock and API mode
toggleMockData()

// Enable mock mode explicitly
setMockDataMode(true)

// Enable API mode explicitly
setMockDataMode(false)
```

## Configuration

The mock data mode is configured in `/src/config/appConfig.ts`:

```typescript
export const APP_CONFIG = {
  USE_MOCK_DATA: true,  // Change to false to use API by default
  API_BASE_URL: import.meta.env.VITE_API_URL || 'https://api.example.com',
};
```

## What Changes in Mock Mode

When mock mode is enabled:

### ✅ Mock Data Sources
- Liquidation metrics and distributor data
- Work plans and activities
- Dashboard reports and analytics
- Product inventory and transactions
- Retailer information

### 📝 Console Logging
All data service calls are logged with clear indicators:
- `🎭 [MOCK]` - Mock data is being used
- `🌐 [API]` - Real API calls are being made

### ⚡ Performance
Mock responses include a small delay (200-500ms) to simulate network latency and make testing more realistic.

## For Developers

### Adding Mock Data for New Services

1. **Create mock data** in `/src/data/mockData.ts` or create a new mock data file

2. **Add mock service methods** in `/src/services/mockDataService.ts`:

```typescript
export const mockYourService = {
  async getYourData(params: any) {
    await delay(300); // Simulate network delay

    return {
      success: true,
      data: { /* your mock data */ }
    };
  }
};
```

3. **Create service wrapper** in `/src/services/dataService.ts`:

```typescript
export const yourService = {
  getYourData: async (params: any) => {
    if (APP_CONFIG.USE_MOCK_DATA) {
      console.log('🎭 [MOCK] Calling getYourData', params);
      return mockYourService.getYourData(params);
    }
    console.log('🌐 [API] Calling getYourData', params);
    return apiYourService.getYourData(params);
  }
};
```

4. **Use the wrapped service** in your components/contexts:

```typescript
import { yourService } from '../services/dataService';

const data = await yourService.getYourData(params);
```

## Benefits

### During Development
- **Fast iteration**: No need to wait for backend services
- **Predictable data**: Always get consistent test data
- **Offline development**: Work without network connection
- **Reduced API load**: Save API quotas and costs

### During Testing
- **Reproducible tests**: Same data every time
- **Edge case testing**: Easily test with specific data scenarios
- **No side effects**: Mock data doesn't affect production systems

### During Demos
- **Reliable demos**: No dependency on network or backend
- **Consistent results**: Same data for every demo
- **Better performance**: No network latency

## Important Notes

1. **Default Mode**: Mock data is enabled by default (`USE_MOCK_DATA: true`)
2. **Persistence**: Mode selection is not persisted across page refreshes
3. **All Services**: Most services support mock mode, but some may need API access
4. **Visual Indicator**: Always check the header badge to confirm which mode is active
5. **Console Logs**: Check browser console for detailed logging of data calls

## Troubleshooting

### Mock data not working?
1. Check the header badge - it should show "Mock" with a beaker icon
2. Open console and look for `🎭 [MOCK]` messages
3. Try running `toggleMockData()` in the console

### API calls still happening?
1. Verify `APP_CONFIG.USE_MOCK_DATA` is `true`
2. Check if the service is using the wrapper from `dataService.ts`
3. Some services might not have mock implementations yet

### Need to force API mode?
```javascript
// In browser console
setMockDataMode(false)
```

Or update `appConfig.ts` and set `USE_MOCK_DATA: false`
