import mongoose from 'mongoose'
import cities from '../constants/cities.js'
const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [50, 'Name cannot be more than 50 characters']
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            select: false
        },
        phone: {
            type: String,
            required: [true, 'Phone is required']
        },
        role: {
            type: String,
            enum: ['user', 'chef', 'grocery_owner', 'admin'],
            default: 'user'
        },
        city: {
            type: String,
            enum: cities,
            required: [true, 'City is required']
        },
        address: {
            type: String,
            trim: true
        },
        status: {
            type: String,
            enum: ['active', 'suspended'],
            default: 'active'
        },
        suspendedReason: {
            type: String
        },
        refreshToken: {
            type: String,
            select: false
        }
    },
    { timestamps: true }
)

const User = mongoose.model('User', userSchema)

export default User