import { z } from 'zod'
import { ISSUE_REASONS } from '../models/Issue.js'

const objectId = (message) => z.string(message).regex(/^[a-f\d]{24}$/i, message)

export const createIssueSchema = z.object({
    bookingId: objectId('A valid booking id is required'),
    reason: z.enum(ISSUE_REASONS, 'Please select a valid reason'),
    description: z.string('Description is required').trim().min(10, 'Description must be at least 10 characters').max(500, 'Description cannot be more than 500 characters')
})

export const resolveIssueSchema = z.object({
    decision: z.enum(['genuine', 'dismissed'], 'Decision must be genuine or dismissed'),
    adminNote: z.string('Note must be text').trim().max(500, 'Note cannot be more than 500 characters').optional()
})

export const issueListQuerySchema = z.object({
    status: z.enum(['open', 'genuine', 'dismissed'], 'Invalid status').optional(),
    page: z.coerce.number('page must be a number').int('page must be a whole number').min(1, 'page must be at least 1').default(1),
    limit: z.coerce.number('limit must be a number').int('limit must be a whole number').min(1, 'limit must be at least 1').max(50, 'limit cannot be more than 50').default(20)
})

export const userStatusSchema = z.object({
    status: z.enum(['active', 'suspended'], 'Status must be active or suspended'),
    reason: z.string('Reason must be text').trim().min(3, 'Reason must be at least 3 characters').max(300, 'Reason cannot be more than 300 characters').optional()
}).refine((data) => data.status === 'active' || !!data.reason, 'A reason is required to suspend an account')

export const userListQuerySchema = z.object({
    role: z.enum(['user', 'chef', 'grocery_owner', 'admin'], 'Invalid role').optional(),
    status: z.enum(['active', 'suspended'], 'Invalid status').optional(),
    search: z.string().trim().max(50, 'Search cannot be more than 50 characters').optional(),
    page: z.coerce.number('page must be a number').int('page must be a whole number').min(1, 'page must be at least 1').default(1),
    limit: z.coerce.number('limit must be a number').int('limit must be a whole number').min(1, 'limit must be at least 1').max(50, 'limit cannot be more than 50').default(20)
})
