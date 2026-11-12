import { z } from 'zod'
import cities from '../constants/cities.js'
import { groceryCategories, groceryUnits } from '../constants/grocery.js'

export const registerGroceryOwnerSchema = z.object({
    name: z.string('Name is required').trim().min(2, 'Name must be at least 2 characters').max(50, 'Name cannot be more than 50 characters'),
    email: z.string('Email is required').trim().toLowerCase().pipe(z.email('Please provide a valid email')),
    password: z.string('Password is required').min(8, 'Password must be at least 8 characters').regex(/[a-zA-Z]/, 'Password must contain a letter').regex(/[0-9]/, 'Password must contain a number'),
    phone: z.string('Phone is required').regex(/^(03\d{9}|\+923\d{9})$/, 'Phone must be like 03XXXXXXXXX'),
    storeName: z.string('Store name is required').trim().min(2, 'Store name must be at least 2 characters').max(60, 'Store name cannot be more than 60 characters'),
    city: z.enum(cities, 'Please select a valid city'),
    address: z.string('Address is required').trim().min(10, 'Address must be at least 10 characters').max(200, 'Address cannot be more than 200 characters')
})

export const createItemSchema = z.object({
    name: z.string('Item name is required').trim().min(2, 'Item name must be at least 2 characters').max(60, 'Item name cannot be more than 60 characters'),
    category: z.enum(groceryCategories, 'Please select a valid category'),
    price: z.number('Price must be a number').int('Price must be a whole number').min(1, 'Price must be at least Rs 1').max(100000, 'Price is too high'),
    unit: z.enum(groceryUnits, 'Please select a valid unit'),
    inStock: z.boolean('inStock must be true or false').optional()
})

export const updateItemSchema = createItemSchema.partial()
    .refine((data) => Object.keys(data).length > 0, 'Please provide at least one field to update')

export const groceryItemsQuerySchema = z.object({
    city: z.enum(cities, 'Please select a valid city'),
    category: z.enum(groceryCategories, 'Please select a valid category').optional(),
    search: z.string().trim().max(50, 'Search cannot be more than 50 characters').optional(),
    page: z.coerce.number('page must be a number').int('page must be a whole number').min(1, 'page must be at least 1').default(1),
    limit: z.coerce.number('limit must be a number').int('limit must be a whole number').min(1, 'limit must be at least 1').max(50, 'limit cannot be more than 50').default(20)
})
