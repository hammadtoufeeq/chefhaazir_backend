import mongoose from 'mongoose'
import { groceryCategories, groceryUnits } from '../constants/grocery.js'

const groceryItemSchema = new mongoose.Schema(
    {
        store: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'GroceryStore',
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        category: {
            type: String,
            enum: groceryCategories,
            required: true
        },
        price: {
            type: Number,
            required: true,
            min: 1
        },
        unit: {
            type: String,
            enum: groceryUnits,
            required: true
        },
        inStock: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
)

// The same item name can exist only once inside one store
groceryItemSchema.index({ store: 1, name: 1 }, { unique: true })

const GroceryItem = mongoose.model('GroceryItem', groceryItemSchema)

export default GroceryItem
