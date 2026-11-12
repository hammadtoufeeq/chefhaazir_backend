import express from 'express'
import { getMyProfile } from '../controllers/chefController.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'
import { getMyProfile, updateMyProfile } from '../controllers/chefController.js'
import { validate } from '../middleware/validate.js'
import { updateChefProfileSchema } from '../zod-validator/chef_zod_schema.js'
const router = express.Router()

router.get('/me/profile', protect, requireRole('chef'), getMyProfile)
router.patch('/me/profile', protect, requireRole('chef'), validate(updateChefProfileSchema), updateMyProfile)

export default router