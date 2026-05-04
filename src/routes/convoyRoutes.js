import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as convoyController from '../controllers/convoyController.js';

const router = express.Router();

router.use(authenticate);

router.post('/', convoyController.createConvoy);
router.get('/current', convoyController.getCurrentConvoy);
router.get('/history', convoyController.listConvoyHistory);
router.get('/stats', convoyController.getUserConvoyStats);
router.post('/join', convoyController.joinByCode);
router.get('/:id', convoyController.getConvoyDetails);
router.post('/:id/leave', convoyController.leaveConvoy);
router.post('/:id/end', convoyController.endConvoy);
router.patch('/:id/status', convoyController.updateConvoyStatus);
router.patch('/:id/destination', convoyController.updateConvoyDestination);
router.get('/:id/members', convoyController.listMembers);
router.get('/:id/member-locations', convoyController.listMemberLocations);
router.post('/:id/voice/token', convoyController.generateConvoyVoiceToken);
router.post('/:id/messages', convoyController.sendConvoyMessage);
router.get('/:id/messages', convoyController.listConvoyMessages);

router.post('/:id/invites', convoyController.sendInvite);
router.get('/invites/pending', convoyController.listPendingInvites);
router.patch('/invites/:id', convoyController.respondInvite);

export default router;