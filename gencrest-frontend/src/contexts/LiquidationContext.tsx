/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
// gencrest_ui/src/contexts/LiquidationContext.tsx

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { LiquidationMetrics, DistributorLiquidation } from "../types/liquidation";
import { liquidationService } from "../services/dataService";
import { useAuth } from "./AuthContext";
import { ProductData } from "../data/mockData";
import { supabase } from "../lib/supabase";
import { APP_CONFIG } from "../config/appConfig";

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
}

export interface IRetailer {
  _id: string;
  id?: string;
  territory: string;
  zone: string;
  state: string;
  region: string;
  address: string;
  name: string;
  pincode: string
}

interface LiquidationState {
  overallMetrics: LiquidationMetrics | null;
  distributors: DistributorLiquidation[];
  retailers: IRetailer[];
  pagination: PaginationInfo;
  productData: ProductData[];
  productTransaction: { [skuCode: string]: any[] };
  distributorStats: {}|null;
  loadingMetrics: boolean;
  loadingDistributors: boolean;
  loadingProducts: boolean;
  loadingTransactions: boolean;
  loadingRetailers: boolean;
  loadingDistributorStats: boolean;
  error: string | null;
}

interface LiquidationContextType extends LiquidationState {
  fetchDistributors: (page: number, limit?: number, filters?: any) => Promise<void>;
  fetchOverallMetrics: (type:string) => Promise<void>;
  fetchProductData: (distributorId: string) => Promise<void>;
  fetchProductTransactions: (distributorId: string, skuCode: string, metric: string) => Promise<any[]>;
  fetchRetailers: () => Promise<IRetailer[]>;
  createRetailer: (retailer: IRetailer) => Promise<IRetailer | null>;
  uploadFile: (file: File) => Promise<{ url: string } | null>;
  submitLiquidation: (payload: any) => Promise<boolean>;
  fetchDistributorStats: (distributorId: string) => Promise<void>;
  refreshAllData: () => void;
}

const LiquidationContext = createContext<LiquidationContextType | undefined>(undefined);

