import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import connectDB from './config/db.js'
import authRoutes from './routes/authRoutes.js'
const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}))
app.use(express.json())
app.use(cookieParser())
app.use('/api/auth', authRoutes)

const startServer = async () => {

    await connectDB()
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`)
    })
}
startServer()
