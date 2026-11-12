import { z } from 'zod'

export const createSettlementSchema = z.object({
    method: z.enum(['cash', 'jazzcash', 'easypaisa', 'bank'], 'Method must be cash, jazzcash, easypaisa or bank'),
    transactionId: z.string('Transaction ID must be text').trim().min(6, 'Transaction ID must be at least 6 characters').max(30, 'Transaction ID cannot be more than 30 characters').optional()
}).refine((data) => data.method === 'cash' || !!data.transactionId, 'Transaction ID is required unless you pay in cash')

export const rejectSettlementSchema = z.object({
    reason: z.string('Reason is required').trim().min(3, 'Reason must be at least 3 characters').max(300, 'Reason cannot be more than 300 characters')
})

export const settlementListQuerySchema = z.object({
    chef: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid chef id').optional(),
    status: z.enum(['submitted', 'verified', 'rejected'], 'Invalid status').optional(),
    page: z.coerce.number('page must be a number').int('page must be a whole number').min(1, 'page must be at least 1').default(1),
    limit: z.coerce.number('limit must be a number').int('limit must be a whole number').min(1, 'limit must be at least 1').max(50, 'limit cannot be more than 50').default(20)
})
