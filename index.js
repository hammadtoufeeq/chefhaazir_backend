import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import connectDB from './config/db.js'
import authRoutes from './routes/authRoutes.js'
import chefRoutes from './routes/chefRoutes.js'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}))

app.use(express.json())

app.use(cookieParser())


app.use('/api/auth', authRoutes)
app.use('/api/chefs', chefRoutes)


app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Welcome to Chef Backend API' })
})


app.use((req, res) => {
    res.status(404).json({ status: 'error', message: 'Route not found' })
})



app.use((err, req, res, next) => {
    console.log(err.message)
    res.status(err.statusCode || 500).json({ status: 'error', message: err.message || 'Internal Server Error' })
})


const startServer = async () => {

    await connectDB()
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`)
    })
}
startServer()
