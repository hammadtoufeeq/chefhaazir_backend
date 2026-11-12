import { z } from 'zod'
import cities from '../constants/cities.js'

export const registerUserSchema = z.object({
    name: z.string('Name is required').trim().min(2, 'Name must be at least 2 characters').max(50, 'Name cannot be more than 50 characters'),
    email: z.string('Email is required').trim().toLowerCase().pipe(z.email('Please provide a valid email')),
    password: z.string('Password is required').min(8, 'Password must be at least 8 characters').regex(/[a-zA-Z]/, 'Password must contain a letter').regex(/[0-9]/, 'Password must contain a number'),
    phone: z.string('Phone is required').regex(/^(03\d{9}|\+923\d{9})$/, 'Phone must be like 03XXXXXXXXX'),
    city: z.enum(cities, 'Please select a valid city'),
    address: z.string('Address is required').trim().min(10, 'Address must be at least 10 characters').max(200, 'Address cannot be more than 200 characters')
})
// Fields an account can change about itself. City and address are for customers only;
// chefs change theirs in the chef profile, grocery owners in their store.
export const updateMeSchema = z.object({
    name: z.string('Name must be text').trim().min(2, 'Name must be at least 2 characters').max(50, 'Name cannot be more than 50 characters').optional(),
    phone: z.string('Phone must be text').regex(/^(03\d{9}|\+923\d{9})$/, 'Phone must be like 03XXXXXXXXX').optional(),
    city: z.enum(cities, 'Please select a valid city').optional(),
    address: z.string('Address must be text').trim().min(10, 'Address must be at least 10 characters').max(200, 'Address cannot be more than 200 characters').optional()
}).refine((data) => Object.keys(data).length > 0, 'Please provide at least one field to update')
