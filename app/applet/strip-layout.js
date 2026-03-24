const fs = require('fs');

const files = [
  'app/admin/audit/page.tsx',
  'app/admin/operators/page.tsx',
  'app/admin/incidents/page.tsx',
  'app/admin/page.tsx',
  'app/admin/vehicles/page.tsx',
  'app/admin/settings/page.tsx',
  'app/portal/operators/[id]/page.tsx',
  'app/portal/operators/new/page.tsx',
  'app/portal/operators/page.tsx',
  'app/portal/vehicles/page.tsx',
  'app/portal/incidents/page.tsx',
  'app/portal/badges/page.tsx',
  'app/portal/page.tsx',
  'app/driver/consent/page.tsx',
  'app/driver/vehicle/page.tsx',
  'app/driver/status/page.tsx',
  'app/driver/profile/page.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace outer layout wrappers
  content = content.replace(/<div className="flex min-h-screen flex-col bg-slate-50">[\s\S]*?<main className="flex-1 container mx-auto px-4 py-8( max-w-[a-z0-9]+)?">/g, '<div className="container mx-auto$1">');
  content = content.replace(/<div className="flex min-h-screen flex-col bg-slate-50">[\s\S]*?<main className="flex-1 container mx-auto px-4 py-8 md:py-12 flex items-center justify-center">/g, '<div className="container mx-auto flex items-center justify-center min-h-[80vh]">');
  
  // Replace closing tags
  content = content.replace(/<\/main>\s*<\/div>/g, '</div>');
  
  fs.writeFileSync(file, content);
  console.log('Processed', file);
});
