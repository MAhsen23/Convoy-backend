import express from 'express';
import { getLogsData, getLogsViewerPage } from '../controllers/logViewerController.js';

const router = express.Router();

router.get('/', getLogsViewerPage);
router.get('/data', getLogsData);

export default router;

