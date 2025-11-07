import { any, number } from "joi";
import { Distributor } from "../models/distributor.model";
import { DistributorStock } from "../models/distributorStock.model";
import { logger } from "../utils/logger";

class DashboardService {

 async getDashboardData(filters: Record<string, any>) {
  const data = {
   overview: {
    opening: {volume:0, value:0},
    liquidation: {volume:0, value:0},
    ytdSales: {volume:0, value:0},
    balanceStock:{volume:0, value:0},
    liquidationPercentage: 0,
    distributors: {
     totalmember: 0,
     active: 0,
     inactive: 0,
    },
   },
   meetings: [],
   activities: [],
   approvals: [],
  };

  try {
   // --- Fetch distributors based on filters ---
   const query = { ...filters };
   const distributors = await Distributor.find(query).lean();
   const distributorIds = distributors.map((d) => d.distributorCode);

   data.overview.distributors.totalmember = distributorIds.length;
   distributors.forEach((d) => {
    if (d.isActive) data.overview.distributors.active += 1;
    else data.overview.distributors.inactive += 1;
   });

   // --- Aggregate DistributorStock totals ---
   const stockAgg = await DistributorStock.aggregate([
    { $match: { distributorCode: { $in: distributorIds } } },
    {
     $group: {
      _id: null,
      totalOpeningStockValue: { $sum: "$openingStock.value" },
      totalOpeningStockAmount: { $sum: "$openingStock.amount" },
      totalLiquidationsStockValue: { $sum: "$liquidationStock.value" },
      totalLiquidationStockAmount: { $sum: "$liquidationStock.amount" },
      totalytdNetSalesValue: { $sum: "$ytdNetSales.value" },
      totalYtdNetSalesAmount: { $sum: "$ytdNetSales.amount" },
      totalBalanceStockValue: { $sum: "$balanceStock.value" },
      totalBalanceStockAmount: { $sum: "$balanceStock.amount" },
     },
    },
   ]);

   if (stockAgg.length > 0) {
    const totals = stockAgg[0];
 
    data.overview.opening = {volume:totals.totalOpeningStockValue || 0, value:totals.totalOpeningStockAmount || 0};
    data.overview.liquidation = {volume: totals.totalLiquidationsStockValue || 0, value: totals.totalLiquidationStockAmount || 0};
    data.overview.ytdSales = {volume:totals.totalytdNetSalesValue || 0, value:totals.totalYtdNetSalesAmount || 0};
    data.overview.balanceStock = {volume:totals.totalBalanceStockValue || 0,value:totals.totalBalanceStockAmount || 0};
    
    const liquidationPercentage =
      data.overview.opening.volume  + data.overview.ytdSales.volume > 0
        ? Number(
            (
              ((data.overview.opening.volume  + data.overview.ytdSales.volume - data.overview.balanceStock.volume) /
                (data.overview.opening.volume  + data.overview.ytdSales.volume)) *
              100
            ).toFixed(2)
          )
        : 0;
        data.overview.liquidationPercentage = liquidationPercentage;
   }

 

   // --- Optionally add meetings / activities / approvals later ---
   // data.meetings = await Meeting.find({ distributorCode: { $in: distributorIds } });
   // data.activities = await ActivityLog.find({ distributorCode: { $in: distributorIds } });
   // data.approvals = await Approvals.find({ distributorCode: { $in: distributorIds } });

   logger.info("✅ Dashboard data aggregation complete.");
   return data;
  } catch (err: any) {
   logger.error(err, "❌ Failed to fetch dashboard data");
   throw new Error("Dashboard data fetch failed: " + err.message);
  }
 }
}

const dashboardService = new DashboardService();
export default dashboardService;
