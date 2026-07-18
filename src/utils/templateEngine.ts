import fs from 'fs';
import path from 'path';

/**
 * Custom EJS-compatible template compiler that avoids external npm package downloads.
 * Support standard EJS tags (<%= %> for values, <%- %> for unescaped HTML, and <% %> for script logic).
 */
export function renderTemplate(templateName: string, data: Record<string, any>): string {
  const templatesDir = path.join(__dirname, '../templates');
  const layoutPath = path.join(templatesDir, 'layout.ejs');
  
  // Format template name to slug format (e.g. WELCOME_PARTNER -> welcome-partner)
  const filename = templateName.toLowerCase().replace(/_/g, '-');
  const templatePath = path.join(templatesDir, `${filename}.ejs`);

  if (!fs.existsSync(layoutPath)) {
    throw new Error(`Base layout template not found at: ${layoutPath}`);
  }
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template file not found at: ${templatePath}`);
  }

  const layout = fs.readFileSync(layoutPath, 'utf8');
  const body = fs.readFileSync(templatePath, 'utf8');

  // Compile EJS template string into a functional javascript evaluator
  const compile = (html: string, locals: Record<string, any>) => {
    const parts = html.split(/(<%[\s\S]*?%>)/g);
    let functionBody = 'let result = ""; with(locals || {}) {\n';

    for (const part of parts) {
      if (!part) continue;
      
      if (part.startsWith('<%=')) {
        const code = part.substring(3, part.length - 2).trim();
        functionBody += `result += (typeof (${code}) !== 'undefined' ? (${code}) : "");\n`;
      } else if (part.startsWith('<%-')) {
        const code = part.substring(3, part.length - 2).trim();
        functionBody += `result += (typeof (${code}) !== 'undefined' ? (${code}) : "");\n`;
      } else if (part.startsWith('<%')) {
        const code = part.substring(2, part.length - 2).trim();
        functionBody += `${code}\n`;
      } else {
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
    } catch (err: any) {
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
