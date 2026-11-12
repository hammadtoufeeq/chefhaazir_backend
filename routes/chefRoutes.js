import express from 'express'
import { getMyProfile, updateMyProfile, acceptContract, verifyOtp, getChefs, getChefById } from '../controllers/chefController.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validate.js'
import { getChefAvailability } from '../controllers/bookingController.js'
import { updateChefProfileSchema, acceptContractSchema, verifyOtpSchema } from '../zod-validator/chef_zod_schema.js'
const router = express.Router()

router.get('/me/profile', protect, requireRole('chef'), getMyProfile)
router.patch('/me/profile', protect, requireRole('chef'), validate(updateChefProfileSchema), updateMyProfile)
router.post('/me/contract', protect, requireRole('chef'), validate(acceptContractSchema), acceptContract)
router.post('/me/verify-otp', protect, requireRole('chef'), validate(verifyOtpSchema), verifyOtp)

// Public: anyone (including guests) can browse chefs
router.get('/', getChefs)
router.get('/:id', getChefById)
router.get('/:id/availability', getChefAvailability)

export default router