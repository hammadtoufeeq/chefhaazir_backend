import { z } from 'zod'

export const chefApprovalSchema = z.object({
    status: z.enum(['approved', 'rejected'], 'Status must be approved or rejected')
})
