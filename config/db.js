import mongoose from 'mongoose'

// One shared connection. On Vercel every request may run in a fresh function,
// so we connect on first use and reuse the same connection afterwards.
let connectionPromise = null

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) return

    if (!connectionPromise) {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not set')
        }
        connectionPromise = mongoose.connect(process.env.MONGO_URI)
            .then((conn) => {
                console.log(`MongoDB connected: ${conn.connection.host} / DB: ${conn.connection.name}`)
                return conn
            })
            .catch((error) => {
                connectionPromise = null   // let the next request try again
                throw error
            })
    }

    await connectionPromise
}

export default connectDB
