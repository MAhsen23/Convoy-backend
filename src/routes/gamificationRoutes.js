import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as gamificationController from '../controllers/gamificationController.js';

const router = express.Router();

router.use(authenticate);

router.get('/me', gamificationController.getMe);
router.get('/achievements', gamificationController.listAchievements);
router.get('/achievements/me', gamificationController.getMyAchievements);

export default router;

