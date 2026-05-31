const fs = require('fs');
const https = require('https');

const fontUrl = 'https://fonts.gstatic.com/s/cairo/v28/SLXVc1nY6HkvangqT0iEYvM.woff2';

https.get(fontUrl, (res) => {
    let data = [];
    res.on('data', chunk => data.push(chunk));
    res.on('end', () => {
        const buffer = Buffer.concat(data);
        const b64 = buffer.toString('base64');
        const content = `export const CAIRO_FONT_BASE64 = '${b64}';\n`;
        fs.writeFileSync('lib/utils/cairo-font.ts', content, 'utf8');
        console.log('Font downloaded and saved!');
    });
}).on('error', err => {
    console.error(err);
});
