import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
    getLogs,
    getLogByRequestId,
    getStatistics,
    listSocketLogs,
    socketLogStats
} from '../controllers/logController.js';

const router = express.Router();

router.use(authenticate);

router.get('/api', getLogs);
router.get('/api/stats', getStatistics);
router.get('/api/:requestId', getLogByRequestId);

router.get('/socket', listSocketLogs);
router.get('/socket/stats', socketLogStats);

export default router;
