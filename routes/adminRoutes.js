import express from 'express'
import { getChefs, generateChefOtp, verifyChefOtpAsAdmin, deleteChefProfile, updateChefApproval, getStores, deleteGroceryStore, updateStoreApproval, getChefPayments, getUsers, getAdminBookings, updateUserStatus } from '../controllers/adminController.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validate.js'
import { adminOtpVerifySchema, chefApprovalSchema, storeApprovalSchema, settingsSchema } from '../zod-validator/admin_zod_schema.js'
import { getAdminStats, getSettingsHandler, updateSettings } from '../controllers/statsController.js'
import { userStatusSchema } from '../zod-validator/issue_zod_schema.js'

const router = express.Router()

router.use(protect, requireRole('admin'))

router.get('/chefs', getChefs)
router.post('/chefs/:id/otp', generateChefOtp)
router.post('/chefs/:id/verify-otp', validate(adminOtpVerifySchema), verifyChefOtpAsAdmin)
router.delete('/chefs/:id', deleteChefProfile)
router.patch('/chefs/:id/approval', validate(chefApprovalSchema), updateChefApproval)

router.get('/stores', getStores)
router.delete('/stores/:id', deleteGroceryStore)
router.patch('/stores/:id/approval', validate(storeApprovalSchema), updateStoreApproval)

router.get('/chef-payments', getChefPayments)
router.get('/bookings', getAdminBookings)

router.get('/users', getUsers)
router.patch('/users/:id/status', validate(userStatusSchema), updateUserStatus)

router.get('/stats', getAdminStats)
router.get('/settings', getSettingsHandler)
router.patch('/settings', validate(settingsSchema), updateSettings)

export default router
