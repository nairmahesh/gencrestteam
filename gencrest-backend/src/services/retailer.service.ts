import { PipelineStage } from 'mongoose';
import { logger } from '../utils/logger';
import { IRetailer, Retailer } from './../models/retailer.model';
import { v4 as uuidv4 } from 'uuid';
import { IUser } from '../models/user.model';
import { RetailerVerification } from '../models/retailerVerification.model';
import { StockRectificationRequest } from '../models/stockRectificationRequest.model';
import { uploadFileToS3 } from './s3.service';
import { Types } from 'mongoose';
import { RetailerStock } from '../models/retailerStock.model';

// Helper function to generate the next Retailer ID
async function getNextRetailerId(): Promise<string> {
  const lastRetailer = await Retailer.findOne().sort({ retailerId: -1 }).select('retailerId').lean();
  if (lastRetailer && lastRetailer.retailerId) {
    const lastNum = parseInt(lastRetailer.retailerId.replace('RET', ''), 10);
    return `RET${(lastNum + 1).toString().padStart(3, '0')}`;
  }
  return 'RET001';
}
interface ISkuVerificationPayload {
  productCode: string;
  skuCode: string;
  skuName: string;
  expectedStock: number;
  actualStock: number;
  variance: number;
}

interface IVerificationPayload {
  retailerId: string; // This is the MongoDB _id
  verificationDate: string;
  proofType: 'Photo' | 'E-Signature' | 'Photo + E-Signature';
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  skusChecked: ISkuVerificationPayload[];
}
class RetailerService {


  /**
     * Submits a new stock verification, updates stock levels, and logs the event.
     */
  async submitStockVerification(
    user: IUser,
    payload: IVerificationPayload,
    files: {
      photos: Express.Multer.File[],
      signature?: Express.Multer.File[]
    }
  ): Promise<any> {
    try {
      // 1. --- Handle File Uploads in Parallel ---
      let photoUrls: string[] = [];
      let signatureUrl: string | undefined = undefined;

      const uploadPromises: Promise<any>[] = [];

      // Upload photos
      if (files.photos && files.photos.length > 0) {
        files.photos.forEach(file => {
          const fileName = `retailer-verification/photos/${user.employeeId}/${Date.now()}-${file.originalname}`;
          uploadPromises.push(
            uploadFileToS3(file.buffer, fileName, file.mimetype)
              .then(data => photoUrls.push(data.fileUrl))
          );
        });
      }

      // Upload signature
      if (files.signature && files.signature.length > 0) {
        const sigFile = files.signature[0];
        const fileName = `retailer-verification/signatures/${user.employeeId}/${Date.now()}-${sigFile.originalname}`;
        uploadPromises.push(
          uploadFileToS3(sigFile.buffer, fileName, sigFile.mimetype)
            .then(data => (signatureUrl = data.fileUrl))
        );
      }

      await Promise.all(uploadPromises);

      // 2. --- Update Stock Levels in Parallel ---
      const stockUpdatePromises = payload.skusChecked.map(sku => {
        // We only update stock if the actual value is different from the expected
        if (sku.actualStock !== sku.expectedStock) {
          logger.info(`Updating stock for retailer ${payload.retailerId}, SKU ${sku.skuCode}: ${sku.expectedStock} -> ${sku.actualStock}`);

          // A negative variance (-50) means 50 *more* were sold/liquidated
          const soldIncrement = sku.variance * -1;

          return RetailerStock.findOneAndUpdate(
            {
              retailer: new Types.ObjectId(payload.retailerId),
              skuCode: sku.skuCode
            },
            {
              $set: {
                currentStock: sku.actualStock,
                updatedBy: user.employeeId,
                lastReceivedDate: new Date(), // We update the "last touched" date
              },
              $inc: {
                totalSold: soldIncrement
              }
            }
          );
        }
        return Promise.resolve(null); // No update needed
      });

      await Promise.all(stockUpdatePromises);

      // 3. --- Create Verification Log (references the log model from Step 3) ---
      const verificationLog = await RetailerVerification.create({
        retailer: new Types.ObjectId(payload.retailerId),
        verifiedBy: user._id,
        verificationDate: new Date(payload.verificationDate),
        skusChecked: payload.skusChecked, // Store the full SKU list
        totalSkusCount: payload.skusChecked.length,
        proofType: payload.proofType,
        proofUrls: photoUrls,
        signatureUrl: signatureUrl,
        notes: payload.notes,
        location: payload.location ? {
          type: 'Point',
          coordinates: [payload.location.longitude, payload.location.latitude]
        } : undefined,
      });

      logger.info(
        `New stock verification [${verificationLog._id}] created by ${user.employeeId} for retailer ${payload.retailerId}`
      );

      return {
        message: 'Stock verification submitted successfully',
        verificationId: verificationLog._id,
      };
    } catch (error) {
      logger.error(error, 'Error in submitStockVerification');
      throw error;
    }
  }

