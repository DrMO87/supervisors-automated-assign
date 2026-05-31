const fs = require('fs');

const raw = fs.readFileSync('compressed_logos.json', 'utf8');
const data = JSON.parse(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw);

const code = `// Auto-generated Base64 image constants for reports

export const LOGO_DTU_BASE64 = '${data['logo-dtu.png']}';
export const LOGO_PHARMACY_BASE64 = '${data['logo-pharmacy.png']}';
export const LOGO_HUE_BASE64 = '${data['logo-hue.png']}';
export const LOGO_SESSION_MASTER_BASE64 = '${data['logo-session-master-transparent.png']}';
`;

fs.writeFileSync('lib/utils/logo-base64.ts', code, 'utf8');
console.log('Successfully updated logo-base64.ts');
