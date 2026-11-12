import 'dotenv/config'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import User from '../models/User.js'

const createAdmin = async () => {
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_PHONE } = process.env

    if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_PHONE) {
        console.log('Please set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_PHONE in .env')
        process.exit(1)
    }

    await connectDB()

    const existingUser = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() })
    if (existingUser) {
        console.log(`A user with email ${ADMIN_EMAIL} already exists (role: ${existingUser.role})`)
        await mongoose.disconnect()
        process.exit(0)
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12)
    await User.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: hashedPassword,
        phone: ADMIN_PHONE,
        role: 'admin'
    })

    console.log(`Admin created: ${ADMIN_EMAIL}`)
    await mongoose.disconnect()
    process.exit(0)
}

createAdmin()
