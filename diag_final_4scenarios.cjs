const BASE = "http://localhost:3008";
const USER = "super-admin";
const PASS = "Aditya@99918";
const fs = require("fs");

async function main() {
  console.log("=== Login ===");
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const loginJson = await loginRes.json();
  console.log("  OK:", loginRes.status, loginJson.success);
  const TOKEN = loginJson.token;
  const AUTH = { Authorization: `Bearer ${TOKEN}` };

  // Student s3 index 5: already has marksheet_id & certificate_id, so course+template match
  const sid = "6a3ebe37b1f438509f388f30";
  const attempt = 1;

  console.log("\n=== Generate + Download Marksheet kind=marksheet ===");
  console.log(`  student=${sid} attempt=${attempt}`);
  const msQs = new URLSearchParams({ kind: "marksheet", attempt: String(attempt) });
  const msUrl = `${BASE}/api/admin/students/${sid}/documents/download?${msQs.toString()}`;
  console.log("  GET", msUrl);
  const startMs = Date.now();
  const msRes = await fetch(msUrl, { headers: AUTH, redirect: "follow" });
  console.log(`  time: ${Date.now() - startMs}ms`);
  console.log("  final URL after redirect:", msRes.url);
  console.log("  status:", msRes.status, "type:", msRes.headers.get("content-type"));

  // Verify redirect target correctness
  const correctRedirect = msRes.url.includes("/marksheets/") && msRes.url.endsWith("/download");
  const wrongRedirect = msRes.url.includes("/certificates/download/");
  if (correctRedirect) console.log("  ✅ REDIRECT CORRECT → /api/marksheets/:id/download (our fix!)");
  else if (wrongRedirect) console.log("  ❌ REDIRECT WRONG → went to certificates route");
  else console.log("  ℹ️  Redirect URL:", msRes.url);

  if (msRes.ok && msRes.headers.get("content-type")?.includes("pdf")) {
    const blob = await msRes.blob();
    console.log("  ✅ MARK SHEET GENERATE + DOWNLOAD SUCCESS. PDF size:", blob.size, "bytes");
    fs.writeFileSync(`/tmp/dl_gen_marksheet_SUCCESS.pdf`, Buffer.from(await blob.arrayBuffer()));
    console.log("     saved to /tmp/dl_gen_marksheet_SUCCESS.pdf");
  } else {
    console.log("  ❌ FAIL. Body:");
    console.log((await msRes.text()).slice(0, 1500));
  }

  console.log("\n=== Generate + Download Certificate kind=certificate (same s3) ===");
  const certQs = new URLSearchParams({ kind: "certificate", attempt: String(attempt) });
  const certUrl = `${BASE}/api/admin/students/${sid}/documents/download?${certQs.toString()}`;
  console.log("  GET", certUrl);
  const startCert = Date.now();
  const certRes = await fetch(certUrl, { headers: AUTH, redirect: "follow" });
  console.log(`  time: ${Date.now() - startCert}ms`);
  console.log("  final URL after redirect:", certRes.url);
  console.log("  status:", certRes.status, "type:", certRes.headers.get("content-type"));
  if (certRes.ok && certRes.headers.get("content-type")?.includes("pdf")) {
    const blob = await certRes.blob();
    console.log("  ✅ CERTIFICATE GENERATE + DOWNLOAD SUCCESS. PDF size:", blob.size, "bytes");
    fs.writeFileSync(`/tmp/dl_gen_certificate_SUCCESS.pdf`, Buffer.from(await blob.arrayBuffer()));
  } else {
    console.log("  ❌ FAIL. Body:");
    console.log((await certRes.text()).slice(0, 1500));
  }

  console.log("\n=== Existing Download Re-test (freshly generated docs above) ===");
  const listRes = await fetch(`${BASE}/api/admin/marksheets/eligible`, { headers: AUTH });
  const listData = await listRes.json();
  const list = Array.isArray(listData) ? listData : listData.items || [];
  const s3 = list.find(s => (s.id || s.student_id || s._id?.$oid || s._id) === sid);
  if (!s3) { console.log("  s3 not found in list"); process.exit(0); }
  const att = (s3.attempts || []).find(a => a.attempt_number === attempt) || (s3.attempts || [])[0];
  console.log(`  s3 attempt#${attempt}: marksheet_id=${att?.marksheet_id || "N/A"}, certificate_id=${att?.certificate_id || "N/A"}`);

  if (att?.marksheet_id) {
    const url = `${BASE}/api/marksheets/${att.marksheet_id}/download`;
    console.log("  existing marksheet →", url);
    const r = await fetch(url, { headers: AUTH });
    if (r.ok && r.headers.get("content-type")?.includes("pdf")) {
      const b = await r.blob();
      console.log("    ✅ EXISTING MARK SHEET OK:", b.size, "bytes");
    } else {
      console.log("    ❌ EXISTING MARK SHEET FAIL:", r.status, (await r.text()).slice(0, 400));
    }
  }
  if (att?.certificate_id) {
    const url = `${BASE}/api/certificates/download/${att.certificate_id}`;
    console.log("  existing certificate →", url);
    const r = await fetch(url, { headers: AUTH });
    if (r.ok && r.headers.get("content-type")?.includes("pdf")) {
      const b = await r.blob();
      console.log("    ✅ EXISTING CERTIFICATE OK:", b.size, "bytes");
    } else {
      console.log("    ❌ EXISTING CERT FAIL:", r.status, (await r.text()).slice(0, 400));
    }
  }

  console.log("\n=== Files written to /tmp/ ===");
  for (const f of ["/tmp/dl_gen_marksheet_SUCCESS.pdf", "/tmp/dl_gen_certificate_SUCCESS.pdf", "/tmp/dl_existing_marksheet.pdf", "/tmp/dl_existing_certificate.pdf"]) {
    try { const st = fs.statSync(f); console.log(`  ${f} → ${st.size} bytes`); } catch {}
  }
}
main().catch(e => { console.error(e); process.exit(1); });
