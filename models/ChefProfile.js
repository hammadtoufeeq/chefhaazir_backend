import mongoose from 'mongoose'
import cities from '../constants/cities.js'

const chefProfileSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true
        },
        city: {
            type: String,
            enum: cities,
            required: true
        },
        address: {
            type: String,
            trim: true,
            required: true
        },
        cuisines: {
            type: [{ type: String, trim: true, maxlength: 40 }],
            required: true,
            validate: { validator: (values) => values.length >= 1 && values.length <= 5, message: 'Select between 1 and 5 cuisines' }
        },
        ratePerSlot: {
            type: Number,
            required: true
        },
        bio: {
            type: String,
            trim: true,
            maxlength: 300
        },
        phoneVerified: {
            type: Boolean,
            default: false
        },
        otpHash: {
            type: String,
            select: false
        },
        otpExpiresAt: {
            type: Date,
            select: false
        },
        otpRequestedAt: {
            type: Date
        },
        otpGeneratedAt: {
            type: Date
        },
        contractAcceptedAt: {
            type: Date
        },
        declarationAcceptedAt: {
            type: Date
        },
        approvalStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        }
    },
    { timestamps: true }
)

chefProfileSchema.index({ city: 1, approvalStatus: 1 })
chefProfileSchema.index({ ratePerSlot: 1 })

const ChefProfile = mongoose.model('ChefProfile', chefProfileSchema)

export default ChefProfile
