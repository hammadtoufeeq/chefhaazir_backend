import mongoose from 'mongoose'
import cities from '../constants/cities.js'
import cuisines from '../constants/cuisines.js'

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
        cuisines: {
            type: [String],
            enum: cuisines,
            required: true
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