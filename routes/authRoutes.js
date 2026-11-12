import express from 'express'
import { registerUser , login , refresh , logout , getMe , updateMe } from '../controllers/authController.js'
import { protect , requireRole  } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validate.js'
import { registerUserSchema, updateMeSchema } from '../zod-validator/authSchema.js'
import { loginSchema } from '../zod-validator/login_zod_schema.js'
import { registerChef } from '../controllers/chefController.js'
import { registerChefSchema } from '../zod-validator/chef_zod_schema.js'
import { registerGroceryOwner } from '../controllers/groceryController.js'
import { registerGroceryOwnerSchema } from '../zod-validator/grocery_zod_schema.js'
const router = express.Router()

router.post('/register/user', validate(registerUserSchema), registerUser)
router.post('/register/chef', validate(registerChefSchema), registerChef)
router.post('/register/grocery-owner', validate(registerGroceryOwnerSchema), registerGroceryOwner)
router.post('/login', validate(loginSchema), login)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.get('/me', protect, getMe)
router.patch('/me', protect, validate(updateMeSchema), updateMe)
export default router