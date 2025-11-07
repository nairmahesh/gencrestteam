import { User, IUser } from '../models/user.model';
import { logger } from '../utils/logger';
import * as xlsx from 'xlsx';
import bcrypt from 'bcryptjs';
import { IProduct, Product } from '../models/product.model';
import { Distributor, IDistributor } from '../models/distributor.model';
import { DistributorLiquidationEntries } from '../models/distributorLiquidation.Entriesmodel';
import { DistributorStock } from '../models/distributorStock.model';
import { DistributorSales } from '../models/distributorSales.model';

interface UploadSummary {
  totalRows: number;
  created: number;
  updated: number;
  errors: string[];
}

const LQU_REQUIRED_COLUMNS = [
  'distributorCode',
  'productCode',
  'updatedBy',
  'openingStock',
  'sales_april',
  'sales_may',
  'sales_june',
  'sales_july',
  'sales_august',
  'sales_september',
  'liquidation_april',
  'liquidation_may',
  'liquidation_june',
  'liquidation_july',
  'liquidation_august',
  'liquidation_september',
  'ytdNetSales',
  'closingBalance'
];
interface ProductCache {
  price: number;
  name: string;
  sku: string;
}

// Map Excel column names → internal user model fields
const USER_COLUMN_MAP = {
  code: 'employeeId',
  name: '__employeeName', // temporary internal key (split later)
  joiningDate: 'dateOfJoining',
  role: 'role',
  email: 'email',
  phone: 'phone',
  reportingTo: 'reportingToEmployeeId',
  location: 'location',
  territory: 'territory',
  region: 'region',
  state: 'state',
  zone: 'zone',
  status: 'isActive',
} as const;

type UserColumnMapKeys = keyof typeof USER_COLUMN_MAP;
type UserExcelRow = Record<UserColumnMapKeys, string | number | boolean | undefined>;

// Utility: sanitize normal text fields
const sanitizeText = (value: string): string =>
  value.replace(/[^a-zA-Z0-9\s.\-]/g, '').trim().toLowerCase();

// Utility: sanitize email (keep @ and .)
const sanitizeEmail = (value: string): string =>
  value.replace(/[^a-zA-Z0-9@._\-]/g, '').trim().toLowerCase();

// Utility: sanitize phone (keep digits and +)
const sanitizePhone = (value: string): string =>
  value.replace(/[^\d+]/g, '').trim();
const generateTempCode = (name: string, sku: string): string => {
  return `temp_${name}_${sku}`.replace(/\s+/g, '').toLowerCase();
};
const toNumber = (val: any): number => {
  const n = parseFloat(String(val).replace(/,/g, '').trim());
  return isNaN(n) ? 0 : n;
};
const parseBoolean = (val: any): boolean => {
  if (typeof val === 'boolean') return val;
  const str = String(val).toLowerCase();
  return ['true', '1', 'yes', 'active'].includes(str);
};
const sanitizeNumber = (val: string | number): string =>
  String(val).replace(/[^\d]/g, '').trim();

const parseDate = (val: any): Date => {
  const date = new Date(val);
  return isNaN(date.getTime()) ? new Date() : date;
};

