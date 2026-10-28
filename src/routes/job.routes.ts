import { Router } from 'express';
import jobController from '../controllers/job.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

/**
 * @openapi
 * /api/v1/jobs:
 *   get:
 *     summary: Retrieve active job openings
 *     description: Returns a list of active job openings with optional filtering by department, employment type, workplace type, country code, and keyword search. Also returns all unique departments for client filtering.
 *     tags:
 *       - Jobs
 *     parameters:
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department name (e.g. Engineering, Operations)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [full-time, part-time, contract, internship]
 *         description: Filter by employment type
 *       - in: query
 *         name: workplaceType
 *         schema:
 *           type: string
 *           enum: [remote, hybrid, on-site]
 *         description: Filter by workplace setting
 *       - in: query
 *         name: countryCode
 *         schema:
 *           type: string
 *         description: Filter by country code (e.g. NG, UK, IT, ALL)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search keyword across title, department, location, and description
 *     responses:
 *       200:
 *         description: Job openings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Job'
 *                     departments:
 *                       type: array
 *                       items:
 *                         type: string
 *       500:
 *         description: Internal server error
 */
router.get('/', jobController.getPublicJobs);

/**
 * @openapi
 * /api/v1/jobs/{identifier}:
 *   get:
 *     summary: Retrieve single job opening details
 *     description: Fetch detailed job opening specification by its unique URL slug or MongoDB ObjectId.
 *     tags:
 *       - Jobs
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: Job unique slug (e.g. senior-fullstack-engineer-k89) or 24-character hex ObjectId
 *     responses:
 *       200:
 *         description: Job opening details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     job:
 *                       $ref: '#/components/schemas/Job'
 *       404:
 *         description: Job opening not found or has expired
 *       500:
 *         description: Internal server error
 */
router.get('/:identifier', jobController.getJobBySlug);

/* =========================================================================
   ADMIN-PROTECTED JOB MANAGEMENT ROUTES
   ========================================================================= */

/**
 * @openapi
 * /api/v1/jobs/admin/all:
 *   get:
 *     summary: Admin list all job postings
 *     description: Retrieve all job postings across all lifecycle statuses (active, draft, closed) with search and filter parameters. Requires super_admin or admin authorization.
 *     tags:
 *       - Jobs Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, draft, closed]
 *         description: Filter by job lifecycle status
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department name
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search query matching title, department, or location
 *     responses:
 *       200:
 *         description: Admin jobs listed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                   example: 12
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Job'
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - insufficient admin privileges
 *       500:
 *         description: Internal server error
 */
router.get(
  '/admin/all',
  protect,
  restrictTo(UserRole.ADMIN),
  jobController.getAdminJobs
);

/**
 * @openapi
 * /api/v1/jobs:
 *   post:
 *     summary: Admin create job opening
 *     description: Create a new job opening in the GoEatOne careers catalog. Generates an SEO slug and configures application email (default support@goeatone.com). Requires super_admin or admin authorization.
 *     tags:
 *       - Jobs Admin
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - department
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *                 example: Senior Mobile Engineer (React Native)
 *               department:
 *                 type: string
 *                 example: Engineering
 *               location:
 *                 type: string
 *                 example: London, UK / Remote
 *               country:
 *                 type: string
 *                 example: United Kingdom
 *               countryCode:
 *                 type: string
 *                 example: UK
 *               type:
 *                 type: string
 *                 enum: [full-time, part-time, contract, internship]
 *                 example: full-time
 *               workplaceType:
 *                 type: string
 *                 enum: [remote, hybrid, on-site]
 *                 example: hybrid
 *               salary:
 *                 type: string
 *                 example: £65,000 - £80,000 + Equity
 *               description:
 *                 type: string
 *                 example: We are seeking a senior mobile engineer to lead our rider and courier mobile architecture.
 *               responsibilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               requirements:
 *                 type: array
 *                 items:
 *                   type: string
 *               benefits:
 *                 type: array
 *                 items:
 *                   type: string
 *               applyEmail:
 *                 type: string
 *                 example: support@goeatone.com
 *               status:
 *                 type: string
 *                 enum: [active, draft, closed]
 *                 example: active
 *               featured:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Job opening created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     job:
 *                       $ref: '#/components/schemas/Job'
 *       400:
 *         description: Bad request - missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  protect,
  restrictTo(UserRole.ADMIN),
  jobController.createJob
);

/**
 * @openapi
 * /api/v1/jobs/{id}:
 *   put:
 *     summary: Admin update job opening
 *     description: Update an existing job opening by MongoDB ID. Requires super_admin or admin authorization.
 *     tags:
 *       - Jobs Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Job opening MongoDB ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Job opening updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     job:
 *                       $ref: '#/components/schemas/Job'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Job opening not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:id',
  protect,
  restrictTo(UserRole.ADMIN),
  jobController.updateJob
);

/**
 * @openapi
 * /api/v1/jobs/{id}:
 *   delete:
 *     summary: Admin delete job opening
 *     description: Permanently remove a job opening by its MongoDB ObjectId. Requires super_admin or admin authorization.
 *     tags:
 *       - Jobs Admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Job opening MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Job opening deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Job opening deleted successfully
 *                 data:
 *                   type: null
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Job opening not found
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/:id',
  protect,
  restrictTo(UserRole.ADMIN),
  jobController.deleteJob
);

export default router;
