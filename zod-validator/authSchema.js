import { z } from 'zod'
import cities from '../constants/cities.js'

export const registerSchema = z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name cannot be more than 50 characters'),
    email: z.string().trim().toLowerCase().pipe(z.email('Please provide a valid email')),
    password: z.string().min(8, 'Password must be at least 8 characters').regex(/[a-zA-Z]/, 'Password must contain a letter').regex(/[0-9]/, 'Password must contain a number'),
    phone: z.string().regex(/^(03\d{9}|\+923\d{9})$/, 'Phone must be like 03XXXXXXXXX'),
    city: z.enum(cities, 'Please select a valid city'),
    address: z.string().trim().min(10, 'Address must be at least 10 characters').max(200, 'Address cannot be more than 200 characters'),
    role: z.enum(['user', 'chef', 'grocery_owner'], 'Invalid role').optional()
})