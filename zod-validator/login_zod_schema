import { z } from "zod";
export const loginSchema = z.object({
  email : z.string('Email is required').trim().toLowerCase().pipe(z.email('Please provide a valid email address')),
  password: z.string('Password is required').min(1,'Password is required')
})