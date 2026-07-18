"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = renderTemplate;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Custom EJS-compatible template compiler that avoids external npm package downloads.
 * Support standard EJS tags (<%= %> for values, <%- %> for unescaped HTML, and <% %> for script logic).
 */
function renderTemplate(templateName, data) {
    const templatesDir = path_1.default.join(__dirname, '../templates');
    const layoutPath = path_1.default.join(templatesDir, 'layout.ejs');
    // Format template name to slug format (e.g. WELCOME_PARTNER -> welcome-partner)
    const filename = templateName.toLowerCase().replace(/_/g, '-');
    const templatePath = path_1.default.join(templatesDir, `${filename}.ejs`);
    if (!fs_1.default.existsSync(layoutPath)) {
        throw new Error(`Base layout template not found at: ${layoutPath}`);
    }
    if (!fs_1.default.existsSync(templatePath)) {
        throw new Error(`Email template file not found at: ${templatePath}`);
    }
    const layout = fs_1.default.readFileSync(layoutPath, 'utf8');
    const body = fs_1.default.readFileSync(templatePath, 'utf8');
    // Compile EJS template string into a functional javascript evaluator
    const compile = (html, locals) => {
        const parts = html.split(/(<%[\s\S]*?%>)/g);
        let functionBody = 'let result = ""; with(locals || {}) {\n';
        for (const part of parts) {
            if (!part)
                continue;
            if (part.startsWith('<%=')) {
                const code = part.substring(3, part.length - 2).trim();
                functionBody += `result += (typeof (${code}) !== 'undefined' ? (${code}) : "");\n`;
            }
            else if (part.startsWith('<%-')) {
                const code = part.substring(3, part.length - 2).trim();
                functionBody += `result += (typeof (${code}) !== 'undefined' ? (${code}) : "");\n`;
            }
            else if (part.startsWith('<%')) {
                const code = part.substring(2, part.length - 2).trim();
                functionBody += `${code}\n`;
            }
            else {
                const escaped = part
                    .replace(/\\/g, '\\\\')
                    .replace(/`/g, '\\`')
                    .replace(/\$/g, '\\$');
                functionBody += `result += \`${escaped}\`;\n`;
            }
        }
        functionBody += '} return result;';
        try {
            const fn = new Function('locals', functionBody);
            return fn(locals);
        }
        catch (err) {
            console.error('EJS compilation failed. Function body generated:\n', functionBody);
            throw err;
        }
    };
    // Compile template body first
    const bodyHtml = compile(body, data);
    // Combine body into layout and compile full html
    const fullHtml = layout.replace(/<%- \s*body\s*%>/g, bodyHtml);
    return compile(fullHtml, { year: new Date().getFullYear(), ...data });
}
