import { z } from 'zod'
import cities from '../constants/cities.js'

export const chefApprovalSchema = z.object({
    status: z.enum(['approved', 'rejected'], 'Status must be approved or rejected')
})

export const storeApprovalSchema = z.object({
    status: z.enum(['approved', 'rejected'], 'Status must be approved or rejected'),
    override: z.boolean().optional()
})

export const adminOtpVerifySchema = z.object({
    otp: z.string('OTP must be text').trim().regex(/^\d{6}$/, 'Enter the 6-digit verification code')
})

export const adminGroceryOwnerSchema = z.object({
    name: z.string().trim().min(2).max(50),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(8).regex(/[a-zA-Z]/).regex(/[0-9]/),
    phone: z.string().regex(/^(03\d{9}|\+923\d{9})$/),
    storeName: z.string().trim().min(2).max(60),
    city: z.enum(cities),
    address: z.string().trim().min(10).max(200)
})

export const adminGroceryOwnerUpdateSchema = adminGroceryOwnerSchema.partial().omit({ password: true }).extend({
    password: z.string().min(8).regex(/[a-zA-Z]/).regex(/[0-9]/).optional()
}).refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update')

export const settingsSchema = z.object({
    commissionRate: z.number('Commission rate must be a number').min(0, 'Commission rate cannot be negative').max(50, 'Commission rate cannot be more than 50%').optional(),
    deliveryFee: z.number('Delivery fee must be a number').int('Delivery fee must be a whole number').min(0, 'Delivery fee cannot be negative').max(5000, 'Delivery fee is too high').optional(),
    freeDeliveryMin: z.number('Free delivery minimum must be a number').int('Free delivery minimum must be a whole number').min(0, 'Free delivery minimum cannot be negative').max(100000, 'Free delivery minimum is too high').optional(),
    paymentBlockDays: z.number('Payment block days must be a number').int('Payment block days must be a whole number').min(1, 'Payment block days must be at least 1').max(30, 'Payment block days cannot be more than 30').optional()
}).refine((data) => Object.keys(data).length > 0, 'Please provide at least one setting to update')
