import bcrypt from 'bcrypt'
import User from '../models/User.js'

export const register = async (req,res) =>{
    const { name, email, password, phone, city, address , role } = req.body
    if(role === 'admin'){
        const error = new Error('You cannot register as an admin')
        error.statusCode = 403
        throw error
    }
    if(!name || !email || !password || !phone || !city || !address){
        const error = new Error('Please provide all required fields')
        error.statusCode = 400
        throw error
    }
    const existingUser = await User.findOne({ email: email.trim().toLowerCase() })
    if(existingUser){
        const error = new Error('User already exists')
        error.statusCode = 409
        throw error
    }
    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await User.create({
        name,
        email,
        password: hashedPassword,
        phone,
        city,
        address,
        role
    })
    res.status(201).json({ status: 'success', message: 'User registered successfully', user: { id: user._id, name: user.name, email: user.email, role: user.role , city: user.city } })


}