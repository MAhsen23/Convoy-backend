import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as socialController from '../controllers/socialController.js';

const router = express.Router();

router.use(authenticate);

router.get('/users/suggested', socialController.getSuggestedUsers);
router.get('/users/search', socialController.searchUsers);
router.post('/friend-requests', socialController.sendFriendRequest);
router.get('/friend-requests/pending', socialController.listPendingRequests);
router.get('/friend-requests/sent', socialController.listPendingSentRequests);
router.patch('/friend-requests/:id', socialController.respondFriendRequest);
router.delete('/friend-requests/:id', socialController.cancelFriendRequest);
router.get('/friends', socialController.listFriends);
router.delete('/friends/:userId', socialController.removeFriend);

export default router;
