import express from 'express'

const router = express.Router()

router.post('/register', (req, res) => {
    res.status(200).json({ message: 'Register route working', data: req.body })
})

router.post('/login', (req, res) => {
    res.status(200).json({ message: 'Login route working' })
})

export default router