  private getUserScopeFilter(user: IUser): Record<string, any> {
    const filters: Record<string, any> = {};
    if (user.role === 'MDO' || user.role === 'TSM') {
      filters['territory'] = user.territory;
    } else if (user.role === 'RBH') {
      filters['region'] = user.region;
    } else if (user.role === 'ZBH') {
      filters['zone'] = user.zone;
    }
    return filters;
  }

  private calculateMetrics(retailers: any[]) {
    return retailers.map(retailer => {
      const metrics = retailer.inventory.reduce((acc: { totalAllocated: { volume: any; value: number; }; liquidation: { volume: any; value: number; }; balanceStock: { volume: any; value: number; }; }, item: { unitValue: number; totalReceived: any; totalSold: any; currentStock: any; }) => {
        const unitValue = item.unitValue || 0;
        acc.totalAllocated.volume += item.totalReceived || 0;
        acc.liquidation.volume += item.totalSold || 0;
        acc.balanceStock.volume += item.currentStock || 0;
        acc.totalAllocated.value += (item.totalReceived || 0) * unitValue;
        acc.liquidation.value += (item.totalSold || 0) * unitValue;
        acc.balanceStock.value += (item.currentStock || 0) * unitValue;
        return acc;
      }, {
        totalAllocated: { volume: 0, value: 0 },
        liquidation: { volume: 0, value: 0 },
        balanceStock: { volume: 0, value: 0 },
      });

      metrics.openingStock = {
        volume: metrics.totalAllocated.volume - metrics.liquidation.volume - metrics.balanceStock.volume,
        value: metrics.totalAllocated.value - metrics.liquidation.value - metrics.balanceStock.value,
      };

      const totalAvailable = metrics.openingStock.volume + metrics.totalAllocated.volume;
      metrics.liquidationPercentage = totalAvailable > 0
        ? Math.round((metrics.liquidation.volume / totalAvailable) * 100)
        : 0;

      const lastUpdated = retailer.inventory.reduce((latest: number, item: { updatedAt: number; }) =>
        item.updatedAt > latest ? item.updatedAt : latest, retailer.updatedAt);

      return {
        id: retailer._id,
        retailerId: retailer.retailerId,
        retailerName: retailer.name,
        retailerLocation: retailer.city || retailer.market,
        linkedDistributors: retailer.distributorCount,
        status: retailer.status,
        priority: retailer.priority,
        updated: lastUpdated,
        latitude: retailer?.location?.coordinates?retailer?.location?.coordinates[1] : null,
        longitude: retailer?.location?.coordinates?retailer?.location?.coordinates[0] : null,
        metrics,
        inventory: retailer.inventory.map((inv: { _id: any; productCode: any; productName: any; skuCode: any; skuName: any; currentStock: any; unit: any; lastReceivedDate: any; lastReceivedQuantity: any; totalReceived: any; totalSold: any; }) => ({
          id: inv._id,
          productCode: inv.productCode,
          productName: inv.productName,
          skuCode: inv.skuCode,
          skuName: inv.skuName,
          currentStock: inv.currentStock,
          unit: inv.unit,
          lastReceivedDate: inv.lastReceivedDate,
          lastReceivedQuantity: inv.lastReceivedQuantity,
          totalReceived: inv.totalReceived,
          totalSold: inv.totalSold,
        })),
      };
    });
  }

