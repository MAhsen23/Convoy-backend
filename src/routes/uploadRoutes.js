import express from 'express';
import * as uploadController from '../controllers/uploadController.js';
import { authenticate } from '../middleware/auth.js';
import { uploadSingle, uploadMultiple } from '../middleware/upload.js';

const router = express.Router();

router.use(authenticate);

router.post('/', uploadSingle('image'), uploadController.uploadImagesHandler);
router.post('/multiple', uploadMultiple('images', 10), uploadController.uploadImagesHandler);

export default router;