class AdminService {
  public async parseAndBulkUploadUsers(file: Express.Multer.File): Promise<UploadSummary> {
    logger.info('Starting user bulk upload...');

    const summary: UploadSummary = {
      totalRows: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    try {
      // Parse Excel buffer
      const workbook = xlsx.read(file.buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json<UserExcelRow>(sheet);

      summary.totalRows = rows.length;
      const operations: any[] = [];

      for (const [index, row] of rows.entries()) {
        const rowNum = index + 2;
        const user: Partial<IUser> & { __employeeName?: string } = {};

        // Map Excel columns → internal user fields
        (Object.entries(USER_COLUMN_MAP) as [UserColumnMapKeys, string][]).forEach(([excelCol, modelField]) => {
          let value = row[excelCol];
          if (value !== undefined && value !== null && value !== '') {
            if (typeof value === 'string') {
              if (modelField === 'email') value = sanitizeEmail(value);
              else if (modelField === 'phone') value = sanitizePhone(value);
              else value = sanitizeText(value);
            }
            (user as any)[modelField] = value;
          }
        });

        // Split full name into firstName and lastName
        if (user.__employeeName) {
          const parts = user.__employeeName.trim().split(/\s+/);
          user.firstName = sanitizeText(parts[0] || '');
          user.lastName = sanitizeText(parts.slice(1).join(' ') || '');
          delete user.__employeeName;
        }

        // Clean employeeId (remove dashes/spaces)
        if (user.employeeId) {
          user.employeeId = sanitizeText(String(user.employeeId)).replace(/-/g, '');
        }

        // Convert status to boolean
        if (user.isActive && typeof user.isActive === 'string') {
          const val = (user.isActive as string).toLowerCase();
          user.isActive = val === 'active' || val === 'true' || val === '1';
        } else if (!user.isActive) {
          user.isActive = true; // default to true if missing
        }

        // Parse dateOfJoining
        if (user.dateOfJoining && typeof user.dateOfJoining === 'string') {
          const parsed = new Date(user.dateOfJoining);
          if (!isNaN(parsed.getTime())) {
            user.dateOfJoining = parsed;
          }
        }
        if (!user.employeeId) {
          user.employeeId = `temp_${user.firstName}_${user.lastName}_${Math.floor(Math.random() * 1000)}`;
        }
        // Validate essentials
        if (!user.employeeId || !user.role || !user.firstName) {
          summary.errors.push(`Row ${rowNum}: Missing required field (employeeId, role, or name)`);
          continue;
        }

        // Hash employeeId as password
        const hashedPassword = await bcrypt.hash(String(user.employeeId), 10);

        // Bulk upsert
        operations.push({
          updateOne: {
            filter: { employeeId: user.employeeId },
            update: {
              $set: user,
              $setOnInsert: {
                password: hashedPassword,
                isPasswordSet: false,
              },
            },
            upsert: true,
          },
        });
      }

      // Run all DB operations
      if (operations.length > 0) {
        const result = await User.bulkWrite(operations);
        summary.created = result.upsertedCount;
        summary.updated = result.modifiedCount;
      }

      logger.info(summary, 'User bulk upload complete');
      return summary;
    } catch (error: any) {
      logger.error({ err: error }, 'Failed during user bulk upload');
      summary.errors.push(`Unexpected error: ${error.message}`);
      return summary;
    }
  }

  public async parseAndBulkUploadProducts(file: Express.Multer.File): Promise<UploadSummary> {
    logger.info('Starting product bulk upload...');
    const summary: UploadSummary = {
      totalRows: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    try {
      // Parse Excel buffer
      const workbook = xlsx.read(file.buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet);

      summary.totalRows = rows.length;
      const operations: any[] = [];

      for (const [index, row] of rows.entries()) {
        const rowNum = index + 2;
        const product: Partial<IProduct> = {};

        const name = sanitizeText(String(row['name'] || ''));
        const sku = sanitizeText(String(row['sku'] || ''));
        const category = sanitizeText(String(row['category'] || ''));
        const price = String(row['price'] || '').trim();
        const productCode = row['productCode']
          ? sanitizeText(String(row['productCode']))
          : generateTempCode(name, sku);

        if (!name || !sku || !category) {
          summary.errors.push(`Row ${rowNum}: Missing required fields (name, sku, or category)`);
          continue;
        }

        product.productCode = productCode;
        product.productName = name;
        product.sku = sku;
        product.price = Number(price ?? '0');
        product.category = category;

        operations.push({
          updateOne: {
            filter: { productCode },
            update: { $set: product },
            upsert: true,
          },
        });
      }

      if (operations.length > 0) {
        const result = await Product.bulkWrite(operations);
        summary.created = result.upsertedCount;
        summary.updated = result.modifiedCount;
      }

      logger.info(summary, 'Product bulk upload complete');
      return summary;
    } catch (error: any) {
      logger.error({ err: error }, 'Failed during product bulk upload');
      summary.errors.push(`Unexpected error: ${error.message}`);
      return summary;
    }
  }

  public async parseAndBulkUploadDistributors(file: Express.Multer.File): Promise<UploadSummary> {
    logger.info('Starting distributor bulk upload...');

    const summary: UploadSummary = {
      totalRows: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    try {
      // Read Excel
      const workbook = xlsx.read(file.buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet);

      summary.totalRows = rows.length;
      const operations: any[] = [];

      for (const [index, row] of rows.entries()) {
        const rowNum = index + 2;
        try {
          const distributor: Partial<IDistributor> = {
            distributorCode: sanitizeText(String(row['distributorCode'] ?? '')),
            dateCreated: parseDate(row['dateCreated']),
            isActive: parseBoolean(row['isActive']),
            name: sanitizeText(String(row['name'] ?? '')),
            companyName: sanitizeText(String(row['companyName'] ?? '')),
            category: sanitizeText(String(row['category'] ?? '')),
            vertical: sanitizeText(String(row['vertical'] ?? '')),
            territory: sanitizeText(String(row['territory'] ?? '')),
            city: sanitizeText(String(row['city'] ?? '')),
            region: sanitizeText(String(row['region'] ?? '')),
            zone: sanitizeText(String(row['zone'] ?? '')),
            state: sanitizeText(String(row['state'] ?? '')),
            address: sanitizeText(String(row['address'] ?? '')),
            pincode: sanitizeNumber(row['pincode'] ?? ''),
          };

          // Validate required fields
          const required = [
            'distributorCode', 'name', 'companyName', 'category', 'vertical',
            'territory', 'city', 'region', 'zone', 'state', 'address', 'pincode'
          ];

          const missing = required.filter(f => !(distributor as any)[f]);
          if (missing.length > 0) {
            summary.errors.push(`Row ${rowNum}: Missing required fields: ${missing.join(', ')}`);
            continue;
          }

          // Upsert operation
          operations.push({
            updateOne: {
              filter: { distributorCode: distributor.distributorCode },
              update: { $set: distributor },
              upsert: true,
            },
          });
        } catch (innerErr: any) {
          summary.errors.push(`Row ${rowNum}: ${innerErr.message}`);
        }
      }

      if (operations.length > 0) {
        const result = await Distributor.bulkWrite(operations);
        summary.created = result.upsertedCount;
        summary.updated = result.modifiedCount;
      }

      logger.info(summary, 'Distributor bulk upload complete');
      return summary;
    } catch (error: any) {
      logger.error({ err: error }, 'Failed during distributor bulk upload');
      summary.errors.push(`Unexpected error: ${error.message}`);
      return summary;
    }
  }


  private readonly BATCH_SIZE = 500;
  private readonly MONTHS = ["april", "may", "june", "july", "august", "september"];
  private readonly MONTH_INDICES: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4,
    june: 5, july: 6, august: 7, september: 8, october: 9,
    november: 10, december: 11,
  };
  private readonly YEAR = new Date().getFullYear();

  /**
   * Helper to safely parse numbers from Excel.
   */
  private toNumber(val: any): number {
    const n = parseFloat(String(val ?? "").replace(/,/g, "").trim());
    return isNaN(n) ? 0 : n;
  }

  /**
   * Loads all products into a fast-lookup map.
   */
  private async loadProductCache(): Promise<Map<string, ProductCache>> {
    logger.info("📦 Loading product master...");
    const productMap = new Map<string, ProductCache>();

    // **Optimization**: Only select fields you actually need
    const products = await Product.find({})
      .select("productCode price productName sku")
      .lean();

    for (const p of products) {
      const code = p.productCode?.toLowerCase();
      if (!code) continue;
      productMap.set(code, {
        price: p.price || 0,
        name: p.productName || "",
        sku: p.sku || "",
      });
    }
    logger.info(`✅ Loaded ${productMap.size} product records.`);
    return productMap;
  }

  /**
   * Parses and bulk-uploads liquidation entries from an Excel file.
   */
public async parseAndBulkUploadLiquidationEntries(
  file: Express.Multer.File,
): Promise<UploadSummary> {
  const summary: UploadSummary = {
    totalRows: 0,
    created: 0,
    updated: 0,
    errors: [],
  };

  try {
    logger.info("🚀 Starting Distributor Liquidation bulk upload...");

    // === 1. Load Product Cache ===
    const productMap = await this.loadProductCache();
    logger.info(`📦 Loaded ${productMap.size} product records into cache`);

    // === 2. Parse Excel & Normalize Columns ===
    const workbook = xlsx.read(file.buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawRows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
    if (rawRows.length === 0) throw new Error("Excel sheet is empty.");

    // Normalize all column headers (trim, lowercase, replace spaces with underscores)
    const rows = rawRows.map((obj) => {
      const normalized: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        const cleanKey = key.trim().toLowerCase().replace(/\s+/g, "_");
        normalized[cleanKey] = val;
      }
      return normalized;
    });

    summary.totalRows = rows.length;
    logger.info(`📘 Parsed ${rows.length} rows from "${sheetName}"`);

    // === 3. Setup Buffers & Helpers ===
    const stockMap = new Map<string, any>();
    const salesBatch: any[] = [];
    const liqBatch: any[] = [];
    const BATCH_SIZE = 4000;
    let batchCount = 0;

    const toNumber = (val: any): number => {
      const n = parseFloat(String(val ?? "").replace(/,/g, "").trim());
      return isNaN(n) ? 0 : n;
    };

    const flushBatch = async (isFinal = false) => {
      if ( !salesBatch.length && !liqBatch.length) return;

      batchCount++;
      logger.info(`🧾 Flushing batch ${batchCount}${isFinal ? " (final)" : ""}...`);

      // const stockBatch = Array.from(stockMap.values());
      const results = await Promise.allSettled([
        // stockBatch.length ? DistributorStock.insertMany(stockBatch, { ordered: false }) : null,
        salesBatch.length ? DistributorSales.insertMany(salesBatch, { ordered: false }) : null,
        liqBatch.length ? DistributorLiquidationEntries.insertMany(liqBatch, { ordered: false }) : null,
      ]);

      const [salesRes, liqRes] = results;

      // if (stockRes.status === "fulfilled" && stockRes.value)
      //   logger.info(`✅ Inserted ${stockRes.value.length} DistributorStock records`);
      if (salesRes.status === "fulfilled" && salesRes.value)
        logger.info(`💰 Inserted ${salesRes.value.length} DistributorSales records`);
      if (liqRes.status === "fulfilled" && liqRes.value)
        logger.info(`🧾 Inserted ${liqRes.value.length} DistributorLiquidationEntries records`);

      summary.created +=
        // (stockRes.status === "fulfilled" ? stockRes.value?.length||0 : 0) +
        (salesRes.status === "fulfilled" ? salesRes.value?.length||0 : 0) +
        (liqRes.status === "fulfilled" ? liqRes.value?.length||0 : 0);

      // Clear batches
      stockMap.clear();
      salesBatch.length = 0;
      liqBatch.length = 0;
    };

    // === 4. Process Each Row ===
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        const distributorCode = String(row["distributorcode"]).trim().toLowerCase();
        const productCode = String(row["productcode"]).trim().toLowerCase();
        const updatedBy = (String(row["updatedby"] || "SYSTEM").trim()).toLowerCase();

        if (!distributorCode || !productCode) {
          summary.errors.push(`Row ${rowNum}: Missing distributorCode or productCode`);
          continue;
        }

        const product = productMap.get(productCode);
        // if (!product) {
        //   summary.errors.push(`Row ${rowNum}: Product "${productCode}" not found in master`);
        //   continue;
        // }

        const price = product?.price||0;
        const openingStock = toNumber(row["openingstock"]);
        const closingBalance = toNumber(row["closingbalance"]);
        const liquidationStock = toNumber(row["liquidationstock"]);
        // const ytdNetSales = toNumber(row["ytdnetsales"]);

        // === Merge Stock Data (One per distributor+product) ===
        const key = `${distributorCode}|${productCode}`;
        const existing = stockMap.get(key);
        // if (existing) {
        //   existing.openingStock.value += openingStock;
        //   existing.openingStock.amount += openingStock * price;
        //   existing.balanceStock.value += closingBalance;
        //   existing.balanceStock.amount += closingBalance * price;
        //   existing.liquidationStock.value += liquidationStock;
        //   existing.liquidationStock.amount += liquidationStock * price;
        //   existing.ytdNetSales.value += ytdNetSales;
        //   existing.ytdNetSales.amount += ytdNetSales * price;
        // } else {
        //   stockMap.set(key, {
        //     distributorCode,
        //     productCode,
        //     productPrice: price,
        //     openingStock: { value: openingStock, amount: openingStock * price },
        //     balanceStock: { value: closingBalance, amount: closingBalance * price },
        //     liquidationStock: { value: liquidationStock, amount: liquidationStock * price },
        //     ytdNetSales: { value: ytdNetSales, amount: ytdNetSales * price },
        //     createdAt: new Date(),
        //     updatedAt: new Date(),
        //   });
        // }

        // === Monthly Sales & Liquidation Entries ===
        let hasLiq = false;
        for (const month of this.MONTHS) {
          const saleQty = toNumber(row[`sales_${month}`]);
          const liqQty = toNumber(row[`liquidation_${month}`]);
          const entryDate = new Date(this.YEAR, this.MONTH_INDICES[month] + 1, 0); // last day of month

          // Add sales record
          if (saleQty != 0) {
            salesBatch.push({
              distributorCode,
              productCode,
              productPrice: price,
              saleQuantity: saleQty,
              saleAmount: saleQty * price,
              invoiceDate: entryDate,
              invoiceNumber: `INV-${distributorCode}-${month.toUpperCase()}-${this.YEAR}`,
            });
          }

          // Add liquidation record
          if (liqQty != 0) {
            hasLiq = true;
            liqBatch.push({
              distributorCode,
              entryDate,
              enteredBy: updatedBy,
              status: 'approved',
              approvedBy:'Admin',
              productEntries: [
                {
                  productCode,
                  productPrice: price,
                  openingStock: { value: openingStock, amount: openingStock * price },
                  balanceStock: { value: closingBalance, amount: closingBalance * price },
                  soldToFarmer: { value: liqQty, amount: liqQty * price },
                  soldToRetailer: { value: 0, amount: 0 },
                },
              ],
              metadata: {
                uploadedBy: updatedBy,
                timestamp: new Date(),
                device: "bulk_upload",
                source: "excel",
              },
            });
          }
        }

        // Fallback if total liquidationStock exists but all months = 0
        if (!hasLiq && liquidationStock > 0) {
          liqBatch.push({
            distributorCode,
            entryDate: new Date(this.YEAR, 8, 30), // September fallback
            enteredBy: updatedBy,
            productEntries: [
              {
                productCode,
                productPrice: price,
                openingStock: { value: openingStock, amount: openingStock * price },
                balanceStock: { value: closingBalance, amount: closingBalance * price },
                soldToFarmer: { value: liquidationStock, amount: liquidationStock * price },
                soldToRetailer: { value: 0, amount: 0 },
              },
            ],
            metadata: {
              uploadedBy: updatedBy,
              timestamp: new Date(),
              device: "bulk_upload",
              source: "excel_fallback",
            },
          });
        }
      } catch (err: any) {
        summary.errors.push(`Row ${rowNum}: ${err.message}`);
        logger.error(err, `❌ Row ${rowNum} failed`);
      }

      // === Flush Every 4000 Rows ===
      if ((i + 1) % BATCH_SIZE === 0) {
        logger.info(`📤 Flushing batch at row ${i + 1}`);
        await flushBatch();
      }
    }

    // === Final Flush ===
    logger.info("⚠️ Flushing remaining uncommitted data...");
    await flushBatch(true);
    logger.info("✅ Distributor liquidation upload completed successfully.");
  } catch (err: any) {
    logger.error(err, "❌ Bulk upload failed");
    summary.errors.push(err.message);
  }
  await this.parseAndBulkUploadDistributorStocks(file);
  return summary;
}

public async parseAndBulkUploadDistributorStocks(
  file: Express.Multer.File,
): Promise<UploadSummary> {
  const summary: UploadSummary = {
    totalRows: 0,
    created: 0,
    updated: 0,
    errors: [],
  };

  try {
    logger.info("🚀 Starting Distributor Stock bulk upload...");

    // === 1. Load Product Cache ===
    const productMap = await this.loadProductCache();
    logger.info(`📦 Loaded ${productMap.size} products into cache`);

    // === 2. Parse Excel and Normalize Headers ===
    const workbook = xlsx.read(file.buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rawRows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
    if (rawRows.length === 0) throw new Error("Excel sheet is empty.");

    const rows = rawRows.map((obj) => {
      const normalized: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        const cleanKey = key.trim().toLowerCase().replace(/\s+/g, "_");
        normalized[cleanKey] = val;
      }
      return normalized;
    });

    summary.totalRows = rows.length;
    logger.info(`📘 Parsed ${rows.length} rows from "${sheetName}"`);

    // === 3. Setup Buffers & Helpers ===
    const stockBatch: any[] = [];
    const BATCH_SIZE = 4000;
    let batchCount = 0;

    const toNumber = (val: any): number => {
      const n = parseFloat(String(val ?? "").replace(/,/g, "").trim());
      return isNaN(n) ? 0 : n;
    };

    // === 4. Define Batch Flusher ===
    const flushBatch = async (isFinal = false) => {
      if (!stockBatch.length) return;

      batchCount++;
      logger.info(`🧾 Flushing batch ${batchCount}${isFinal ? " (final)" : ""} with ${stockBatch.length} records...`);

      try {
        const result = await DistributorStock.insertMany(stockBatch, { ordered: false });
        summary.created += result.length;
        logger.info(`✅ Inserted ${result.length} stock records`);
      } catch (err: any) {
        logger.error(err, "❌ Failed inserting batch");
        summary.errors.push(`Batch ${batchCount}: ${err.message}`);
      }

      stockBatch.length = 0; // clear buffer
    };

    // === 5. Process Each Row ===
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 to account for header row

      try {
        const distributorCode = String(row["distributorcode"]).trim().toLowerCase();
        const productCode = String(row["productcode"]).trim().toLowerCase();

        if (!distributorCode || !productCode) {
          summary.errors.push(`Row ${rowNum}: Missing distributorCode or productCode`);
          continue;
        }

        const product = productMap.get(productCode);
        // if (!product) {
        //   summary.errors.push(`Row ${rowNum}: Product "${productCode}" not found in product master`);
        //   continue;
        // }

        const price = toNumber(product?.price||'0');
        const openingStock = toNumber(row["openingstock"]);
        const liquidationStock = toNumber(row["liquidationstock"]);
        const ytdNetSales = toNumber(row["ytdnetsales"]);
        const closingBalance = toNumber(row["closingbalance"]);
        console.log(`processing row ${rowNum}: ${distributorCode} - ${productCode}: OS=${openingStock}, LS=${liquidationStock}, YTDS=${ytdNetSales}, CB=${closingBalance}`);
        stockBatch.push({
          distributorCode,
          productCode,
          productPrice: price,
          openingStock: { value: openingStock, amount: openingStock * price },
          balanceStock: { value: closingBalance, amount: closingBalance * price },
          liquidationStock: { value: liquidationStock, amount: liquidationStock * price },
          ytdNetSales: { value: ytdNetSales, amount: ytdNetSales * price },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (err: any) {
        summary.errors.push(`Row ${rowNum}: ${err.message}`);
        logger.error(err, `❌ Row ${rowNum} failed`);
      }

      // === Flush Every 4000 Rows ===
      if ((i + 1) % BATCH_SIZE === 0) {
        logger.info(`📤 Flushing batch at row ${i + 1}`);
        await flushBatch();
      }
    }

    // === 6. Final Flush ===
    logger.info("⚠️ Flushing remaining uncommitted records...");
    await flushBatch(true);

    logger.info("✅ Distributor Stock upload completed successfully.");
  } catch (err: any) {
    logger.error(err, "❌ Stock bulk upload failed");
    summary.errors.push(err.message);
  }

  return summary;
}


}

export const adminService = new AdminService();
