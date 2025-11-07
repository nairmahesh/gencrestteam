import { Router } from 'express';
import {  requireAuth } from '../middlewares/auth.middleware';
import retailerController from '../controllers/retailer.controller';
import { upload } from '../middlewares/upload.middleware';


const router = Router();


router.use(requireAuth);


router.post('/',retailerController.createRetailer);
router.get('/',retailerController.getRetailers);
router.get('/search', retailerController.searchRetailers);
router.get('/verification-summary', retailerController.getVerificationSummary);
router.get('/:retailerId/history', retailerController.getVerificationHistory);
router.post('/rectify', retailerController.submitStockRectification);
router.post(
  '/verify',
  upload.fields([
    { name: 'payload', maxCount: 1 },
    { name: 'files', maxCount: 10 }, // Allow up to 10 photos
    { name: 'signature', maxCount: 1 }
  ]),
  retailerController.submitStockVerification
);
export default router;