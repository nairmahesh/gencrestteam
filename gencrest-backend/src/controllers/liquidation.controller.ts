import { Request, Response } from "express";
import liquidationService from "../services/liquidation.service";
import { uploadFileToS3 } from "../services/s3.service";

class LiquidationController {
    async getDistributorsPagnated(req: Request, res: Response) {
        try {
            if (!req.user) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const search = req.query.search || '';
            const filters: Record<string, any> = {};
            if (req.user.role == 'mdo' || req.user.role == 'so' || req.user.role == 'tsm') {
                filters['territory'] = req.user.territory;
            } else if (req.user.role == 'rmm' || req.user.role == 'rbh') {
                if (req.user.region) {
                    filters['region'] = req.user.region;
                } else {
                    filters['zone'] = req.user.zone;
                }
            } else if (req.user.role == 'zbh') {
                filters['zone'] = req.user.zone;
            }
            const data = await liquidationService.getDistributorsPagnated(page, limit, filters, search);
            res.status(200).json(data);
        } catch (error) {
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
    async getDistributorProductMetricsController(req: Request, res: Response) {
        try {
            const distributor = req.params.id
            if (!distributor) {
                return res.status(200).json({})
            }
            const data = await liquidationService.getDistributorProductMetrics(distributor);

            return res.status(200).json(data ?? {})
        } catch (err) {
            console.log(err)
            res.status(500).json({ message: 'Internal server error' });
        }
    }
    async getDistributorProductionTransactionsController(req: Request, res: Response) {
        try {
            const distributor = req.params.id
            const product = req.params.product
            const type = req.query.type ?? "opening"
            if (!distributor) {
                return res.status(200).json({})
            }
            const data = await liquidationService.getDistributorTransactionSummary(distributor, product, type as any);

            return res.status(200).json(data ?? {})
        } catch (err) {
            console.log(err)
            res.status(500).json({ message: 'Internal server error' });
        }
    }
    async uploadProofUrlToS3Controller(req: Request, res: Response) {
        try {
            const file = req.file;
            if (!file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }
            const { originalname, mimetype, buffer } = file as Express.Multer.File;

            const data = await uploadFileToS3(buffer, originalname, mimetype);
            return res.status(200).json(data)

        } catch (err) {
            console.log(err)
            res.status(500).json({ message: 'Internal server error' });
        }
    }
    async addNewLIquidation(req: Request, res: Response) {
        try {

            const data = await liquidationService.addNewLiquidationEntry(req.body, req.user!);
            return res.status(200).json(data)

        } catch (err) {
            console.log(err)
            res.status(500).json({ message: 'Internal server error' });
        }
    }

}

const liquidationController = new LiquidationController();
export default liquidationController;