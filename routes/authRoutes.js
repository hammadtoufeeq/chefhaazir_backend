import express from 'express'
import { register } from '../controllers/authController.js'
const router = express.Router()

router.post('/register', register)

router.post('/login', (req, res) => {
    res.status(200).json({ message: 'Login route working' })
})

export default router