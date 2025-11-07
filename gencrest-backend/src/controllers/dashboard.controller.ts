import { Request, Response } from "express";
import dashboardService from "../services/dashboard.service";
import { logger } from "../utils/logger";

class DashboardController {
 async getDashboardData(req: Request, res: Response): Promise<Response> {
  try {
   if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
   }
   const filters: Record<string, any> = {};
   if (req.user.role == 'mdo' || req.user.role == 'so' || req.user.role == 'tsm') {
    filters['territory'] = req.user.territory;
   } else if (req.user.role == 'rmm' || req.user.role == 'rbh') {
    filters['region'] = req.user.region;
   } else if (req.user.role == 'zbh') {
    filters['zone'] = req.user.zone;
   }
   const data = await dashboardService.getDashboardData(filters);
   return res.status(200).json(data);
  } catch (error) {
   logger.error({ err: error }, 'Get dashboard data error');
   return res.status(500).json({ message: 'Internal server error' });
  }
 }
}

const dashboardController = new DashboardController();
export default dashboardController;
