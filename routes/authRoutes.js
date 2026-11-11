import express from 'express'
import { registerUser , login , refresh , logout , getMe } from '../controllers/authController.js'
import { protect , requireRole  } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validate.js'
import { registerUserSchema} from '../zod-validator/authSchema.js'
import { loginSchema } from '../zod-validator/login_zod_schema.js'
const router = express.Router()

router.post('/register', validate(registerUserSchema), registerUser)
router.post('/login', validate(loginSchema), login)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.get('/me', protect, getMe)
export default router