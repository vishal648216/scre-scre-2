const BASE = "http://localhost:3008";
const USER = "super-admin";
const PASS = "Aditya@99918";
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=== Step 0: Login ===");
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const loginJson = await loginRes.json();
  console.log("  login status:", loginRes.status, loginJson.success, loginJson.message);
  if (!loginJson.success) process.exit(1);
  const TOKEN = loginJson.token;
  const AUTH = { Authorization: `Bearer ${TOKEN}` };

  console.log("\n=== Step 1: List eligible students ===");
  const listRes = await fetch(`${BASE}/api/admin/marksheets/eligible`, { headers: AUTH });
  const students = await listRes.json();
  const list = Array.isArray(students) ? students : students.items || [];
  console.log(`  eligible count: ${list.length}`);
  const targets = [];
  for (let i = 0; i < Math.min(list.length, 6); i++) {
    const s = list[i];
    const sid = s.id || s.student_id || (s._id && s._id.$oid) || s._id;
    const displayName = s.full_name || s.student_name || s.registration_number || "?";
    const attempts = s.attempts || [];
    console.log(`  [${i}] sid=${sid} name=${displayName} attempts=${attempts.length}`);
    for (const a of attempts) {
      console.log(`      attempt#${a.attempt_number}: marksheet_id=${a.marksheet_id || "-"} certificate_id=${a.certificate_id || "-"}`);
      targets.push({
        sid,
        student_name: displayName,
        attempt: a.attempt_number,
        marksheet_id: a.marksheet_id || null,
        certificate_id: a.certificate_id || null,
      });
    }
  }

  if (targets.length === 0) {
    console.error("No student attempts available");
    process.exit(1);
  }

  // Pick targets: try to find at least one with existing doc (for /download/:id)
  // and at least one fresh student for generate+download.
  let existingCertTarget = targets.find(t => t.certificate_id);
  let existingMsTarget = targets.find(t => t.marksheet_id);
  let anyTarget = targets[0];
  let altTarget = targets[Math.min(1, targets.length - 1)];

  console.log("\n=== Step 2: Download EXISTING marksheet via CORRECT route (/api/marksheets/:id/download) ===");
  if (existingMsTarget) {
    const url = `${BASE}/api/marksheets/${existingMsTarget.marksheet_id}/download`;
    console.log("  GET", url);
    const res = await fetch(url, { headers: AUTH, redirect: "follow" });
    console.log("  status:", res.status, "content-type:", res.headers.get("content-type"), "length:", res.headers.get("content-length"));
    if (res.ok && res.headers.get("content-type")?.includes("pdf")) {
      const blob = await res.blob();
      console.log("  ✅ SUCCESS: PDF size =", blob.size, "bytes");
      fs.writeFileSync(`/tmp/dl_existing_marksheet.pdf`, Buffer.from(await blob.arrayBuffer()));
    } else {
      const txt = await res.text();
      console.log("  ❌ FAIL, response:", txt.slice(0, 400));
    }
  } else {
    console.log("  SKIP (no existing marksheet_id in list)");
  }

  console.log("\n=== Step 3: Download EXISTING certificate via CORRECT route (/api/certificates/download/:id) ===");
  if (existingCertTarget) {
    const url = `${BASE}/api/certificates/download/${existingCertTarget.certificate_id}`;
    console.log("  GET", url);
    const res = await fetch(url, { headers: AUTH, redirect: "follow" });
    console.log("  status:", res.status, "content-type:", res.headers.get("content-type"), "length:", res.headers.get("content-length"));
    if (res.ok && res.headers.get("content-type")?.includes("pdf")) {
      const blob = await res.blob();
      console.log("  ✅ SUCCESS: PDF size =", blob.size, "bytes");
      fs.writeFileSync(`/tmp/dl_existing_certificate.pdf`, Buffer.from(await blob.arrayBuffer()));
    } else {
      const txt = await res.text();
      console.log("  ❌ FAIL, response:", txt.slice(0, 400));
    }
  } else {
    console.log("  SKIP (no existing certificate_id in list)");
  }

  console.log("\n=== Step 4: GENERATE + DOWNLOAD Certificate (on-demand admin endpoint, kind=certificate) ===");
  {
    const t = anyTarget;
    const qs = new URLSearchParams({ kind: "certificate", attempt: String(t.attempt) });
    const url = `${BASE}/api/admin/students/${t.sid}/documents/download?${qs.toString()}`;
    console.log("  GET", url);
    const startTs = Date.now();
    const res = await fetch(url, { headers: AUTH, redirect: "follow" });
    console.log(`  time: ${Date.now() - startTs}ms`);
    console.log("  final url:", res.url);
    console.log("  status:", res.status, "content-type:", res.headers.get("content-type"), "length:", res.headers.get("content-length"));
    if (res.ok && res.headers.get("content-type")?.includes("pdf")) {
      const blob = await res.blob();
      console.log("  ✅ SUCCESS: Generated PDF size =", blob.size, "bytes");
      fs.writeFileSync(`/tmp/dl_gen_certificate.pdf`, Buffer.from(await blob.arrayBuffer()));
      console.log("     written to /tmp/dl_gen_certificate.pdf");
    } else {
      const txt = await res.text();
      console.log("  ❌ FAIL, response:", txt.slice(0, 1200));
    }
  }

  console.log("\n=== Step 5: GENERATE + DOWNLOAD Marksheet (on-demand admin endpoint, kind=marksheet) ===");
  {
    const t = altTarget;
    const qs = new URLSearchParams({ kind: "marksheet", attempt: String(t.attempt) });
    const url = `${BASE}/api/admin/students/${t.sid}/documents/download?${qs.toString()}`;
    console.log("  GET", url);
    const startTs = Date.now();
    const res = await fetch(url, { headers: AUTH, redirect: "follow" });
    console.log(`  time: ${Date.now() - startTs}ms`);
    console.log("  final url after redirect:", res.url);
    console.log("  status:", res.status, "content-type:", res.headers.get("content-type"), "length:", res.headers.get("content-length"));
    if (res.ok && res.headers.get("content-type")?.includes("pdf")) {
      const blob = await res.blob();
      console.log("  ✅ SUCCESS: Generated PDF size =", blob.size, "bytes");
      fs.writeFileSync(`/tmp/dl_gen_marksheet.pdf`, Buffer.from(await blob.arrayBuffer()));
      console.log("     written to /tmp/dl_gen_marksheet.pdf");
      // Verify redirect target route was the correct marksheet URL (not certificate)
      if (res.url.includes("/marksheets/") && res.url.endsWith("/download")) {
        console.log("  ✅ REDIRECT VERIFIED: correctly went to /api/marksheets/:id/download");
      } else if (res.url.includes("/certificates/download/")) {
        console.log("  ⚠️  REDIRECT WENT TO CERTIFICATE ROUTE (old behavior)");
      } else {
        console.log("  ℹ️  Redirect was to:", res.url);
      }
    } else {
      const txt = await res.text();
      console.log("  ❌ FAIL, response:", txt.slice(0, 1200));
    }
  }

  console.log("\n=== Step 6: Reload eligible list to confirm generate endpoints stored IDs (so existing buttons now appear) ===");
  const list2Res = await fetch(`${BASE}/api/admin/marksheets/eligible`, { headers: AUTH });
  const list2 = Array.isArray(await list2Res.json()) ? await list2Res.json() : (await list2Res.json()).items || [];
  let msAdded = 0, certAdded = 0;
  for (const s of list2) {
    for (const a of (s.attempts || [])) {
      if (a.marksheet_id) msAdded++;
      if (a.certificate_id) certAdded++;
    }
  }
  const origMs = targets.filter(t=>t.marksheet_id).length;
  const origCert = targets.filter(t=>t.certificate_id).length;
  console.log(`  marksheet IDs now present: ${msAdded} (was ${origMs} in first load)`);
  console.log(`  certificate IDs now present: ${certAdded} (was ${origCert} in first load)`);
  if (msAdded > origMs || certAdded > origCert) {
    console.log("  ✅ IDs persisted in DB -> existing download buttons now appear");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
