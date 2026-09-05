import { listDemos, updateDemo } from "../lib/db.ts";
import type { DemoInput } from "../lib/fields.ts";

function classify(company: string) {
  const name = company.toLowerCase();
  if (/(roof|siding|chimney|solar)/.test(name)) return "Roofing";
  if (/(heating|cooling|hvac|air conditioning|heat and air| air\b|mechanical|climate|duct)/.test(name)) return "HVAC";
  if (/(plumbing|water heater)/.test(name)) return "Plumbing";
  if (/(remodel|home solutions|home remodeling)/.test(name)) return "Remodeling";
  if (/(construction|contracting|contractor|development|built)/.test(name)) return "Construction";
  if (/(energy|oil)/.test(name)) return "Energy";
  if (/(winsupply|supply)/.test(name)) return "Distributor";
  return "Other";
}

let updated = 0;
for (const demo of listDemos()) {
  const vertical = classify(demo.company);
  if (demo.vertical === vertical) continue;
  updateDemo(demo.id, { vertical } satisfies Partial<DemoInput>);
  updated++;
}

console.log(`Classified ${updated} demo verticals.`);
