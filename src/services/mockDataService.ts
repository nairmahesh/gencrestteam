import { APP_CONFIG } from '../config/appConfig';
import {
  MOCK_OVERALL_LIQUIDATION_METRICS,
  MOCK_DISTRIBUTOR_LIQUIDATION,
  MOCK_PRODUCT_DATA,
  MOCK_RETAILERS,
  MOCK_WORK_PLAN,
  MOCK_TASKS,
  MOCK_PRODUCTS
} from '../data/mockData';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockLiquidationService = {
  async getLiquidationOverview(type: string = '') {
    await delay(300);

    const metrics = {
      totalDistributors: 150,
      totalRetailers: 1250,
      totalProducts: 45,
      pendingVerifications: 23,
      totalStockValue: 15750000,
      liquidationRate: 68.5,
      averageStockDays: 42,
      criticalStockAlerts: 12
    };

    return {
      success: true,
      data: { metrics }
    };
  },

  async getProducts(id: string) {
    await delay(200);

    return {
      success: true,
      data: MOCK_PRODUCT_DATA
    };
  },

  async getProductTransactionsData(distributorId: string, productId: string, selectedMetric: string) {
    await delay(250);

    const transactions = Array.from({ length: 10 }, (_, i) => ({
      _id: `txn-${i}`,
      date: new Date(Date.now() - i * 86400000).toISOString(),
      type: i % 2 === 0 ? 'sale' : 'stock_in',
      quantity: Math.floor(Math.random() * 100),
      value: Math.floor(Math.random() * 50000),
      retailer: MOCK_RETAILERS[i % MOCK_RETAILERS.length]?.name || 'Unknown'
    }));

    return {
      success: true,
      data: { transactions, metric: selectedMetric }
    };
  },

  async getDistributorsPaginated(page: number, limit: number, filters: any = {}) {
    await delay(300);

    let distributors = MOCK_DISTRIBUTOR_LIQUIDATION;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      distributors = distributors.filter(d =>
        d.distributorName.toLowerCase().includes(searchLower) ||
        d.distributorCode.toLowerCase().includes(searchLower) ||
        d.territory.toLowerCase().includes(searchLower)
      );
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = distributors.slice(start, end);

    return {
      success: true,
      data: {
        data: paginatedData,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(distributors.length / limit),
          pageSize: limit,
          totalCount: distributors.length
        }
      }
    };
  },

  async getRetailers(distributorId: string) {
    await delay(200);

    const retailers = MOCK_RETAILERS.map((r, idx) => ({
      _id: r.id || `ret-${idx}`,
      name: r.name,
      territory: r.territory || 'Territory',
      zone: r.zone || 'Zone',
      state: r.state || 'State',
      address: r.address || 'Address',
      pincode: r.pincode || '000000',
      currentStock: Math.floor(Math.random() * 200)
    }));

    return {
      success: true,
      data: { retailers }
    };
  },

  async createRetailer(data: any) {
    await delay(300);

    const { _id, ...retailerData } = data;

    return {
      success: true,
      data: {
        retailer: {
          _id: `ret-${Date.now()}`,
          ...retailerData,
          createdAt: new Date().toISOString()
        }
      }
    };
  },

  async uploadFile(file: File) {
    await delay(500);

    return {
      success: true,
      data: {
        fileUrl: `https://mock-storage.example.com/${file.name}`,
        fileName: file.name
      }
    };
  },

  async submitLiquidation(data: any) {
    await delay(400);

    return {
      success: true,
      data: {
        submission: {
          _id: `sub-${Date.now()}`,
          ...data,
          status: 'pending',
          submittedAt: new Date().toISOString()
        }
      }
    };
  },

  async getDistributorStats(distributorId: string) {
    await delay(200);

    return {
      success: true,
      data: {
        stats: {
          totalProducts: Math.floor(Math.random() * 50),
          totalRetailers: Math.floor(Math.random() * 100),
          stockValue: Math.floor(Math.random() * 1000000),
          liquidationRate: Math.floor(Math.random() * 100),
          pendingVerifications: Math.floor(Math.random() * 10),
          lastVerification: new Date().toISOString()
        }
      }
    };
  }
};

export const mockWorkPlanService = {
  async getWorkPlans(filters: any = {}) {
    await delay(200);
    return {
      success: true,
      data: { workPlans: MOCK_WORK_PLAN }
    };
  },

  async createWorkPlan(data: any) {
    await delay(300);
    return {
      success: true,
      data: {
        workPlan: {
          _id: `wp-${Date.now()}`,
          ...data,
          createdAt: new Date().toISOString()
        }
      }
    };
  }
};

export const mockActivityService = {
  async getActivities(filters: any = {}) {
    await delay(200);
    return {
      success: true,
      data: { activities: MOCK_TASKS }
    };
  },

  async createActivity(data: any) {
    await delay(300);
    return {
      success: true,
      data: {
        activity: {
          _id: `act-${Date.now()}`,
          ...data,
          createdAt: new Date().toISOString()
        }
      }
    };
  }
};

export const checkMockMode = () => APP_CONFIG.USE_MOCK_DATA;
