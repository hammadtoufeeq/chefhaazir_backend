import express from 'express'
import { createIssue, getMyIssues, getIssues, resolveIssue } from '../controllers/issueController.js'
import { protect, requireRole } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validate.js'
import { createIssueSchema, resolveIssueSchema } from '../zod-validator/issue_zod_schema.js'

const router = express.Router()

// Customer or chef
router.post('/', protect, requireRole('user', 'chef'), validate(createIssueSchema), createIssue)
router.get('/mine', protect, requireRole('user', 'chef'), getMyIssues)

// Admin
router.get('/', protect, requireRole('admin'), getIssues)
router.patch('/:id/resolve', protect, requireRole('admin'), validate(resolveIssueSchema), resolveIssue)

export default router
