import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { upload } from '../middlewares/upload.middleware';
import { checkPasswordSet, requireAuth } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';

const router = Router();


router.use(requireAuth);
router.use(checkPasswordSet);
router.use(requireAdmin);

router.post('/users/upload',upload.single('file'),adminController.uploadUserSheet);
router.post('/products/upload',upload.single('file'),adminController.uploadProductSheet);
router.post('/distributors/upload',upload.single('file'),adminController.uploadDistributorSheet);
router.post('/liquidation/upload',upload.single('file'),adminController.uploadDistributorLiquidationEntries);




export default router;