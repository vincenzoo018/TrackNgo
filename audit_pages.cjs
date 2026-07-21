const fs = require('fs');
const path = require('path');

const pages = [
  'client/TrackDocument.tsx',
  'auth/login.tsx',
  'admin/Dashboard.tsx',
  'admin/documents/Documents.tsx',
  'admin/users/Index.tsx',
  'admin/system/SystemConfiguration.tsx',
  'admin/reports/Index.tsx',
  'admin/templates/Index.tsx',
  'admin/routing-slips/RoutingSlips.tsx',
  'receiving/Dashboard.tsx',
  'receiving/documents/Documents.tsx',
  'receiving/documents/Show.tsx',
  'receiving/documents/VersionHistory.tsx',
  'receiving/documents/ArtaTimeline.tsx',
  'receiving/documents/OcrWorkspace.tsx',
  'receiving/documents/LocationMap.tsx',
  'receiving/routing-slips/RoutingSlips.tsx',
  'receiving/audit-trail/AuditTrail.tsx',
  'department-head/Dashboard.tsx',
  'department-head/documents/Endorsements.tsx',
  'department-head/documents/ReviewAndActions.tsx',
  'department-head/workflow/Index.tsx',
  'department-head/signature/Index.tsx',
  'department-head/routing-slips/RoutingSlips.tsx',
  'mayor/Dashboard.tsx',
  'mayor/documents/FinalApproval.tsx',
  'mayor/signature/Index.tsx',
  'mayor/routing-slips/RoutingSlips.tsx',
  'cart/Dashboard.tsx',
  'cart/documents/Documents.tsx',
  'cart/escalations/ArtaEscalations.tsx',
  'cart/escalations/Documents.tsx',
  'cart/notifications/SmsDashboard.tsx',
  'cart/audit-trail/AuditTrail.tsx',
  'cart/reports/Index.tsx',
  'cart/routing-slips/RoutingSlips.tsx'
];

let missing = [];
pages.forEach(p => {
  const fullPath = path.join('c:/Users/Huawei/TrackNgo/resources/js/pages', p);
  if (!fs.existsSync(fullPath)) {
    missing.push(p);
  }
});

console.log("Missing components mapped in web.php:", missing);

// Check nav files
const navDir = 'c:/Users/Huawei/TrackNgo/resources/js/config/nav';
const navFiles = fs.readdirSync(navDir).filter(f => f.endsWith('.ts'));

console.log("\\nNav files audit:");
navFiles.forEach(file => {
  const content = fs.readFileSync(path.join(navDir, file), 'utf8');
  const regex = /href:\s*'([^']+)'/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    let route = match[1];
    // Check if route exists in web.php
    // Simple check: web.php has Route::get('...
    // Actually just print out all the routes defined in nav files for manual review
    console.log(`[${file}] -> ${route}`);
  }
});
