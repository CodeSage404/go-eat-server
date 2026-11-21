"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogImportController = void 0;
const catalogImport_service_1 = require("../services/catalogImport.service");
const fs_1 = __importDefault(require("fs"));
class CatalogImportController {
    /**
     * Import or update restaurant menu items from Universal CSV
     */
    static async importCatalog(req, res) {
        try {
            const restaurantId = Array.isArray(req.params.restaurantId) ? req.params.restaurantId[0] : req.params.restaurantId;
            let csvData = '';
            // Check if file was uploaded via multipart/form-data
            if (req.file) {
                csvData = fs_1.default.readFileSync(req.file.path, 'utf8');
            }
            else if (req.body.csvContent) {
                csvData = req.body.csvContent;
            }
            else {
                return res.status(400).json({
                    success: false,
                    message: 'No CSV file or csvContent provided',
                });
            }
            const importResult = await catalogImport_service_1.CatalogImportService.importCatalog(restaurantId, csvData);
            return res.status(200).json({
                success: true,
                message: `Import processed: ${importResult.createdCount} created, ${importResult.updatedCount} updated, ${importResult.failedCount} failed`,
                result: importResult,
            });
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to process CSV catalog import',
            });
        }
    }
}
exports.CatalogImportController = CatalogImportController;
