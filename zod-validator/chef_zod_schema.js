import { z } from 'zod'
import cities from '../constants/cities.js'

const cuisineName = z.string('Cuisine must be text').trim().min(2, 'Cuisine names must be at least 2 characters').max(40, 'Cuisine names can be up to 40 characters')
const cuisineList = (message) => z.array(cuisineName, message).min(1, 'Select at least 1 cuisine').max(5, 'You can select up to 5 cuisines').refine((values) => new Set(values.map((value) => value.toLowerCase())).size === values.length, 'Each cuisine must be unique')

export const registerChefSchema = z.object({
    name: z.string('Name is required').trim().min(2, 'Name must be at least 2 characters').max(50, 'Name cannot be more than 50 characters'),
    email: z.string('Email is required').trim().toLowerCase().pipe(z.email('Please provide a valid email')),
    password: z.string('Password is required').min(8, 'Password must be at least 8 characters').regex(/[a-zA-Z]/, 'Password must contain a letter').regex(/[0-9]/, 'Password must contain a number'),
    phone: z.string('Phone is required').regex(/^(03\d{9}|\+923\d{9})$/, 'Phone must be like 03XXXXXXXXX'),
    city: z.enum(cities, 'Please select a valid city'),
    address: z.string('Address is required').trim().min(10, 'Address must be at least 10 characters').max(200, 'Address cannot be more than 200 characters'),
    cuisines: cuisineList('Cuisines are required'),
    ratePerSlot: z.number('Rate must be a number').int('Rate must be a whole number').min(500, 'Rate must be at least Rs 500').max(20000, 'Rate cannot be more than Rs 20,000'),
    bio: z.string('Bio is required').trim().min(10, 'Bio must be at least 10 characters').max(300, 'Bio cannot be more than 300 characters')
})
export const updateChefProfileSchema = z.object({
    city: z.enum(cities, 'Please select a valid city').optional(),
    address: z.string('Address must be text').trim().min(10, 'Address must be at least 10 characters').max(200, 'Address cannot be more than 200 characters').optional(),
    cuisines: cuisineList('Cuisines must be a list').optional(),
    ratePerSlot: z.number('Rate must be a number').int('Rate must be a whole number').min(500, 'Rate must be at least Rs 500').max(20000, 'Rate cannot be more than Rs 20,000').optional(),
    bio: z.string('Bio must be text').trim().max(300, 'Bio cannot be more than 300 characters').optional()
}).refine((data) => Object.keys(data).length > 0, 'Please provide at least one field to update')
export const acceptContractSchema = z.object({
    acceptContract: z.literal(true, 'You must accept the contract'),
    acceptDeclaration: z.literal(true, 'You must accept the legal declaration')
})

export const verifyOtpSchema = z.object({
    otp: z.string('OTP is required').trim().regex(/^\d{6}$/, 'OTP must be exactly 6 digits')
})

export const chefAvailabilityUpdateSchema = z.object({
    date: z.string('Date is required').regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be like YYYY-MM-DD').refine((value) => {
        const date = new Date(`${value}T00:00:00Z`)
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    }, 'Please provide a real date'),
    unavailableSlots: z.array(z.enum(['08-10', '10-12', '12-14', '14-16', '16-18', '18-20', '20-22']), 'Unavailable slots must be a list').max(7).refine((slots) => new Set(slots).size === slots.length, 'Unavailable slots must be unique')
})

export const chefListQuerySchema = z.object({
    search: z.string().trim().max(50, 'Search cannot be more than 50 characters').optional(),
    city: z.enum(cities, 'Please select a valid city').optional(),
    cuisine: cuisineName.optional(),
    minPrice: z.coerce.number('minPrice must be a number').min(0, 'minPrice cannot be negative').optional(),
    maxPrice: z.coerce.number('maxPrice must be a number').min(0, 'maxPrice cannot be negative').optional(),
    page: z.coerce.number('page must be a number').int('page must be a whole number').min(1, 'page must be at least 1').default(1),
    limit: z.coerce.number('limit must be a number').int('limit must be a whole number').min(1, 'limit must be at least 1').max(50, 'limit cannot be more than 50').default(10)
})
