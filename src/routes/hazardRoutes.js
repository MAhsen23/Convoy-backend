import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as hazardController from '../controllers/hazardController.js';

const router = express.Router();

router.use(authenticate);

router.get('/types', hazardController.listTypes);
router.get('/nearby', hazardController.getNearby);
router.get('/mine', hazardController.listMine);
router.post('/', hazardController.createReport);
router.get('/:id', hazardController.getReport);
router.post('/:id/vote', hazardController.vote);

export default router;
