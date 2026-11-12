import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import connectDB from './config/db.js'
import authRoutes from './routes/authRoutes.js'
import chefRoutes from './routes/chefRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import groceryRoutes from './routes/groceryRoutes.js'
import bookingRoutes from './routes/bookingRoutes.js'
import settlementRoutes from './routes/settlementRoutes.js'
import issueRoutes from './routes/issueRoutes.js'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}))

app.use(express.json())

app.use(cookieParser())

// Health check works even if the database is down
app.get('/', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Chef Haazir API. Try /api/health' })
})

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Welcome to Chef Backend API' })
})

// Make sure MongoDB is connected before any route runs (needed on Vercel)
app.use(async (req, res, next) => {
    await connectDB()
    next()
})


app.use('/api/auth', authRoutes)
app.use('/api/chefs', chefRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/grocery', groceryRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/settlements', settlementRoutes)
app.use('/api/issues', issueRoutes)


app.use((req, res) => {
    res.status(404).json({ status: 'error', message: 'Route not found' })
})



app.use((err, req, res, next) => {
    let statusCode = err.statusCode || 500
    let message = err.message || 'Internal Server Error'

    // MongoDB unique index broken (e.g. a second approved store in the same city)
    if (err.code === 11000) {
        statusCode = 409
        message = 'This record already exists'
    }

    // Mongoose rejected the data (wrong enum, bad id format, etc.)
    if (err.name === 'ValidationError' || err.name === 'CastError') {
        statusCode = 400
    }

    console.log(message)
    res.status(statusCode).json({ status: 'error', message })
})


// Locally we start a normal server. On Vercel, the platform calls the exported app.
if (!process.env.VERCEL) {
    connectDB()
        .then(() => {
            app.listen(PORT, () => {
                console.log(`Server is running on port ${PORT}`)
            })
        })
        .catch((error) => {
            console.error(`MongoDB connection failed: ${error.message}`)
            process.exit(1)
        })
}

export default app
