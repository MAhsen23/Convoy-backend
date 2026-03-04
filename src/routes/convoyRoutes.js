import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as convoyController from '../controllers/convoyController.js';

const router = express.Router();

router.use(authenticate);

router.post('/', convoyController.createConvoy);
router.get('/current', convoyController.getCurrentConvoy);
router.post('/join', convoyController.joinByCode);
router.post('/:id/leave', convoyController.leaveConvoy);
router.post('/:id/end', convoyController.endConvoy);
router.get('/:id/members', convoyController.listMembers);

router.post('/:id/invites', convoyController.sendInvite);
router.get('/invites/pending', convoyController.listPendingInvites);
router.patch('/invites/:id', convoyController.respondInvite);

export default router;
