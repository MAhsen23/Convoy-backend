import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as garageController from '../controllers/garageController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', garageController.list);
router.post('/', garageController.addVehicle);
router.get('/:id', garageController.getVehicle);
router.patch('/:id', garageController.updateVehicle);
router.delete('/:id', garageController.deleteVehicle);
router.patch('/:id/primary', garageController.setPrimary);

export default router;
