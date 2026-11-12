import mongoose from 'mongoose'

// A single document holding values the admin can change later
const settingSchema = new mongoose.Schema(
    {
        commissionRate: { type: Number, default: 10, min: 0, max: 50 },
        deliveryFee: { type: Number, default: 150, min: 0 },
        freeDeliveryMin: { type: Number, default: 500, min: 0 },
        paymentBlockDays: { type: Number, default: 3, min: 1 }
    },
    { timestamps: true }
)

const Setting = mongoose.model('Setting', settingSchema)

// Returns the settings document, creating it with defaults the first time
export const getSettings = async () => {
    let settings = await Setting.findOne()
    if (!settings) {
        settings = await Setting.create({})
    }
    return settings
}

export default Setting
