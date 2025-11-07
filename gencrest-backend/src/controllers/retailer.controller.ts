import { Request, Response } from "express";
import retailerService from "../services/retailer.service";
import { logger } from "../utils/logger";

class RetailerController {
  async createRetailer(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    // TODO: Add validation
    try {
      const newRetailer = await retailerService.createRetailer(req.user, req.body);
      const retailer=newRetailer.toObject();
      res.status(201).json({...retailer,id: retailer._id});
    } catch (error: any) {
      logger.error(error, 'Create retailer error');
      res.status(500).json({ message: error.message || 'Failed to create retailer' });
    }
  }

  async searchRetailers(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const query = (req.query.q as string) || '';
    if (!query) {
      return res.status(400).json({ message: 'Query parameter "q" is required' });
    }
    try {
      const results = await retailerService.searchRetailers(req.user, query);
      res.status(200).json(results);
    } catch (error: any) {
      logger.error(error, 'Search retailers error');
      res.status(500).json({ message: error.message || 'Failed to search retailers' });
    }
  }
  async getRetailers(req: Request, res: Response) {
    try {
      const retailers = await retailerService.searchRetailers(req.user!, '');
      res.status(200).json(retailers);
    } catch (err) {
      res.status(500).json({ message: 'Internal server error', error: err });
    }
  }
  async getVerificationSummary(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const priority = (req.query.priority as string) || '';

    const data = await retailerService.getRetailerVerificationSummary(
      req.user, page, limit, search, status, priority
    );

    res.status(200).json(data);
  }

  async getVerificationHistory(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { retailerId } = req.params;
    if (!retailerId) {
      return res.status(400).json({ message: 'Retailer ID is required' });
    }

    const data = await retailerService.getRetailerVerificationHistory(retailerId);
    res.status(200).json(data);
  }

  async submitStockRectification(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // TODO: Add validation here (e.g., using Joi)
    const payload = req.body;

    try {
      const result = await retailerService.submitStockRectification(req.user, payload);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to submit rectification request' });
    }
  }
  async submitStockVerification(req: Request, res: Response) {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      // 1. Parse the payload from the 'payload' form field
      const payload = JSON.parse(req.body.payload);
      if (!payload) {
        return res.status(400).json({ message: 'Missing verification payload' });
      }
      
      // 2. Get the files (multer populates req.files)
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const photos = files['files'] || [];
      const signature = files['signature'] || undefined;

      // 3. Call the service
      const result = await retailerService.submitStockVerification(
        req.user,
        payload,
        { photos, signature }
      );
      
      res.status(201).json(result);
    } catch (error: any) {
      logger.error(error, 'Submit verification error');
      res.status(500).json({ message: error.message || 'Failed to submit verification' });
    }
  }

}

const retailerController = new RetailerController();
export default retailerController;