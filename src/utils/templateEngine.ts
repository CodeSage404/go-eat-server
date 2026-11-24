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

  const cloudCdnBase = 'https://res.cloudinary.com/dqtjja88b/image/upload/go_eat_email';
  const serverBaseUrl = (process.env.RENDER_EXTERNAL_URL || process.env.SERVER_BASE_URL || 'https://api.goeatone.com').replace(/\/$/, '');
  const emailAssetsUrl = cloudCdnBase;

  // Master component metadata defaults for templates
  const templateHeroMeta: Record<string, { title: string; subtitle?: string; hideHeaderTitle?: boolean }> = {
    'welcome-user': {
      title: 'Welcome',
      hideHeaderTitle: true,
    },
    'welcome-partner': {
      title: 'Welcome, partner',
      hideHeaderTitle: true,
    },
    'vendor-order-received': {
      title: 'New Order Received',
      subtitle: data.orderId ? `ORDER NO: #${String(data.orderId).slice(-8).toUpperCase()}` : 'NEW ORDER',
      hideHeaderTitle: true,
    },
    'partner-application-received': {
      title: 'Application Received',
      hideHeaderTitle: true,
    },
    'rider-application-received': {
      title: 'Courier Application Received',
      hideHeaderTitle: true,
    },
    'rider-application-approved': {
      title: 'Courier Application Approved',
      hideHeaderTitle: true,
    },
    'rider-action-required': {
      title: 'Action Required',
      hideHeaderTitle: true,
    },
    'subscription-confirmation': {
      title: 'Subscription Confirmed',
      hideHeaderTitle: true,
    },
    'credentials-alert': {
      title: 'Account Credentials',
      hideHeaderTitle: true,
    },
    'order-confirmed': {
      title: 'Order Confirmed',
      subtitle: data.orderId ? `ORDER NO: #${String(data.orderId).slice(-8).toUpperCase()}` : 'ORDER CONFIRMED',
    },
    'order-on-the-way': {
      title: 'Rider En Route',
      subtitle: data.orderId ? `ORDER NO: #${String(data.orderId).slice(-8).toUpperCase()}` : 'COURIER DISPATCHED',
    },
    'otp-verification': {
      title: 'Verify Your Account',
      subtitle: 'ONE-TIME SECURITY PASSCODE',
    },
    'withdrawal-receipt': {
      title: 'Payout Processed',
      subtitle: data.reference ? `REF NO: #${data.reference}` : 'TRANSACTION SETTLED',
    },
    'password-reset': {
      title: 'Reset Your Password',
      subtitle: 'ACCOUNT SECURITY',
    },
    'new-device-login': {
      title: 'New Device Login',
      subtitle: 'SECURITY ALERT',
    },
    'bank-update-alert': {
      title: 'Bank Details Updated',
      subtitle: 'WALLET SECURITY NOTICE',
    },
    'pin-reset-alert': {
      title: 'Security PIN Reset',
      subtitle: 'WALLET SECURITY NOTICE',
    },
    'order-preparing': {
      title: 'Kitchen Is Cooking',
      subtitle: data.orderId ? `ORDER NO: #${String(data.orderId).slice(-8).toUpperCase()}` : 'IN PREPARATION',
    },
    'order-picked-up': {
      title: 'Order Picked Up',
      subtitle: data.orderId ? `ORDER NO: #${String(data.orderId).slice(-8).toUpperCase()}` : 'EN ROUTE TO YOU',
    },
    'order-accepted': {
      title: 'Order Accepted',
      subtitle: data.orderId ? `ORDER NO: #${String(data.orderId).slice(-8).toUpperCase()}` : 'ACCEPTED BY RESTAURANT',
    },
    'admin-partner-submission-alert': {
      title: 'New Partner Application',
      subtitle: 'ADMIN ALERT',
    },
    'admin-rider-submission-alert': {
      title: 'New Courier Application',
      subtitle: 'ADMIN ALERT',
    },
    'inactivity-reengagement': {
      title: 'We Miss You',
      subtitle: 'SPECIAL OFFER',
    },
  };

  const defaultMeta = templateHeroMeta[filename] || {
    title: data.subject || data.title || '',
    subtitle: '',
    hideHeaderTitle: true,
  };

  const commonLocals = {
    year: new Date().getFullYear(),
    serverBaseUrl,
    emailAssetsUrl,
    heroTitle: data.heroTitle || defaultMeta.title,
    heroSubtitle: data.heroSubtitle || defaultMeta.subtitle,
    hideHeaderTitle: data.hideHeaderTitle ?? defaultMeta.hideHeaderTitle,
    ...data,
  };

  // If the template is an entire standalone document (like welcome-partner.ejs which starts with <!DOCTYPE html>)
  if (body.includes('<!DOCTYPE html>')) {
    return compile(body, commonLocals);
  }

  // Compile template body first
  const bodyHtml = compile(body, commonLocals);

  // Combine body into layout and compile full html
  const fullHtml = layout.replace(/<%- \s*body\s*%>/g, bodyHtml);
  return compile(fullHtml, commonLocals);
}
