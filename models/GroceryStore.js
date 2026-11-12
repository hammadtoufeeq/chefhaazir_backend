import mongoose from 'mongoose'
import cities from '../constants/cities.js'

const groceryStoreSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        city: {
            type: String,
            enum: cities,
            required: true
        },
        address: {
            type: String,
            required: true,
            trim: true
        },
        approvalStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        }
    },
    { timestamps: true }
)

// Only one APPROVED store per city (pending/rejected stores don't count)
groceryStoreSchema.index(
    { city: 1 },
    { unique: true, partialFilterExpression: { approvalStatus: 'approved' } }
)

const GroceryStore = mongoose.model('GroceryStore', groceryStoreSchema)

export default GroceryStore
