import express from 'express'
import { getMyStore, getMyItems, createItem, updateItem, deleteItem, getStores, getItems } from '../controllers/groceryController.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validate.js'
import { createItemSchema, updateItemSchema } from '../zod-validator/grocery_zod_schema.js'

const router = express.Router()

// Grocery owner: own store and item CRUD
router.get('/my-store', protect, requireRole('grocery_owner'), getMyStore)
router.get('/my-items', protect, requireRole('grocery_owner'), getMyItems)
router.post('/items', protect, requireRole('grocery_owner'), validate(createItemSchema), createItem)
router.patch('/items/:id', protect, requireRole('grocery_owner'), validate(updateItemSchema), updateItem)
router.delete('/items/:id', protect, requireRole('grocery_owner'), deleteItem)

// Public: anyone can browse
router.get('/stores', getStores)
router.get('/items', getItems)

export default router
