import { Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { logger } from '../utils/logger';

class AdminController {

  public async uploadUserSheet(req: Request, res: Response): Promise<Response> {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    try {
      const summary = await adminService.parseAndBulkUploadUsers(req.file);
      return res.status(200).json(summary);
    } catch (error) {
      logger.error({ err: error }, 'User upload controller error');
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
   public async uploadProductSheet(req: Request, res: Response): Promise<Response> {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    try {
      const summary = await adminService.parseAndBulkUploadProducts(req.file);
      return res.status(200).json(summary);
    } catch (error) {
      logger.error({ err: error }, 'User upload controller error');
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  public async uploadDistributorSheet(req: Request, res: Response): Promise<Response> {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    try {
      const summary = await adminService.parseAndBulkUploadDistributors(req.file);
      return res.status(200).json(summary);
    } catch (error) {
      logger.error({ err: error }, 'Distributor upload controller error');
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  public async uploadDistributorLiquidationEntries(req: Request, res: Response): Promise<Response> {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    try {
      const summary = await adminService.parseAndBulkUploadLiquidationEntries(req.file);
      return res.status(200).json(summary);
    } catch (error) {
      logger.error({ err: error }, 'Distributor Liquidation upload controller error');
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
}

export const adminController = new AdminController();