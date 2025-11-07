/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import {
  X,
  Building,
  MapPin,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { useLiquidation } from "../../contexts/LiquidationContext";

interface DetailedMetricsModalProps {
  selectedMetric: string;
  selectedDistributorId: string | null;
  onClose: () => void;
  distributorMetrics: any[];
  userTerritory?: string;
}

export const DetailedMetricsModal: React.FC<DetailedMetricsModalProps> = ({
  selectedMetric,
  selectedDistributorId,
  onClose,
  distributorMetrics,
  userTerritory,
}) => {
  const {
    productData,
    fetchProductData,
    fetchProductTransactions,
  } = useLiquidation();

  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
    new Set()
  );
  const [skuTransactions, setSkuTransactions] = useState<Record<string, any[]>>(
    {}
  );
  const [loadingSKU, setLoadingSKU] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedDistributorId) {
      console.log('[DetailedMetricsModal] No distributor selected, will show aggregated view');
      return;
    }
    console.log('[DetailedMetricsModal] Fetching product data for distributor:', selectedDistributorId);
    setLoadingProducts(true);
    fetchProductData(selectedDistributorId)
      .finally(() => {
        setLoadingProducts(false);
        console.log('[DetailedMetricsModal] Product data loaded');
      });
  }, [selectedDistributorId, fetchProductData]);

  const toggleProduct = async (productId: string, product: any) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);

      // Auto-fetch transactions for sales/liquidation metrics
      const needsInvoiceDetails = selectedMetric === "sales" || selectedMetric === "liquidation";
      if (needsInvoiceDetails && product) {
        // Fetch transactions for all SKUs in this product
        product.skus.forEach((sku: any) => {
          if (!skuTransactions[sku.skuCode]) {
            handleFetchTransactions(sku.skuCode);
          }
        });
      }
    }
    setExpandedProducts(newExpanded);
  };

  const handleFetchTransactions = async (skuCode: string) => {
    if (!selectedDistributorId || !selectedMetric) return;
    setLoadingSKU(skuCode);
    try {
      const data = await fetchProductTransactions(
        selectedDistributorId,
        skuCode,
        selectedMetric
      );
      setSkuTransactions((prev) => ({ ...prev, [skuCode]: data }));
    } finally {
      setLoadingSKU(null);
    }
  };

  const getMetricTitle = () => {
    switch (selectedMetric) {
      case "opening":
        return "Opening Stock Details";
      case "sales":
        return "YTD Net Sales Details";
      case "liquidation":
        return "Liquidation Details";
      case "balance":
        return "Balance Stock Details";
      default:
        return "Details";
    }
  };

  const filteredData = selectedDistributorId
    ? distributorMetrics.filter((d) => d.id === selectedDistributorId)
    : distributorMetrics;

  const totalValue = filteredData.reduce((sum, dist) => {
    if (selectedMetric === "opening")
      return sum + dist.metrics.openingStock.value;
    if (selectedMetric === "sales") return sum + dist.metrics.ytdNetSales.value;
    if (selectedMetric === "liquidation")
      return sum + dist.metrics.liquidation.value;
    if (selectedMetric === "balance")
      return sum + dist.metrics.balanceStock.value;
    return sum;
  }, 0);

  const needsInvoiceDetails = selectedMetric === "sales" || selectedMetric === "liquidation";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* HEADER */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {getMetricTitle()}
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                  <Building className="w-4 h-4" />
                  {selectedDistributorId ? (
                    <>
                      {(() => {
                        const dist = distributorMetrics.find(
                          (d) => d.id === selectedDistributorId
                        );
                        return dist ? (
                          <>
                            <span className="font-semibold capitalize">
                              {dist.distributorName}
                            </span>
                            <span>•</span>
                            <span>Code: {dist.distributorCode}</span>
                            <span>•</span>
                            <MapPin className="w-4 h-4" />
                            <span className="capitalize">
                              {dist.territory}, {dist.state}
                            </span>
                          </>
                        ) : null;
                      })()}
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">All Distributors</span>
                      <span>•</span>
                      <span>
                        Total: {distributorMetrics.length} distributor
                        {distributorMetrics.length !== 1 ? "s" : ""}
                      </span>
                      <span>•</span>
                      <MapPin className="w-4 h-4" />
                      <span>{userTerritory || "All Territories"}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="bg-orange-50 border-2 border-orange-400 rounded-xl px-6 py-2 text-center">
                <div className="text-2xl font-bold text-orange-900">
                  ₹{totalValue.toFixed(2)}L
                </div>
                <div className="text-xs text-orange-600">Total Balance</div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">
          {(() => {
            console.log('[DetailedMetricsModal] Render - productData:', productData);
            console.log('[DetailedMetricsModal] Render - loadingProducts:', loadingProducts);
            console.log('[DetailedMetricsModal] Render - selectedDistributorId:', selectedDistributorId);
            return null;
          })()}
          {loadingProducts ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-100 rounded-lg"
                ></div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                console.log('[DetailedMetricsModal] Product data check:', {
                  productDataLength: productData?.length,
                  productData: productData,
                  selectedMetric,
                  selectedDistributorId
                });

                // If no distributor selected, use dummy aggregated data
                const displayData = selectedDistributorId ? productData : [
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

                const hasData = displayData?.some((p) =>
                  p?.skus?.some(
                    (s) =>
                      s.openingStock > 0 ||
                      s.ytdSales > 0 ||
                      s.liquidated > 0 ||
                      s.currentStock > 0
                  )
                );

                console.log('[DetailedMetricsModal] hasData:', hasData);

                if (!hasData) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
                      <div className="text-4xl mb-3">📦</div>
                      <p className="text-lg font-medium">No data found</p>
                      <p className="text-sm text-gray-400 mt-1">
                        There are no stock, sales, or liquidation records available.
                      </p>
                    </div>
                  );
                }

                return displayData?.map((product) => {
                  const getMetricSum = (metric: string) =>
                    product.skus.reduce((sum, sku) => {
                      if (metric === "opening") return sum + sku.openingStock;
                      if (metric === "sales") return sum + sku.ytdSales;
                      if (metric === "liquidation") return sum + sku.liquidated;
                      if (metric === "balance") return sum + sku.currentStock;
                      return sum;
                    }, 0);

                  const productTotal = getMetricSum(selectedMetric);
                  if (productTotal === 0) return null;

                  const productValue = product.skus.reduce((sum, sku) => {
                    let q = 0;
                    if (selectedMetric === "opening") q = sku.openingStock;
                    else if (selectedMetric === "sales") q = sku.ytdSales;
                    else if (selectedMetric === "liquidation")
                      q = sku.liquidated;
                    else if (selectedMetric === "balance")
                      q = sku.currentStock;
                    return sum + q * sku.unitPrice;
                  }, 0);

                  return (
                    <div key={product.productId} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Product Header - Clickable */}
                      <div
                        className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 cursor-pointer hover:from-orange-600 hover:to-orange-700 transition-all flex items-center justify-between"
                        onClick={() => toggleProduct(product.productId, product)}
                      >
                        <div className="flex items-center gap-3 text-white flex-1">
                          {expandedProducts.has(product.productId) ? (
                            <ChevronUp className="w-5 h-5 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-5 h-5 flex-shrink-0" />
                          )}
                          <div>
                            <h4 className="font-semibold text-base">
                              {product.productName}
                            </h4>
                            <p className="text-xs opacity-90 mt-0.5">
                              Code: <span className="font-semibold uppercase">{product.productCode}</span> •
                              Category: <span className="font-semibold">{product.category}</span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-white">
                          <div className="text-lg font-bold">
                            ₹{productValue.toLocaleString()}
                          </div>
                          <div className="text-xs opacity-90">
                            {productTotal.toLocaleString()} Kg/Ltr
                          </div>
                        </div>
                      </div>

                      {/* SKU Details - Expanded */}
                      {expandedProducts.has(product.productId) && (
                        <div className="bg-white p-4 space-y-6">
                              {product.skus.map((sku) => {
                                let skuQty = 0;
                                if (selectedMetric === "opening")
                                  skuQty = sku.openingStock;
                                else if (selectedMetric === "sales")
                                  skuQty = sku.ytdSales;
                                else if (selectedMetric === "liquidation")
                                  skuQty = sku.liquidated;
                                else if (selectedMetric === "balance")
                                  skuQty = sku.currentStock;

                                if (skuQty === 0) return null;

                                const skuValue = skuQty * sku.unitPrice;
                                const transactions = skuTransactions[sku.skuCode] || [];

                                return (
                                  <div key={sku.skuCode} className="border border-gray-200 rounded-lg overflow-hidden">
                                    {/* SKU Summary Header */}
                                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                                      <div className="flex-1">
                                        <h5 className="text-sm font-semibold text-gray-900">{sku.skuName}</h5>
                                        <p className="text-xs text-gray-600 mt-0.5">
                                          SKU: <span className="font-medium">{sku.skuCode}</span> •
                                          Unit Price: <span className="font-medium">₹{sku.unitPrice}/{sku.unit}</span>
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-base font-bold text-gray-900">
                                          ₹{skuValue.toLocaleString()}
                                        </div>
                                        <div className="text-xs text-gray-600">
                                          {skuQty.toLocaleString()} {sku.unit}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Invoice Details - Show directly for Sales/Liquidation */}
                                    {needsInvoiceDetails && (
                                      <div className="bg-white p-4">
                                        {loadingSKU === sku.skuCode ? (
                                          <div className="flex justify-center items-center py-6 text-gray-500">
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Loading invoice details...
                                          </div>
                                        ) : transactions.length > 0 ? (
                                          <div className="overflow-hidden border border-gray-200 rounded-lg">
                                            <table className="w-full">
                                              <thead className="bg-gray-100">
                                                <tr>
                                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                                                    Invoice Number
                                                  </th>
                                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">
                                                    Invoice Date
                                                  </th>
                                                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">
                                                    Sale/Return
                                                  </th>
                                                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">
                                                    Quantity
                                                  </th>
                                                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">
                                                    Value
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-200">
                                                {transactions.map((txn, idx) => (
                                                  <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2 text-sm text-gray-900 font-mono">
                                                      {txn.invoiceNumber || 'N/A'}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-900">
                                                      {txn.date}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                      <span
                                                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                                          txn.type === "Sale"
                                                            ? "bg-green-100 text-green-700"
                                                            : txn.type === "Return"
                                                            ? "bg-red-100 text-red-700"
                                                            : "bg-blue-100 text-blue-700"
                                                        }`}
                                                      >
                                                        {txn.type}
                                                      </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">
                                                      {txn.quantity.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-900 text-right font-bold">
                                                      ₹{txn.value}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        ) : (
                                          <div className="text-center py-4 text-sm text-gray-500">
                                            No invoice data available
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
