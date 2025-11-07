import mongoose, { PipelineStage, Types } from "mongoose";
import { Distributor } from "../models/distributor.model";
import { DistributorLiquidationEntries, IDistributorLiquidationEntries } from "../models/distributorLiquidation.Entriesmodel";
import { DistributorStock, IDistributorStock } from "../models/distributorStock.model";
import { Product } from "../models/product.model";
import { logger } from "../utils/logger";
import { DistributorSales } from "../models/distributorSales.model";
import { IUser } from "../models/user.model";
import { RetailerStock } from "../models/retailerStock.model";

class LiquidationService {
  async getDistributorsPagnated(page: number, limit: number, filters: any, search: any = ''): Promise<any> {
    const skip = (page - 1) * limit;
    const query = filters;
    if (search?.trim()) {
      const words = search.trim().split(/\s+/);
      const regexes = words.map((word: string) => new RegExp(`\\b${word}\\b`, 'i'));
      query['$or'] = [
        { name: { $in: regexes } },
        { companyName: { $in: regexes } },
        { distributorCode: { $in: regexes } }
      ];
    }
    const [distributors, totalCount] = await Promise.all([
      Distributor.find(query).skip(skip).limit(limit).lean(),
      Distributor.countDocuments(query)
    ]);

    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      pageSize: limit,
      totalCount: totalCount,
    };
    if (!distributors.length)
      return { data: [], pagination };
    const distributorIds = distributors.map((d) => d.distributorCode);
    const stockMetricsPromise = DistributorStock.aggregate([
      { $match: { distributorCode: { $in: distributorIds } } },
      {
        $group: {
          _id: '$distributorCode',
          openingStockVolume: { $sum: '$openingStock.value' },
          openingStockValue: { $sum: '$openingStock.amount' },

          ytdNetSalesVolume: { $sum: '$ytdNetSales.value' },
          ytdNetSalesValue: { $sum: '$ytdNetSales.amount' },

          balanceStockVolume: { $sum: '$balanceStock.value' },
          balanceStockValue: { $sum: '$balanceStock.amount' },

          liquidationVolume: { $sum: '$liquidationStock.value' },
          liquidationValue: { $sum: '$liquidationStock.amount' }
        },
      },
    ]);
    const [stockResults] = await Promise.all([
      stockMetricsPromise
    ]);

    const stockMap = new Map(stockResults.map(s => [s._id, s]));

    const result = await Promise.all(
      distributors.map(async (d: any) => {
        const id = d.distributorCode?.toString();
        const stock = stockMap.get(id);

        const openingStockVolume = stock?.openingStockVolume || 0;
        const ytdNetSalesVolume = stock?.ytdNetSalesVolume || 0;
        const balanceStockVolume = stock?.balanceStockVolume || 0;

        const liquidationPercentage =
          (openingStockVolume + ytdNetSalesVolume) > 0
            ? Number(
              (
                ((openingStockVolume + ytdNetSalesVolume - balanceStockVolume) /
                  (openingStockVolume + ytdNetSalesVolume)) *
                100
              ).toFixed(2)
            )
            : 0;

        // ✅ Fix: Await the query properly
        const lastLiquidationEntry = await DistributorLiquidationEntries.findOne({
          distributorCode: d.distributorCode,
        })
          .sort({ entryDate: -1 })
          .select("entryDate updatedAt")
          .lean();

        const lastUpdated =
          lastLiquidationEntry?.entryDate || new Date('2025-04-01') || d.updatedAt || null;

        return {
          id: d.distributorCode,
          distributorName: d.companyName ?? d.name ?? "N/A",
          distributorCode: d.distributorCode,
          territory: d.territory ?? "N/A",
          region: d.region ?? "N/A",
          zone: d.zone ?? "N/A",
          state: d.state ?? "N/A",
          status: d.isActive ? "Active" : "Inactive",
          priority: "High",
          location: d.location ?? null,
          metrics: {
            openingStock: {
              volume: openingStockVolume,
              value: stock?.openingStockValue || 0,
            },
            ytdNetSales: {
              volume: ytdNetSalesVolume,
              value: stock?.ytdNetSalesValue || 0,
            },
            liquidation: {
              volume: stock?.liquidationVolume || 0,
              value: stock?.liquidationValue || 0,
            },
            balanceStock: {
              volume: balanceStockVolume,
              value: stock?.balanceStockValue || 0,
            },
            liquidationPercentage,
            lastUpdated,
          },
        };
      })
    );

