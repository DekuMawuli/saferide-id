const fs = require('fs');

const files = [
  'app/admin/operators/page.tsx',
  'app/admin/page.tsx',
  'app/portal/operators/[id]/page.tsx',
  'app/portal/operators/new/page.tsx',
  'app/portal/page.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace the last </div> with </main></div>
  content = content.replace(/<\/div>\s*\);\s*}\s*$/g, '</main>\n    </div>\n  );\n}\n');
  
  fs.writeFileSync(file, content);
  console.log('Fixed', file);
});
