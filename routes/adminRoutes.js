import express from 'express'
import { getChefs, generateChefOtp, updateChefApproval } from '../controllers/adminController.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validate.js'
import { chefApprovalSchema } from '../zod-validator/admin_zod_schema.js'

const router = express.Router()

router.use(protect, requireRole('admin'))

router.get('/chefs', getChefs)
router.post('/chefs/:id/otp', generateChefOtp)
router.patch('/chefs/:id/approval', validate(chefApprovalSchema), updateChefApproval)

export default router
