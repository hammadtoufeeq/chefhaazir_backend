import express from 'express'
import { getMyProfile } from '../controllers/chefController.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/me/profile', protect, requireRole('chef'), getMyProfile)

export default router