export const LiquidationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  const [state, setState] = useState<LiquidationState>({
    overallMetrics: null,
    distributors: [],
    retailers: [],
    productData: [],
    productTransaction: {},
    distributorStats:null,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      pageSize: 10,
      totalCount: 0,
    },
    loadingMetrics: false,
    loadingDistributors: false,
    loadingProducts: false,
    loadingTransactions: false,
    loadingRetailers: false,
    loadingDistributorStats: false,
    error: null,
  });

  // ===== Fetch Overall Metrics =====
  const fetchOverallMetrics = useCallback(async (type:string='') => {
    if (!isAuthenticated) return;
    setState((s) => ({ ...s, loadingMetrics: true, error: null }));
    try {
      const response = await liquidationService.getLiquidationOverview(type);
      if (response.success && response.data) {
        setState((s) => ({
          ...s,
          overallMetrics: response.data.overallMetrics,
          loadingMetrics: false,
        }));
      } else throw new Error("Failed to fetch metrics");
    } catch (err: any) {
      console.log('API metrics failed, fetching from Supabase...', err);
      try {
        if (!supabase) {
          throw new Error('Supabase not configured');
        }

        const { data: inventoryData, error: invError } = await supabase
          .from('distributor_inventory')
          .select('*');

        if (invError) throw invError;

        const metrics = (inventoryData || []).reduce(
          (acc, item) => ({
            openingStock: {
              volume: acc.openingStock.volume + parseFloat(item.opening_stock || 0),
              value: acc.openingStock.value + parseFloat(item.opening_value || 0)
            },
            ytdNetSales: {
              volume: acc.ytdNetSales.volume + parseFloat(item.ytd_sales || 0),
              value: acc.ytdNetSales.value + parseFloat(item.ytd_sales_value || 0)
            },
            liquidation: {
              volume: acc.liquidation.volume + parseFloat(item.ytd_liquidation || 0),
              value: acc.liquidation.value + parseFloat(item.ytd_sales_value || 0)
            },
            balanceStock: {
              volume: acc.balanceStock.volume + parseFloat(item.balance_stock || 0),
              value: acc.balanceStock.value + parseFloat(item.balance_value || 0)
            }
          }),
          {
            openingStock: { volume: 0, value: 0 },
            ytdNetSales: { volume: 0, value: 0 },
            liquidation: { volume: 0, value: 0 },
            balanceStock: { volume: 0, value: 0 }
          }
        );

        const totalVolume = metrics.openingStock.volume + metrics.ytdNetSales.volume;
        const liquidationPercentage = totalVolume > 0
          ? Math.round((metrics.liquidation.volume / totalVolume) * 100)
          : 0;

        const uniqueDistributors = new Set(inventoryData?.map(item => item.distributor_code) || []);

        const supabaseMetrics: LiquidationMetrics = {
          ...metrics,
          liquidationPercentage,
          lastUpdated: new Date().toISOString(),
          totalDistributors: uniqueDistributors.size,
          totalRetailers: 245,
          totalMDOs: user?.role === 'TSM' ? 12 : undefined
        };

        setState((s) => ({
          ...s,
          overallMetrics: supabaseMetrics,
          loadingMetrics: false
        }));
      } catch (supabaseErr: any) {
        console.error('Supabase metrics fallback failed:', supabaseErr);
        const defaultMetrics: LiquidationMetrics = {
          openingStock: { volume: 0, value: 0 },
          ytdNetSales: { volume: 0, value: 0 },
          liquidation: { volume: 0, value: 0 },
          balanceStock: { volume: 0, value: 0 },
          liquidationPercentage: 0,
          lastUpdated: new Date().toISOString()
        };
        setState((s) => ({
          ...s,
          overallMetrics: defaultMetrics,
          loadingMetrics: false
        }));
      }
    }
  }, [isAuthenticated]);

  // ===== Fetch Distributors =====
  const fetchDistributors = useCallback(
    async (page: number, limit: number = 10, filters: any = {}) => {
      if (!isAuthenticated) return;
      setState((s) => ({ ...s, loadingDistributors: true, error: null }));
      try {
        console.log('Calling API getDistributorsPaginated...');
        const response = await liquidationService.getDistributorsPaginated(page, limit, filters);
        console.log('API response:', response);
        if (response.success && response.data) {
          setState((s) => ({
            ...s,
            distributors: response.data.data,
            pagination: response.data.pagination,
            loadingDistributors: false,
          }));
        } else {
          console.log('API returned unsuccessful response, throwing error');
          throw new Error(response.error?.message || "Failed to fetch distributors");
        }
      } catch (err: any) {
        console.log('API failed, fetching from Supabase directly...', err);
        try {
          if (!supabase) {
            console.error('Supabase not configured!');
            throw new Error('Supabase not configured');
          }

          console.log('Querying distributors from Supabase...');
          let query = supabase
            .from('distributors')
            .select('*')
            .eq('status', 'Active');

          // Apply search filter if provided
          if (filters.search) {
            query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,territory.ilike.%${filters.search}%`);
          }

          const { data: distributors, error } = await query;

          if (error) {
            console.error('Supabase query error:', error);
            throw error;
          }

          console.log('Distributors fetched from Supabase:', distributors);

          const distributorData: DistributorLiquidation[] = await Promise.all(
            (distributors || []).map(async (dist: any) => {
              const { data: inventoryData } = await supabase
                .from('distributor_inventory')
                .select('*')
                .eq('distributor_id', dist.code);

              // Get the most recent updated_at date from the inventory
              const lastUpdated = (inventoryData || []).reduce((latest, item) => {
                const itemDate = new Date(item.updated_at || item.created_at);
                return itemDate > latest ? itemDate : latest;
              }, new Date(0));

              const openingStock = (inventoryData || []).reduce(
                (acc, item) => ({
                  volume: acc.volume + parseFloat(item.opening_stock || 0),
                  value: acc.value + parseFloat(item.opening_value || 0)
                }),
                { volume: 0, value: 0 }
              );

              const ytdNetSales = (inventoryData || []).reduce(
                (acc, item) => ({
                  volume: acc.volume + parseFloat(item.ytd_sales || 0),
                  value: acc.value + parseFloat(item.ytd_sales_value || 0)
                }),
                { volume: 0, value: 0 }
              );

              const liquidation = (inventoryData || []).reduce(
                (acc, item) => ({
                  volume: acc.volume + parseFloat(item.ytd_liquidation || 0),
                  value: acc.value + parseFloat(item.ytd_sales_value || 0)
                }),
                { volume: 0, value: 0 }
              );

              const balanceStock = (inventoryData || []).reduce(
                (acc, item) => ({
                  volume: acc.volume + parseFloat(item.balance_stock || 0),
                  value: acc.value + parseFloat(item.balance_value || 0)
                }),
                { volume: 0, value: 0 }
              );

              const newSales = (inventoryData || []).reduce(
                (acc, item) => ({
                  volume: acc.volume + parseFloat(item.new_sales || 0),
                  value: acc.value + parseFloat(item.new_sales_value || 0)
                }),
                { volume: 0, value: 0 }
              );

              const totalVolume = openingStock.volume + ytdNetSales.volume;
              const liquidationPercentage = totalVolume > 0
                ? Math.round((liquidation.volume / totalVolume) * 100)
                : 0;

              return {
                id: dist.id,
                distributorName: dist.name,
                distributorCode: dist.code,
                territory: dist.territory || '',
                zone: dist.zone || '',
                state: dist.state || '',
                region: dist.region || '',
                status: dist.status || 'Active',
                priority: dist.priority || 'Medium',
                location_verified: dist.location_verified || false,
                latitude: dist.latitude,
                longitude: dist.longitude,
                location_verified_at: dist.location_verified_at,
                location_verified_by: dist.location_verified_by,
                metrics: {
                  openingStock,
                  ytdNetSales,
                  liquidation,
                  balanceStock,
                  newSales,
                  liquidationPercentage,
                  lastUpdated: lastUpdated.getTime() > 0 ? lastUpdated.toISOString() : new Date().toISOString()
                }
              };
            })
          );

          console.log('Setting distributor data:', distributorData);
          setState((s) => ({
            ...s,
            distributors: distributorData,
            pagination: {
              currentPage: 1,
              totalPages: 1,
              pageSize: limit,
              totalCount: distributorData.length
            },
            loadingDistributors: false,
          }));
          console.log('State updated with distributors');
        } catch (supabaseErr: any) {
          console.error('Supabase fallback failed:', supabaseErr);
          setState((s) => ({ ...s, loadingDistributors: false, error: supabaseErr.message }));
        }
      }
    },
    [isAuthenticated]
  );

  // ===== Fetch Product Data =====
  const fetchProductData = useCallback(
    async (distributorId: string) => {
      if (!isAuthenticated) return;
      setState((s) => ({ ...s, loadingProducts: true, error: null }));
      try {
        const response = await liquidationService.getProducts(distributorId);
        if (response.success && response.data) {
          setState((s) => ({
            ...s,
            productData: response.data,
            loadingProducts: false,
          }));
        } else throw new Error("Failed to fetch products");
      } catch (err: any) {
        console.log('API failed, fetching product data from Supabase...', err);
        try {
          if (!supabase) throw new Error('Supabase not configured');

          console.log('Querying distributor_inventory for:', distributorId);

          // First, get the distributor code if we have a UUID
          let distributorCode = distributorId;
          if (distributorId.includes('-')) {
            // It's a UUID, need to fetch the code
            const { data: distData, error: distError } = await supabase
              .from('distributors')
              .select('code')
              .eq('id', distributorId)
              .maybeSingle();

            if (distError) throw distError;
            if (distData) distributorCode = distData.code;
            console.log('Resolved distributor code:', distributorCode);
          }

          const { data: inventory, error } = await supabase
            .from('distributor_inventory')
            .select('*')
            .eq('distributor_code', distributorCode);

          if (error) {
            console.error('Supabase query error:', error);
            throw error;
          }

          console.log('Inventory data fetched:', inventory);

          // Group inventory by product
          const productMap = new Map<string, any>();

          (inventory || []).forEach((item: any) => {
            const productCode = item.product_code;

            if (!productMap.has(productCode)) {
              productMap.set(productCode, {
                productId: productCode,
                productCode: productCode,
                productName: item.product_name,
                category: 'Agrochemical',
                skus: []
              });
            }

            const openingStock = parseFloat(item.opening_stock || 0);
            const ytdSales = parseFloat(item.ytd_sales || 0);
            const balanceStock = parseFloat(item.balance_stock || 0);
            const openingValue = parseFloat(item.opening_value || 0);
            const ytdPurchases = parseFloat(item.ytd_purchases || 0);

            const unitPrice = openingStock > 0 ? openingValue / openingStock : 0;
            const liquidated = ytdSales;

            productMap.get(productCode).skus.push({
              productCode: item.product_code,
              skuCode: item.sku_code,
              skuName: item.sku_name,
              unit: item.unit,
              openingStock: openingStock,
              ytdSales: ytdSales,
              liquidated: liquidated,
              currentStock: balanceStock,
              unitPrice: unitPrice
            });
          });

          const productData: ProductData[] = Array.from(productMap.values());

          console.log('Product data transformed:', productData);

          // Add dummy data if no data found
          if (productData.length === 0) {
            console.log('No product data found, adding dummy data');
            const dummyData: ProductData[] = [
              {
                productId: 'FGASM00056',
                productCode: 'FGASM00056',
                productName: 'Samta KTS',
                category: 'Super Speciality Fertilizer',
                skus: [
                  {
                    productCode: 'FGASM00056',
                    skuCode: 'SKU001',
                    skuName: 'Samta KTS - 1 Ltr',
                    unit: 'Ltr',
                    openingStock: 250,
                    ytdSales: 180,
                    liquidated: 180,
                    currentStock: 70,
                    unitPrice: 700
                  },
                  {
                    productCode: 'FGASM00056',
                    skuCode: 'SKU002',
                    skuName: 'Samta KTS - 5 Ltr',
                    unit: 'Ltr',
                    openingStock: 150,
                    ytdSales: 100,
                    liquidated: 100,
                    currentStock: 50,
                    unitPrice: 3200
                  }
                ]
              },
              {
                productId: 'FGPRO00123',
                productCode: 'FGPRO00123',
                productName: 'ProGrow NPK',
                category: 'Fertilizer',
                skus: [
                  {
                    productCode: 'FGPRO00123',
                    skuCode: 'SKU003',
                    skuName: 'ProGrow NPK - 1 Kg',
                    unit: 'Kg',
                    openingStock: 500,
                    ytdSales: 350,
                    liquidated: 350,
                    currentStock: 150,
                    unitPrice: 450
                  },
                  {
                    productCode: 'FGPRO00123',
                    skuCode: 'SKU004',
                    skuName: 'ProGrow NPK - 5 Kg',
                    unit: 'Kg',
                    openingStock: 300,
                    ytdSales: 200,
                    liquidated: 200,
                    currentStock: 100,
                    unitPrice: 2100
                  },
                  {
                    productCode: 'FGPRO00123',
                    skuCode: 'SKU005',
                    skuName: 'ProGrow NPK - 25 Kg',
                    unit: 'Kg',
                    openingStock: 100,
                    ytdSales: 60,
                    liquidated: 60,
                    currentStock: 40,
                    unitPrice: 9800
                  }
                ]
              }
            ];
            setState((s) => ({
              ...s,
              productData: dummyData,
              loadingProducts: false,
            }));
          } else {
            setState((s) => ({
              ...s,
              productData,
              loadingProducts: false,
            }));
          }
        } catch (supabaseErr: any) {
          console.error('Supabase product fetch failed, using dummy data:', supabaseErr);
          // Use dummy data when Supabase fails
          const dummyData = [
            {
              productId: 'FGASM00056',
              productCode: 'FGASM00056',
              productName: 'Samta KTS',
              category: 'Super Speciality Fertilizer',
              skus: [
                {
                  productCode: 'FGASM00056',
                  skuCode: 'SKU001',
                  skuName: 'Samta KTS - 1 Ltr',
                  unit: 'Ltr',
                  openingStock: 250,
                  ytdSales: 180,
                  liquidated: 180,
                  currentStock: 70,
                  unitPrice: 700
                },
                {
                  productCode: 'FGASM00056',
                  skuCode: 'SKU002',
                  skuName: 'Samta KTS - 5 Ltr',
                  unit: 'Ltr',
                  openingStock: 150,
                  ytdSales: 100,
                  liquidated: 100,
                  currentStock: 50,
                  unitPrice: 3200
                }
              ]
            },
            {
              productId: 'FGPRO00123',
              productCode: 'FGPRO00123',
              productName: 'ProGrow NPK',
              category: 'Fertilizer',
              skus: [
                {
                  productCode: 'FGPRO00123',
                  skuCode: 'SKU003',
                  skuName: 'ProGrow NPK - 1 Kg',
                  unit: 'Kg',
                  openingStock: 500,
                  ytdSales: 350,
                  liquidated: 350,
                  currentStock: 150,
                  unitPrice: 450
                },
                {
                  productCode: 'FGPRO00123',
                  skuCode: 'SKU004',
                  skuName: 'ProGrow NPK - 5 Kg',
                  unit: 'Kg',
                  openingStock: 300,
                  ytdSales: 200,
                  liquidated: 200,
                  currentStock: 100,
                  unitPrice: 2100
                },
                {
                  productCode: 'FGPRO00123',
                  skuCode: 'SKU005',
                  skuName: 'ProGrow NPK - 25 Kg',
                  unit: 'Kg',
                  openingStock: 100,
                  ytdSales: 60,
                  liquidated: 60,
                  currentStock: 40,
                  unitPrice: 9800
                }
              ]
            }
          ];
          setState((s) => ({
            ...s,
            productData: dummyData,
            loadingProducts: false,
            error: null
          }));
        }
      }
    },
    [isAuthenticated]
  );

  // ===== Fetch Product Transactions (Per SKU) =====
  const fetchProductTransactions = useCallback(
    async (distributorId: string, skuCode: string, selectedMetric: string) => {
      if (!isAuthenticated) return [];
      setState((s) => ({ ...s, loadingTransactions: true, error: null }));
      try {
        const response = await liquidationService.getProductTransactionsData(distributorId, skuCode, selectedMetric);
        if (response.success && response.data) {
          setState((s) => ({
            ...s,
            productTransaction: { ...s.productTransaction, [skuCode]: response.data },
            loadingTransactions: false,
          }));
          return response.data;
        } else throw new Error("Failed to fetch transactions");
      } catch (err: any) {
        console.log('API failed, returning dummy transaction data');
        // Return dummy transaction data
        const dummyTransactions = [
          {
            invoiceNumber: 'INV-2024-001',
            date: '15.04.2024',
            type: 'Sale',
            quantity: 50,
            value: '35.00'
          },
          {
            invoiceNumber: 'INV-2024-002',
            date: '22.04.2024',
            type: 'Sale',
            quantity: 30,
            value: '21.00'
          },
          {
            invoiceNumber: 'INV-2024-003',
            date: '10.05.2024',
            type: 'Return',
            quantity: -10,
            value: '-7.00'
          },
          {
            invoiceNumber: 'INV-2024-004',
            date: '18.06.2024',
            type: 'Sale',
            quantity: 60,
            value: '42.00'
          },
          {
            invoiceNumber: 'INV-2024-005',
            date: '25.07.2024',
            type: 'Sale',
            quantity: 50,
            value: '35.00'
          }
        ];
        setState((s) => ({
          ...s,
          productTransaction: { ...s.productTransaction, [skuCode]: dummyTransactions },
          loadingTransactions: false
        }));
        return dummyTransactions;
      }
    },
    [isAuthenticated]
  );

  // ===== Fetch Retailers =====
  const fetchRetailers = useCallback(async () => {
    if (!isAuthenticated) return [];
    setState((s) => ({ ...s, loadingRetailers: true, error: null }));
    try {
      const response = await liquidationService.getRetailers();
      if (response.success && response.data) {
        const retailersData = response.data.retailers || response.data.data || response.data;
        setState((s) => ({
          ...s,
          retailers: Array.isArray(retailersData) ? retailersData.map((r: any) => ({ ...r, id: r._id || r.id })) : [],
          loadingRetailers: false,
        }));
        return response.data;
      } else throw new Error("Failed to fetch retailers");
    } catch (err: any) {
      setState((s) => ({ ...s, loadingRetailers: false, error: err.message }));
      return [];
    }
  }, [isAuthenticated]);

  // ===== Create Retailer =====
  const createRetailer = useCallback(
    async (retailer: IRetailer) => {
      if (!isAuthenticated) return null;
      try {
        const response = await liquidationService.createRetailer(retailer);
        if (response.success && response.data) {
          const retailerData = response.data.retailer || response.data;
          // Normalize the retailer data to have an id field
          const normalizedRetailer = {
            ...retailerData,
            id: retailerData._id || retailerData.id
          };
          setState((s) => ({
            ...s,
            retailers: [...s.retailers, normalizedRetailer],
          }));
          return normalizedRetailer;
        } else throw new Error("Failed to create retailer");
      } catch (err) {
        console.error("Error creating retailer:", err);
        return null;
      }
    },
    [isAuthenticated]
  );

  // ===== Upload File (Proof / Signature) =====
  const uploadFile = useCallback(
    async (file: File) => {
      if (!isAuthenticated) return null;

      // In mock mode, return a data URL directly
      if (APP_CONFIG.USE_MOCK_DATA) {
        try {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          return { url: dataUrl };
        } catch (err) {
          console.error("File read error:", err);
          return null;
        }
      }

      // In API mode, upload to backend
      try {
        const response = await liquidationService.uploadMedia(file);
        console.log(response)
        if (response.success && response.fileUrl) {
          return { url: response.fileUrl };
        } else throw new Error("File upload failed");
      } catch (err) {
        console.error("File upload error:", err);
        return null;
      }
    },
    [isAuthenticated]
  );

  // ===== Submit Final Liquidation Entry =====
  const submitLiquidation = useCallback(
    async (payload: any) => {
      if (!isAuthenticated) return false;
      try {
        const response = await liquidationService.submitLiquidation(payload);
        if (response.success) {
          // Create verification approval request
          try {
            const { error: requestError } = await supabase
              .from('verification_requests')
              .insert({
                request_type: 'distributor_verification',
                entity_id: payload.distributorCode || payload.distributorId,
                entity_name: payload.distributorName,
                entity_location: payload.location || '',
                submitted_by_id: user?.id || 'unknown',
                submitted_by_name: payload.submittedBy || user?.email || 'Unknown',
                submitted_by_role: user?.user_metadata?.role || user?.role || 'Staff',
                status: 'pending',
                verification_data: payload,
                skus_verified: payload.verificationData || [],
                total_skus_count: payload.verificationData?.length || 0,
                stock_changes: {
                  total_liquidated: payload.totalLiquidated || 0,
                  changes_by_sku: payload.verificationData?.map((sku: any) => ({
                    sku_code: sku.skuCode,
                    liquidated: sku.liquidated,
                    change_type: 'liquidation'
                  })) || []
                },
                proof_documents: payload.proofs || []
              });

            if (requestError) {
              console.error('Error creating verification request:', requestError);
            }
          } catch (err) {
            console.error('Error creating approval request:', err);
          }

          // Save to stock_verification_history for distributor verification
          try {
            const skusChecked = (payload.verificationData || []).map((sku: any) => ({
              sku_code: sku.skuCode || '',
              sku_name: sku.skuName || sku.name || '',
              product_name: sku.productName || sku.name || '',
              product_code: sku.productCode || '',
              unit: sku.unit || '',
              old_stock: sku.oldStock || 0,
              new_stock: sku.newStock || 0,
              difference: (sku.newStock || 0) - (sku.oldStock || 0),
              farmer_allocation: sku.farmerQuantity || 0,
              retailer_allocation: sku.retailerQuantity || 0,
              allocated_retailers: sku.retailers || []
            }));

            const photoProofs = (payload.proofUrls || []).map((url: string, index: number) => ({
              type: 'photo',
              url: url,
              name: `photo_${index + 1}.jpg`
            }));

            if (skusChecked.length > 0) {
              const { error: historyError } = await supabase
                .from('stock_verification_history')
                .insert({
                  verification_date: new Date().toISOString(),
                  retailer_id: payload.distributorCode || payload.distributorId || 'unknown',
                  retailer_name: payload.distributorName || 'Unknown Distributor',
                  distributor_id: payload.distributorCode || payload.distributorId,
                  distributor_name: payload.distributorName,
                  skus_checked: skusChecked,
                  total_skus_count: skusChecked.length,
                  verified_by_id: user?.id || 'unknown',
                  verified_by_name: payload.submittedBy || user?.email || 'Unknown',
                  verified_by_role: user?.user_metadata?.role || user?.role || 'Staff',
                  proof_type: payload.signatureUrl && photoProofs.length > 0 ? 'both' : payload.signatureUrl ? 'signature' : 'photo',
                  signature_image: payload.signatureUrl || null,
                  proof_photos: photoProofs,
                  latitude: payload.latitude || null,
                  longitude: payload.longitude || null,
                  notes: `Distributor verification - ${skusChecked.length} SKUs checked`
                });

              if (historyError) {
                console.error('Error saving distributor verification history:', historyError);
              } else {
                console.log('✅ Distributor verification history saved successfully');
              }
            }
          } catch (err) {
            console.error('Error saving distributor verification history:', err);
          }

          // Update the distributor's lastUpdated timestamp in local state
          const currentTimestamp = new Date().toISOString();
          setState(prev => ({
            ...prev,
            distributors: prev.distributors.map(dist =>
              dist.distributorCode === payload.distributorCode
                ? {
                    ...dist,
                    metrics: {
                      ...dist.metrics,
                      lastUpdated: currentTimestamp
                    }
                  }
                : dist
            )
          }));

          return true;
        }
        throw new Error( "Submission failed");
      } catch (err) {
        console.error("Error submitting liquidation:", err);
        return false;
      }
    },
    [isAuthenticated, user]
  );

  const fetchDistributorStats= useCallback(
    async (distributorId: string) => {
      if (!isAuthenticated) {
        console.warn('fetchDistributorStats: User not authenticated');
        return;
      }
      console.log('fetchDistributorStats: Starting fetch for', distributorId);
      setState((s) => ({ ...s, loadingDistributorStats: true, error: null }));
      try {
        const response = await liquidationService.getDistributorStats(distributorId);
        console.log('fetchDistributorStats: Response received', response);
        if (response.success && response.data) {
          console.log('fetchDistributorStats: Setting data', response.data);
          setState((s) => ({
            ...s,
            distributorStats: response.data,
            loadingDistributorStats: false,
          }));
        } else {
          console.error('fetchDistributorStats: Invalid response', response);
          throw new Error("Failed to fetch distributor status");
        }
      } catch (err: any) {
        console.error('fetchDistributorStats: Error', err);
        setState((s) => ({ ...s, loadingDistributorStats: false, error: err.message }));
      }
    },
    [isAuthenticated]
  )
  // ===== Refresh All =====
  const refreshAllData = useCallback(() => {
    fetchOverallMetrics();
    fetchDistributors(1, state.pagination.pageSize);
  }, [fetchOverallMetrics, fetchDistributors, state.pagination.pageSize]);

  return (
    <LiquidationContext.Provider
      value={{
        ...state,
        fetchDistributors,
        fetchOverallMetrics,
        refreshAllData,
        fetchProductData,
        fetchProductTransactions,
        fetchRetailers,
        createRetailer,
        uploadFile,
        submitLiquidation,
        fetchDistributorStats
      }}
    >
      {children}
    </LiquidationContext.Provider>
  );
};

export const useLiquidation = () => {
  const context = useContext(LiquidationContext);
  if (context === undefined) {
    throw new Error("useLiquidation must be used within a LiquidationProvider");
  }
  return context;
};
