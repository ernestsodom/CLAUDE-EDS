// Arma la página publicada en Vercel: envuelve maqueta/index.html con el documento HTML completo.
const fs = require('fs'), path = require('path');
const body = fs.readFileSync(path.join(__dirname, 'maqueta/index.html'), 'utf8');
const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`;
fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'public/index.html'), html);
console.log('public/index.html listo');
