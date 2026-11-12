import { z } from 'zod'

export const chefApprovalSchema = z.object({
    status: z.enum(['approved', 'rejected'], 'Status must be approved or rejected')
})

export const storeApprovalSchema = z.object({
    status: z.enum(['approved', 'rejected'], 'Status must be approved or rejected')
})

export const settingsSchema = z.object({
    commissionRate: z.number('Commission rate must be a number').min(0, 'Commission rate cannot be negative').max(50, 'Commission rate cannot be more than 50%').optional(),
    deliveryFee: z.number('Delivery fee must be a number').int('Delivery fee must be a whole number').min(0, 'Delivery fee cannot be negative').max(5000, 'Delivery fee is too high').optional(),
    freeDeliveryMin: z.number('Free delivery minimum must be a number').int('Free delivery minimum must be a whole number').min(0, 'Free delivery minimum cannot be negative').max(100000, 'Free delivery minimum is too high').optional(),
    paymentBlockDays: z.number('Payment block days must be a number').int('Payment block days must be a whole number').min(1, 'Payment block days must be at least 1').max(30, 'Payment block days cannot be more than 30').optional()
}).refine((data) => Object.keys(data).length > 0, 'Please provide at least one setting to update')
