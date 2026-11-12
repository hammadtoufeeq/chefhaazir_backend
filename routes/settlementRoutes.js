import express from 'express'
import { createSettlement, getMySettlements, getSettlements, verifySettlement, rejectSettlement } from '../controllers/settlementController.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validate.js'
import { createSettlementSchema, rejectSettlementSchema } from '../zod-validator/settlement_zod_schema.js'

const router = express.Router()

// Chef
router.post('/', protect, requireRole('chef'), validate(createSettlementSchema), createSettlement)
router.get('/mine', protect, requireRole('chef'), getMySettlements)

// Admin
router.get('/', protect, requireRole('admin'), getSettlements)
router.patch('/:id/verify', protect, requireRole('admin'), verifySettlement)
router.patch('/:id/reject', protect, requireRole('admin'), validate(rejectSettlementSchema), rejectSettlement)

export default router
