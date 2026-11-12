import express from 'express'
import { getChefs, generateChefOtp, updateChefApproval, getStores, updateStoreApproval, getChefPayments, getUsers, updateUserStatus } from '../controllers/adminController.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validate.js'
import { chefApprovalSchema, storeApprovalSchema } from '../zod-validator/admin_zod_schema.js'
import { userStatusSchema } from '../zod-validator/issue_zod_schema.js'

const router = express.Router()

router.use(protect, requireRole('admin'))

router.get('/chefs', getChefs)
router.post('/chefs/:id/otp', generateChefOtp)
router.patch('/chefs/:id/approval', validate(chefApprovalSchema), updateChefApproval)

router.get('/stores', getStores)
router.patch('/stores/:id/approval', validate(storeApprovalSchema), updateStoreApproval)

router.get('/chef-payments', getChefPayments)

router.get('/users', getUsers)
router.patch('/users/:id/status', validate(userStatusSchema), updateUserStatus)

export default router
