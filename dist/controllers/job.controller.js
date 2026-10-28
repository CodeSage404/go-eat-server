"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const job_model_1 = __importDefault(require("../models/job.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
function generateSlug(title) {
    const base = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    return `${base}-${Date.now().toString(36)}`;
}
class JobController {
    constructor() {
        /**
         * Public: List all active jobs with optional filters
         */
        this.getPublicJobs = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { department, type, workplaceType, countryCode, search } = req.query;
            const query = { status: 'active' };
            if (department && typeof department === 'string' && department !== 'all') {
                query.department = new RegExp(`^${department.trim()}$`, 'i');
            }
            if (type && typeof type === 'string' && type !== 'all') {
                query.type = type.trim();
            }
            if (workplaceType && typeof workplaceType === 'string' && workplaceType !== 'all') {
                query.workplaceType = workplaceType.trim();
            }
            if (countryCode && typeof countryCode === 'string' && countryCode !== 'ALL') {
                query.$or = [
                    { countryCode: countryCode.trim().toUpperCase() },
                    { countryCode: 'ALL' },
                ];
            }
            if (search && typeof search === 'string' && search.trim().length > 0) {
                const searchRegex = new RegExp(search.trim(), 'i');
                query.$or = [
                    { title: searchRegex },
                    { department: searchRegex },
                    { location: searchRegex },
                    { description: searchRegex },
                ];
            }
            const jobs = await job_model_1.default.find(query)
                .sort({ featured: -1, createdAt: -1 })
                .lean();
            // Group available departments for filter pills
            const allActiveJobs = await job_model_1.default.find({ status: 'active' }).select('department').lean();
            const departments = Array.from(new Set(allActiveJobs.map((j) => j.department))).filter(Boolean);
            res.status(200).json({
                status: 'success',
                results: jobs.length,
                data: {
                    jobs,
                    departments,
                },
            });
        });
        /**
         * Public: Get single job details by slug or ID
         */
        this.getJobBySlug = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const rawId = req.params.identifier;
            const identifier = Array.isArray(rawId) ? rawId[0] : rawId;
            let job = null;
            if (typeof identifier === 'string' && identifier.match(/^[0-9a-fA-F]{24}$/)) {
                job = await job_model_1.default.findById(identifier);
            }
            if (!job && typeof identifier === 'string') {
                job = await job_model_1.default.findOne({ slug: identifier });
            }
            if (!job || (job.status !== 'active' && !req.user)) {
                throw new appError_1.default('Job opening not found or has expired', 404);
            }
            res.status(200).json({
                status: 'success',
                data: {
                    job,
                },
            });
        });
        /**
         * Admin: List all jobs (including draft and closed)
         */
        this.getAdminJobs = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { status, department, search } = req.query;
            const query = {};
            if (status && status !== 'all') {
                query.status = status;
            }
            if (department && department !== 'all') {
                query.department = new RegExp(`^${department}$`, 'i');
            }
            if (search && typeof search === 'string') {
                const regex = new RegExp(search.trim(), 'i');
                query.$or = [{ title: regex }, { department: regex }, { location: regex }];
            }
            const jobs = await job_model_1.default.find(query).sort({ createdAt: -1 }).lean();
            res.status(200).json({
                status: 'success',
                results: jobs.length,
                data: {
                    jobs,
                },
            });
        });
        /**
         * Admin: Create a new job opening
         */
        this.createJob = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { title, department, location, country, countryCode, type, workplaceType, salary, description, responsibilities, requirements, benefits, applyEmail, status, featured, } = req.body;
            if (!title || !department || !description) {
                throw new appError_1.default('Title, department, and description are required', 400);
            }
            const slug = generateSlug(title);
            const job = await job_model_1.default.create({
                title,
                slug,
                department,
                location: location || 'Remote',
                country: country || 'Global',
                countryCode: countryCode ? countryCode.toUpperCase() : 'ALL',
                type: type || 'full-time',
                workplaceType: workplaceType || 'remote',
                salary,
                description,
                responsibilities: Array.isArray(responsibilities)
                    ? responsibilities
                    : typeof responsibilities === 'string'
                        ? responsibilities.split('\n').filter((s) => s.trim().length > 0)
                        : [],
                requirements: Array.isArray(requirements)
                    ? requirements
                    : typeof requirements === 'string'
                        ? requirements.split('\n').filter((s) => s.trim().length > 0)
                        : [],
                benefits: Array.isArray(benefits)
                    ? benefits
                    : typeof benefits === 'string'
                        ? benefits.split('\n').filter((s) => s.trim().length > 0)
                        : [],
                applyEmail: applyEmail || 'support@goeatone.com',
                status: status || 'active',
                featured: Boolean(featured),
                createdBy: req.user?._id,
            });
            res.status(201).json({
                status: 'success',
                data: {
                    job,
                },
            });
        });
        /**
         * Admin: Update an existing job opening
         */
        this.updateJob = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const existing = await job_model_1.default.findById(id);
            if (!existing) {
                throw new appError_1.default('Job opening not found', 404);
            }
            const updates = { ...req.body };
            if (typeof updates.responsibilities === 'string') {
                updates.responsibilities = updates.responsibilities
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean);
            }
            if (typeof updates.requirements === 'string') {
                updates.requirements = updates.requirements
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean);
            }
            if (typeof updates.benefits === 'string') {
                updates.benefits = updates.benefits
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean);
            }
            if (updates.countryCode) {
                updates.countryCode = updates.countryCode.toUpperCase();
            }
            if (!updates.applyEmail) {
                updates.applyEmail = 'support@goeatone.com';
            }
            const updatedJob = await job_model_1.default.findByIdAndUpdate(id, updates, {
                new: true,
                runValidators: true,
            });
            res.status(200).json({
                status: 'success',
                data: {
                    job: updatedJob,
                },
            });
        });
        /**
         * Admin: Delete a job opening
         */
        this.deleteJob = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const job = await job_model_1.default.findByIdAndDelete(id);
            if (!job) {
                throw new appError_1.default('Job opening not found', 404);
            }
            res.status(200).json({
                status: 'success',
                message: 'Job opening deleted successfully',
                data: null,
            });
        });
    }
}
const jobController = new JobController();
exports.default = jobController;
