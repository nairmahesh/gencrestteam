import { Router } from 'express';
import {  requireAuth } from '../middlewares/auth.middleware';
import liquidationController from '../controllers/liquidation.controller';

import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.use(requireAuth);

router.get('/distributors',liquidationController.getDistributorsPagnated);
router.get('/products/:id', liquidationController.getDistributorProductMetricsController);
router.get('/products/:id/:product', liquidationController.getDistributorProductionTransactionsController);
router.post('/upload-proof',upload.single('file'),liquidationController.uploadProofUrlToS3Controller);
router.post('/add',liquidationController.addNewLIquidation);




export default router;