import { Router } from 'express';
import cookieController from '../controllers/cookie.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/cookies/consent:
 *   post:
 *     tags:
 *       - Cookies
 *     summary: Set Cookie Consent Preference
 *     description: Stores cookie preference in an HTTP-Only secure cookie with a 1-year expiration.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [consent]
 *             properties:
 *               consent:
 *                 type: string
 *                 enum: [all, required]
 *                 example: all
 *     responses:
 *       200:
 *         description: Cookie consent preference saved successfully.
 *       400:
 *         description: Invalid consent value provided.
 */
router.post('/consent', cookieController.setConsent);

/**
 * @openapi
 * /api/v1/cookies/consent:
 *   get:
 *     tags:
 *       - Cookies
 *     summary: Get Current Cookie Consent Preference
 *     description: Reads and returns current HTTP-Only cookie consent preferences.
 *     responses:
 *       200:
 *         description: Returns current cookie consent preference.
 */
router.get('/consent', cookieController.getConsent);

export default router;
