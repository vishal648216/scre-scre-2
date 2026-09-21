const fs = require('fs');

const app = fs.readFileSync('src/App.tsx', 'utf8');
const layout = fs.readFileSync('src/components/DashboardLayout.tsx', 'utf8');

// extract routes from App.tsx
const routeRegex = /<Route\s+path=["']([^"']+)["']/g;
const routes = new Set();
let match;
while ((match = routeRegex.exec(app)) !== null) {
  routes.add(match[1]);
}

// extract hrefs from DashboardLayout.tsx
const hrefRegex = /href:\s*["']([^"']+)["']/g;
const links = [];
while ((match = hrefRegex.exec(layout)) !== null) {
  links.push(match[1]);
}

console.log('Total App.tsx routes:', routes.size);
console.log('Total DashboardLayout hrefs:', links.length);

const missing = [];
for (const link of links) {
  let matched = routes.has(link);
  if (!matched) {
    for (const r of routes) {
      const pattern = new RegExp('^' + r.replace(/:[^\s/]+/g, '[^/]+') + '$');
      if (pattern.test(link)) {
        matched = true;
        break;
      }
    }
  }
  if (!matched) {
    missing.push(link);
  }
}

console.log('Missing routes in DashboardLayout:', JSON.stringify(missing, null, 2));
