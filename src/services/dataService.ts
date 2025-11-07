import { APP_CONFIG } from '../config/appConfig';
import { liquidationApiService } from './apiService';
import { mockLiquidationService, mockWorkPlanService, mockActivityService } from './mockDataService';

const createServiceProxy = (apiService: any, mockService: any) => {
  return new Proxy(apiService, {
    get(target, prop) {
      return async (...args: any[]) => {
        const useMock = APP_CONFIG.USE_MOCK_DATA;

        if (useMock) {
          console.log(`🎭 [MOCK] Calling ${String(prop)}`, args);
          if (mockService[prop]) {
            return mockService[prop](...args);
          }
          console.warn(`⚠️ Mock method ${String(prop)} not implemented, falling back to API`);
        } else {
          console.log(`🌐 [API] Calling ${String(prop)}`, args);
        }

        if (target[prop]) {
          return target[prop](...args);
        }

        throw new Error(`Method ${String(prop)} not found in service`);
      };
    }
  });
};

export const liquidationService = createServiceProxy(liquidationApiService, mockLiquidationService);

export const workPlanService = {
  getWorkPlans: async (filters: any = {}) => {
    if (APP_CONFIG.USE_MOCK_DATA) {
      console.log('🎭 [MOCK] Calling getWorkPlans', filters);
      return mockWorkPlanService.getWorkPlans(filters);
    }
    console.log('🌐 [API] Calling getWorkPlans', filters);
    throw new Error('API not implemented yet');
  },

  createWorkPlan: async (data: any) => {
    if (APP_CONFIG.USE_MOCK_DATA) {
      console.log('🎭 [MOCK] Calling createWorkPlan', data);
      return mockWorkPlanService.createWorkPlan(data);
    }
    console.log('🌐 [API] Calling createWorkPlan', data);
    throw new Error('API not implemented yet');
  }
};

export const activityService = {
  getActivities: async (filters: any = {}) => {
    if (APP_CONFIG.USE_MOCK_DATA) {
      console.log('🎭 [MOCK] Calling getActivities', filters);
      return mockActivityService.getActivities(filters);
    }
    console.log('🌐 [API] Calling getActivities', filters);
    throw new Error('API not implemented yet');
  },

  createActivity: async (data: any) => {
    if (APP_CONFIG.USE_MOCK_DATA) {
      console.log('🎭 [MOCK] Calling createActivity', data);
      return mockActivityService.createActivity(data);
    }
    console.log('🌐 [API] Calling createActivity', data);
    throw new Error('API not implemented yet');
  }
};

export { APP_CONFIG, toggleMockData, setMockDataMode } from '../config/appConfig';
