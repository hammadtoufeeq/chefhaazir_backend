import express from 'express'
import { getMyProfile, updateMyProfile, acceptContract, verifyOtp } from '../controllers/chefController.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validate.js'
import { updateChefProfileSchema, acceptContractSchema, verifyOtpSchema } from '../zod-validator/chef_zod_schema.js'
const router = express.Router()

router.get('/me/profile', protect, requireRole('chef'), getMyProfile)
router.patch('/me/profile', protect, requireRole('chef'), validate(updateChefProfileSchema), updateMyProfile)
router.post('/me/contract', protect, requireRole('chef'), validate(acceptContractSchema), acceptContract)
router.post('/me/verify-otp', protect, requireRole('chef'), validate(verifyOtpSchema), verifyOtp)

export default router