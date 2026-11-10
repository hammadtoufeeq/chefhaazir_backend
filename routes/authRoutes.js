import express from 'express'
import { register , login , refresh , logout , getMe , chefOnlyTest } from '../controllers/authController.js'
import { protect , requireRole  } from '../middleware/authMiddleware.js'
const router = express.Router()

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.get('/me', protect, getMe)
router.get('/chef-only' , protect, requireRole('chef'), chefOnlyTest )
export default router