    return { data: result, pagination };
  }
  async getDistributorProductMetrics(distributorCode: string): Promise<any> {

    if (!distributorCode) throw new Error("distributorCode is required");

    // 1️⃣ Get all stock records for this distributor
    const stockEntries = await DistributorStock.find({ distributorCode })
      .select("productCode openingStock balanceStock ytdNetSales liquidationStock productPrice")
      .lean();

    if (!stockEntries.length) return [];

    // 2️⃣ Get all related product details
    const productCodes = [...new Set(stockEntries.map((s) => s.productCode.toLowerCase()))];
    const products = await Product.find({ productCode: { $in: productCodes } })
      .select("_id productCode productName category sku price")
      .lean();

    const productMap: Record<string, any> = {};
    for (const p of products) {
      const code = (p.productCode ?? "").toLowerCase();
      productMap[code] = p;
    }
    console.log('productMap', productMap)

    // 3️⃣ Group metrics by product
    const productData: Record<string, any> = {};

    for (const s of stockEntries) {
      const code = (s.productCode ?? "").toLowerCase();
      const product = productMap[code];

      if (!product) continue;

      if (!productData[code]) {
        productData[code] = {
          productId: product.productCode,
          productCode: product.productCode,
          productName: product.productName,
          category: product.category,
          skus: [],
        };
      }

      const skuMetrics = {
        productCode: product.productCode,
        skuCode: product.sku?.trim() || `${product.productCode}-SKU`,
        skuName: product.name,
        unit: "Kg/Ltr",
        openingStock: s.openingStock?.value ?? 0,
        ytdSales: s.ytdNetSales?.value ?? 0,
        liquidated: s.liquidationStock?.value ?? 0,
        currentStock: s.balanceStock?.value ?? 0,
        unitPrice: Number(product.price ?? s.productPrice ?? 0),
      };

      productData[code].skus.push(skuMetrics);
    }

    return Object.values(productData);
  }
  async getDistributorTransactionSummary(
    distributorCode: string,
    productCode?: string,
    type?: "opening" | "balance" | "liquidation" | "sales"
  ) {
    logger.debug(
      `Running getDistributorTransactionSummary for ${distributorCode}, type=${type}, product=${productCode || "ALL"}`
    );

    if (!distributorCode) throw new Error("distributorCode is required");

    try {
      const baseQuery: Record<string, any> = { distributorCode };
      if (productCode) baseQuery.productCode = productCode.toLowerCase();

      let result: any[] = [];

      // 1️⃣ --- OPENING & BALANCE STOCK ---
      if (type === "opening" || type === "balance") {
        const stockField =
          type === "opening" ? "$openingStock" : "$balanceStock";

        const pipeline: PipelineStage[] = [
          { $match: baseQuery },
          {
            $project: {
              _id: 0,
              date: { $dateToString: { format: "%d.%m.%Y", date: "$updatedAt" } },
              quantity: { $ifNull: [`${stockField}.value`, 0] },
              value: { $ifNull: [`${stockField}.amount`, 0] },
              productPrice: { $toDouble: "$productPrice" },
              type: type === "opening" ? "Opening Stock" : "Closing Stock",
              productCode: 1,
            },
          },
        ];

        result = await DistributorStock.aggregate(pipeline);
      }

      // 2️⃣ --- LIQUIDATION ENTRIES ---
      else if (type === "liquidation") {
        const pipeline: PipelineStage[] = [
          { $match: { distributorCode } },
          { $unwind: "$productEntries" },
          ...(productCode
            ? [{ $match: { "productEntries.productCode": productCode.toLowerCase() } }]
            : []),
          {
            $project: {
              _id: 0,
              date: { $dateToString: { format: "%d.%m.%Y", date: "$entryDate" } },
              quantity: { $ifNull: ["$productEntries.soldToFarmer.value", 0] },
              value: { $ifNull: ["$productEntries.soldToFarmer.amount", 0] },
              productCode: "$productEntries.productCode",
              productPrice: "$productEntries.productPrice",
              type: "Liquidation",
            },
          },
        ];

        result = await DistributorLiquidationEntries.aggregate(pipeline);
      }

      // 3️⃣ --- SALES TRANSACTIONS ---
      else if (type === "sales") {
        const pipeline: PipelineStage[] = [
          { $match: baseQuery },
          { $sort: { invoiceDate: 1 } },
          {
            $project: {
              _id: 0,
              date: { $dateToString: { format: "%d.%m.%Y", date: "$invoiceDate" } },
              quantity: { $ifNull: ["$saleQuantity", 0] },
              value: { $ifNull: ["$saleAmount", 0] },
              productCode: 1,
              productPrice: 1,
              type: "Sales",
              invoiceNumber: 1,
            },
          },
        ];

        result = await DistributorSales.aggregate(pipeline);
      }

      // 4️⃣ --- DEFAULT (All types combined overview) ---
      else {
        const [stock, sales, liq] = await Promise.all([
          DistributorStock.aggregate([
            { $match: baseQuery },
            {
              $project: {
                _id: 0,
                type: "Opening Stock",
                date: { $dateToString: { format: "%d.%m.%Y", date: "$createdAt" } },
                quantity: "$openingStock.value",
                value: "$openingStock.amount",
                productCode: 1,
                productPrice: { $toDouble: "$productPrice" },
              },
            },
          ]),
          DistributorSales.aggregate([
            { $match: baseQuery },
            {
              $project: {
                _id: 0,
                type: "Sales",
                date: { $dateToString: { format: "%d.%m.%Y", date: "$invoiceDate" } },
                quantity: "$saleQuantity",
                value: "$saleAmount",
                productCode: 1,
                productPrice: 1,
              },
            },
          ]),
          DistributorLiquidationEntries.aggregate([
            { $match: { distributorCode } },
            { $unwind: "$productEntries" },
            ...(productCode
              ? [{ $match: { "productEntries.productCode": productCode.toLowerCase() } }]
              : []),
            {
              $project: {
                _id: 0,
                type: "Liquidation",
                date: { $dateToString: { format: "%d.%m.%Y", date: "$entryDate" } },
                quantity: "$productEntries.soldToFarmer.value",
                value: "$productEntries.soldToFarmer.amount",
                productCode: "$productEntries.productCode",
                productPrice: "$productEntries.productPrice",
              },
            },
          ]),
        ]);

        result = [...stock, ...sales, ...liq].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
      }

      logger.info(
        `✅ getDistributorTransactionSummary → ${result.length} record(s) for ${distributorCode}`
      );
      return result;
    } catch (error: any) {
      logger.error("❌ Error in getDistributorTransactionSummary:", error.message);
      throw error;
    }
  };
  /**
    * Creates a new liquidation entry and updates all related stock levels
    * for DistributorStock (farmer sales) and RetailerStock (retailer sales).
    */
  async addNewLiquidationEntry(data: Partial<IDistributorLiquidationEntries>, user: IUser) {
    // 1. Get product (SKU) master data to enrich entries with correct price/names
    const products = await Product.find({})
      .select('productCode productName sku price category') // Select all fields needed
      .lean();

    // Create a fast lookup map. Key = productCode (SKU), Value = product details
    const productDetailsMap = new Map<string, any>();
    products.forEach(p => {
      if (p.productCode) {
        productDetailsMap.set(p.productCode.toLowerCase(), {
          price: p.price || 0,
          name: p.productName || 'N/A', // This is the SKU Name
          sku: p.sku || 'N/A',         // This is the Unit (e.g., "Kg", "Ltr")
          category: p.category || 'UNCATEGORIZED' // This is the Parent Product
        });
      }
    });

    // 2. Validate input and prepare the main liquidation entry document
    if (!data.productEntries || data.productEntries.length === 0) {
      logger.warn(`User ${user.employeeId} tried to submit a liquidation entry with no products.`);
      throw new Error('No product entries provided');
    }

    const newEntryData: Partial<IDistributorLiquidationEntries> = {
      approvalStatus: 'pending',
      distributorCode: data.distributorCode!,
      enteredBy: user.employeeId!,
      entryDate: data.entryDate || new Date(),
      photoUrls: data.photoUrls || [],
      signatureUrl: data.signatureUrl || '',
      productEntries: [], // Initialize empty, will be populated in the loop
    };

    // 3. Prepare arrays to hold all concurrent database update promises
    const distributorStockUpdates: Promise<any>[] = [];
    const retailerStockUpdates: Promise<any>[] = [];

    // 4. Process each product line item from the payload
    for (const pe of data.productEntries) {
      if (!pe.productCode) {
        logger.warn('Skipping a liquidation entry with no productCode');
        continue;
      }

      // Get SKU details from our master data map
      const productDetails = productDetailsMap.get(pe.productCode.toLowerCase());
      const price = productDetails?.price || 0;

      // Sanitize incoming values (default to 0 if null/undefined)
      const openingStockVal = pe.openingStock?.value || 0;
      const balanceStockVal = pe.balanceStock?.value || 0;
      const soldToFarmerVal = pe.soldToFarmer?.value || 0;
      const soldToRetailerVal = pe.soldToRetailer?.value || 0;

      // --- FIX 2a: Populate the main entry's product list ---
      const entryProduct = {
        productCode: pe.productCode!,
        productPrice: price,
        openingStock: { value: openingStockVal, amount: openingStockVal * price },
        balanceStock: { value: balanceStockVal, amount: balanceStockVal * price },
        soldToFarmer: { value: soldToFarmerVal, amount: soldToFarmerVal * price },
        soldToRetailer: { value: soldToRetailerVal, amount: soldToRetailerVal * price },
        retailerDetails: pe.retailerDetails || undefined,
      };
      newEntryData.productEntries!.push(entryProduct);


      // --- FIX 2c: Prepare DistributorStock update (for farmer sales) ---
      distributorStockUpdates.push(
        DistributorStock.findOneAndUpdate(
          {
            distributorCode: data.distributorCode!,
            productCode: pe.productCode!, // productCode from payload is the SKU
          },
          {
            $set: { // Set the new balance
              'balanceStock.value': balanceStockVal,
              'balanceStock.amount': balanceStockVal * price,
            },
            $inc: { // Increment liquidation by the amount *just sold*
              'liquidationStock.value': soldToFarmerVal, // <-- This is the fix
              'liquidationStock.amount': soldToFarmerVal * price, // <-- This is the fix
            },
          },
          { upsert: true, new: true } // Create if it doesn't exist
        )
      );

      // --- FIX 2b: Prepare RetailerStock update (for retailer sales) ---
      const retailerId = pe.retailerDetails?.retailerId;
      if (retailerId && soldToRetailerVal > 0) {
        let retailerObjectId: Types.ObjectId;

        // Add robustness: check for valid Mongo ID format
        try {
          retailerObjectId = new Types.ObjectId(retailerId);
        } catch (idError) {
          logger.warn(`Invalid retailerId format: "${retailerId}" for product ${pe.productCode}. Skipping retailer update.`);
          continue; // Skip this update, move to next product
        }

        retailerStockUpdates.push(
          RetailerStock.findOneAndUpdate(
            {
              // --- FIX: Query must match the unique index ---
              retailer: retailerObjectId,
              distributorCode: data.distributorCode!,
              skuCode: pe.productCode!,
            },
            {
              $setOnInsert: {
                // --- FIX: Populate all required fields on create ---
                productCode: productDetails?.category || 'UNCATEGORIZED', // Parent Product Code
                productName: productDetails?.category || 'Uncategorized', // Parent Product Name
                skuCode: pe.productCode!,
                skuName: productDetails?.name || 'N/A', // SKU Name
                unit: productDetails?.sku || 'N/A',     // SKU Unit
                unitValue: price,
                updatedBy: user.employeeId,
              },
              $inc: { // Increment stock
                currentStock: soldToRetailerVal,
                totalReceived: soldToRetailerVal,
              },
              $set: { // Update last received info
                lastReceivedQuantity: soldToRetailerVal,
                lastReceivedDate: new Date(),
              },
            },
            { upsert: true, new: true }
          )
        );
      }
    } // --- End of loop ---

    // 5. Execute all database operations

    // First, create the main entry
    const newEntry = await DistributorLiquidationEntries.create(newEntryData);

    // Now, run all the stock updates in parallel
    await Promise.all([
      ...distributorStockUpdates,
      ...retailerStockUpdates,
    ]);

    logger.info(`Successfully created liquidation entry ${newEntry._id} and processed ${distributorStockUpdates.length} distributor stock and ${retailerStockUpdates.length} retailer stock updates.`);

    return newEntry;
  }

}
const liquidationService = new LiquidationService();
export default liquidationService;