  async getRetailerVerificationSummary(
    user: IUser, page: number, limit: number, search = '', status = '', priority = ''
  ): Promise<any> {
    try {
      const skip = (page - 1) * limit;
      const baseFilters = this.getUserScopeFilter(user);

      if (search) {
        const searchRegex = new RegExp(search, 'i');
        baseFilters['$or'] = [
          { name: searchRegex }, { retailerId: searchRegex }, { phone: searchRegex }
        ];
      }
      if (status) baseFilters['status'] = status;
      if (priority) baseFilters['priority'] = priority;

      const pipeline: PipelineStage[] = [
        { $match: baseFilters },
        { $lookup: { from: 'retailerstocks', localField: '_id', foreignField: 'retailer', as: 'inventory' } },
        { $addFields: { distributorCount: { $size: { $setUnion: "$inventory.distributorCode" } } } },
        { $sort: { priority: 1, name: 1 } },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: 'count' }]
          }
        }
      ];

      const [result] = await Retailer.aggregate(pipeline);
      const paginatedData = result.data || [];
      const totalCount = result.totalCount[0]?.count || 0;

      if (totalCount === 0) {
        return { data: [], overallMetrics: { openingStock: { volume: 0, value: 0 }, totalAllocated: { volume: 0, value: 0 }, liquidation: { volume: 0, value: 0 }, balanceStock: { volume: 0, value: 0 }, liquidationPercentage: 0, totalRetailers: 0 }, pagination: { currentPage: page, totalPages: 0, pageSize: limit, totalCount: 0 } };
      }

      const dataWithMetrics = this.calculateMetrics(paginatedData);

      const overallMetricsPipeline: PipelineStage[] = [
        { $match: baseFilters },
        { $lookup: { from: 'retailerstocks', localField: '_id', foreignField: 'retailer', as: 'inventory' } },
        { $unwind: '$inventory' },
        {
          $group: {
            _id: null,
            totalRetailers: { $addToSet: '$_id' },
            totalAllocatedVolume: { $sum: '$inventory.totalReceived' },
            totalAllocatedValue: { $sum: { $multiply: ['$inventory.totalReceived', '$inventory.unitValue'] } },
            totalLiquidationVolume: { $sum: '$inventory.totalSold' },
            totalLiquidationValue: { $sum: { $multiply: ['$inventory.totalSold', '$inventory.unitValue'] } },
            totalBalanceVolume: { $sum: '$inventory.currentStock' },
            totalBalanceValue: { $sum: { $multiply: ['$inventory.currentStock', '$inventory.unitValue'] } },
          }
        },
        {
          $project: {
            _id: 0,
            totalRetailers: { $size: '$totalRetailers' },
            totalAllocated: { volume: '$totalAllocatedVolume', value: '$totalAllocatedValue' },
            liquidation: { volume: '$totalLiquidationVolume', value: '$totalLiquidationValue' },
            balanceStock: { volume: '$totalBalanceVolume', value: '$totalBalanceValue' },
          }
        }
      ];

      const [overallMetricsResult] = await Retailer.aggregate(overallMetricsPipeline);
      let metrics = overallMetricsResult || { totalRetailers: 0, totalAllocated: { volume: 0, value: 0 }, liquidation: { volume: 0, value: 0 }, balanceStock: { volume: 0, value: 0 } };

      metrics.openingStock = {
        volume: metrics.totalAllocated.volume - metrics.liquidation.volume - metrics.balanceStock.volume,
        value: metrics.totalAllocated.value - metrics.liquidation.value - metrics.balanceStock.value,
      };
      const totalAvailable = metrics.openingStock.volume + metrics.totalAllocated.volume;
      metrics.liquidationPercentage = totalAvailable > 0 ? Math.round((metrics.liquidation.volume / totalAvailable) * 100) : 0;

      return {
        data: dataWithMetrics,
        overallMetrics: metrics,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          pageSize: limit,
          totalCount: totalCount,
        },
      };
    } catch (error) {
      logger.error(error, 'Error in getRetailerVerificationSummary');
      throw error;
    }
  }
  async getRetailerVerificationHistory(retailerId: string): Promise<any[]> {
    try {
      const history = await RetailerVerification.find({ retailer: retailerId })
        .populate('verifiedBy', 'firstName lastName role') // Populate user details
        .sort({ verificationDate: -1 })
        .limit(20)
        .lean();

      return history.map((item: { verifiedBy: any; _id: any; verificationDate: any; skusChecked: any[]; totalSkusCount: any; proofType: any; }) => {
        const verifiedBy = item.verifiedBy as any; // Type assertion after populate
        return {
          id: item._id,
          verificationDate: item.verificationDate,
          skusChecked: item.skusChecked.map((sku: { skuName: any; skuCode: any; }) => ({
            skuName: sku.skuName,
            skuCode: sku.skuCode,
          })),
          totalSkusCount: item.totalSkusCount,
          verifiedByName: verifiedBy ? `${verifiedBy.firstName} ${verifiedBy.lastName}` : 'System',
          verifiedByRole: verifiedBy ? verifiedBy.role : 'N/A',
          proofType: item.proofType,
          // We can add a consolidated proof URL if needed
          // proofUrl: item.signatureUrl || (item.proofUrls && item.proofUrls[0]), 
        };
      });
    } catch (error) {
      logger.error(error, 'Error in getRetailerVerificationHistory');
      throw error;
    }
  }

  /**
   * Submits a new stock rectification request for approval.
   */
  async submitStockRectification(
    user: IUser,
    payload: {
      retailerId: string; // This is the human-readable retailerId ("RET001")
      skuCode: string;
      productName: string;
      skuName: string;
      unit: string;
      currentStockUnits: number;
      adjustmentType: 'increase' | 'decrease';
      adjustmentUnits: number;
      reason: string;
      notes?: string;
    }
  ): Promise<any> {
    try {
      // Find the retailer by their custom ID to get the MongoDB _id
      const retailer = await Retailer.findOne({ retailerId: payload.retailerId }).select('_id').lean();
      if (!retailer) {
        throw new Error('Retailer not found');
      }

      const newStockUnits = payload.adjustmentType === 'increase'
        ? payload.currentStockUnits + payload.adjustmentUnits
        : payload.currentStockUnits - payload.adjustmentUnits;

      const request = await StockRectificationRequest.create({
        retailer: retailer._id,
        requestedBy: user._id,
        productName: payload.productName,
        skuCode: payload.skuCode,
        skuName: payload.skuName,
        unit: payload.unit,
        currentStockUnits: payload.currentStockUnits,
        adjustmentType: payload.adjustmentType,
        adjustmentUnits: payload.adjustmentUnits,
        newStockUnits: newStockUnits,
        reason: payload.reason,
        notes: payload.notes,
        status: 'pending',
      });

      // Note: We do NOT update the RetailerStock model here.
      // That only happens after an admin *approves* this request.

      logger.info(
        `New stock rectification request [${request._id}] created by ${user.employeeId} for retailer ${payload.retailerId}`
      );

      return {
        message: 'Rectification request submitted successfully',
        requestId: request._id,
      };
    } catch (error) {
      logger.error(error, 'Error in submitStockRectification');
      throw error;
    }
  }

  /**
   * [UPDATED] Creates a new Retailer with duplicate checks.
   */
  async createRetailer(
    user: IUser,
    payload: {
      name: string;
      outletName?: string;
      phone: string;
      address: string;
      pincode: string;
      market: string;
      city: string;
      state: string;
    }
  ): Promise<IRetailer> {
    try {
      // --- DUPLICATE CHECK (Fix for Image 10) ---
      const existingByPhone = await Retailer.findOne({$and:[{phone: payload.phone },{city: payload.city}] }).lean();
      if (existingByPhone) {
        throw new Error(`A retailer already exists with this phone number: ${payload.phone}`);
      }
      
      const existingByNameCity = await Retailer.findOne({ 
        name: payload.name, 
        city: payload.city 
      }).lean();
      if (existingByNameCity) {
        throw new Error(`A retailer with this name already exists in ${payload.city}.`);
      }
      // --- END DUPLICATE CHECK ---

      const nextId = await getNextRetailerId();
      
      const newRetailer = await Retailer.create({
        ...payload,
        retailerId: nextId,
        businessName: payload.outletName || payload.name,
        contactPerson: payload.name, // Set contactPerson
        territory: user.territory,
        region: user.region,
        zone: user.zone,
        status: 'Active',
        priority: 'Medium',
        createdBy: user._id,
        assignedMDO: user._id,
      });

      logger.info(`New retailer [${newRetailer.retailerId}] created by ${user.employeeId}`);
      return newRetailer;
    } catch (error) {
      logger.error(error, 'Error in createRetailer');
      // Pass MongoDB unique error (E11000) to frontend
      if ((error as any).code === 11000) {
        throw new Error(`A retailer already exists with this phone number.`);
      }
      throw error; // Re-throw other errors
    }
  }

  /**
   * [UPDATED] Searches for retailers and returns data for dropdown.
   */
  async searchRetailers(user: IUser, query: string): Promise<any[]> {
    try {
      const userScope = this.getUserScopeFilter(user);
      const searchRegex = new RegExp(query, 'i');
      
      const retailers = await Retailer.find({
        ...userScope,
        $or: [
          { name: searchRegex },
          { retailerId: searchRegex },
          { phone: searchRegex },
          { businessName: searchRegex }
        ]
      })
      .lean();
      
      return retailers
    } catch (error) {
      logger.error(error, 'Error in searchRetailers');
      throw error;
    }
  }
}

const retailerService = new RetailerService();
export default retailerService;