const fs = require("fs");
const p = "src/test/test-all.ts";
let s = fs.readFileSync(p, "utf8");
// expected array
s = s.replace(
  '"init_plan", "read_plan", "update_plan_section", "init_task", "init_agents_md", "task_create", "task_list",',
  '"init_plan", "read_plan", "update_plan_section", "init_task", "init_agents", "init_audit", "task_create", "task_list",'
);
// smoke test
s = s.replace(
  '// Smoke: webfetch_validate (no network) + task_update + init_agents_md + telemetry.',
  '// Smoke: webfetch_validate (no network) + task_update + init_agents + init_audit + telemetry.'
);
s = s.replace(
  'const ia = await ccall("init_agents_md", { project_root: ROOT });\n    check("init_agents_md works", ia.includes("path"), ia);',
  'const ia = await ccall("init_agents", { project_root: ROOT });\n    check("init_agents works", ia.includes("path"), ia);\n    const iau = await ccall("init_audit", { project_root: ROOT });\n    check("init_audit works", iau.includes("path"), iau);'
);
fs.writeFileSync(p, s);
console.log("done");
// verify
const l = s.split(/\r?\n/);
for (let i = 0; i < l.length; i++) if (l[i].includes('init_agents') || l[i].includes('init_audit')) console.log((i+1)+": "+l[i].trim());
