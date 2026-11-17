import { z } from 'zod'
import { SLOTS, isValidDate } from '../utils/time.js'

const objectId = (message) => z.string(message).regex(/^[a-f\d]{24}$/i, message)

export const createBookingSchema = z.object({
    chefId: objectId('A valid chef id is required'),
    date: z.string('Date is required').regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be like YYYY-MM-DD').refine(isValidDate, 'Please provide a real date'),
    slot: z.enum(SLOTS, 'Please select a valid slot'),
    note: z.string('Please describe what you would like the chef to cook').trim().min(10, 'Please describe the dishes you expect (at least 10 characters)').max(500, 'Note cannot be more than 500 characters'),
    street: z.string('Address must be text').trim().min(10, 'Address must be at least 10 characters').max(200, 'Address cannot be more than 200 characters').optional(),
    groceryItems: z.array(
        z.object({
            itemId: objectId('A valid item id is required'),
            quantity: z.number('Quantity must be a number').int('Quantity must be a whole number').min(1, 'Quantity must be at least 1').max(50, 'Quantity cannot be more than 50')
        }),
        'Grocery items must be a list'
    ).max(30, 'You can add up to 30 grocery items').optional()
})

export const bookingListQuerySchema = z.object({
    status: z.enum(['pending', 'confirmed', 'rejected', 'expired', 'cancelled', 'completed', 'disputed'], 'Invalid status').optional(),
    page: z.coerce.number('page must be a number').int('page must be a whole number').min(1, 'page must be at least 1').default(1),
    limit: z.coerce.number('limit must be a number').int('limit must be a whole number').min(1, 'limit must be at least 1').max(50, 'limit cannot be more than 50').default(10)
})

export const availabilityQuerySchema = z.object({
    date: z.string('Date is required').regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be like YYYY-MM-DD').refine(isValidDate, 'Please provide a real date')
})

export const cancelBookingSchema = z.object({
    reason: z.string('Reason must be text').trim().min(3, 'Reason must be at least 3 characters').max(300, 'Reason cannot be more than 300 characters').optional()
})

export const groceryOrderStatusSchema = z.object({
    status: z.enum(['packed', 'out_for_delivery', 'delivered_to_chef'], 'Status must be packed, out_for_delivery or delivered_to_chef')
})

export const groceryOrdersQuerySchema = z.object({
    status: z.enum(['ordered', 'packed', 'out_for_delivery', 'delivered_to_chef', 'return_requested', 'return_verified', 'cancelled'], 'Invalid grocery status').optional(),
    page: z.coerce.number('page must be a number').int('page must be a whole number').min(1, 'page must be at least 1').default(1),
    limit: z.coerce.number('limit must be a number').int('limit must be a whole number').min(1, 'limit must be at least 1').max(50, 'limit cannot be more than 50').default(20)
})
