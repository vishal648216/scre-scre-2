const { MongoClient, ObjectId } = require('mongodb');
const URI = 'mongodb://localhost:27017';
const DB = 'scre_db';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB);

  // Infer legacy markheet vs certificate by certificate_no prefix + file_path + course
  console.log('=== CERTIFICATE TYPE INFERENCE BY PATTERN ===');
  const certs = await db.collection('certificates').find({}).limit(20).toArray();
  let prefixes = new Map();
  for (const c of certs) {
    const no = c.certificate_no || '';
    const prefix = no.split('-')[0] || 'NO_PREFIX';
    prefixes.set(prefix, (prefixes.get(prefix) || 0) + 1);
  }
  const allPrefixes = new Map();
  await db.collection('certificates').find().forEach(c => {
    const p = (c.certificate_no || '').split('-')[0] || 'NO_PREFIX';
    allPrefixes.set(p, (allPrefixes.get(p) || 0) + 1);
  });
  console.log('certificate_no prefix distribution (all 102):', [...allPrefixes.entries()].sort((a,b)=>b[1]-a[1]).map(p=>`${p[0]}×${p[1]}`).join(', '));

  console.log('\n=== file_path values distribution ===');
  const fpGroups = new Map();
  await db.collection('certificates').find().forEach(c => {
    const fp = c.file_path;
    const key = fp ? (fp.startsWith('marksheets/') ? 'file_path=marksheets/*' : (fp.startsWith('certificates/') ? 'file_path=certificates/*' : 'file_path=OTHER('+fp+')')) : 'file_path=ABSENT';
    fpGroups.set(key, (fpGroups.get(key) || 0) + 1);
  });
  for (const [k, v] of fpGroups) console.log(`  ${k} ×${v}`);

  console.log('\n=== Infer marksheet/certificate by combining: file_path prefix + SC- prefix ===');
  // Logic: if file_path starts with marksheets/ OR certificate_no prefix === SC then MARKSHEET.
  // Otherwise CERTIFICATE (CERT-*, SCR-*, etc.)
  let inferredMarksheet = 0, inferredCertificate = 0;
  await db.collection('certificates').find().forEach(c => {
    const fp = c.file_path || '';
    const no = c.certificate_no || '';
    const isMarksheet = fp.startsWith('marksheets/') || no.startsWith('SC-');
    if (isMarksheet) inferredMarksheet++;
    else inferredCertificate++;
  });
  console.log(`  inferred MARKSHEET=${inferredMarksheet}, inferred CERTIFICATE=${inferredCertificate}`);

  console.log('\n=== check if exam_v2_paper_templates has any course_id / FK or can be joined to course ===');
  const templates = await db.collection('exam_v2_paper_templates').find({}).project({_id:1,name:1,subject_id:1,question_bank_id:1,course_id:1,blueprint_id:1}).limit(5).toArray();
  console.log('  total templates:', await db.collection('exam_v2_paper_templates').countDocuments());
  for (const t of templates) console.log(' ', JSON.stringify(t));

  console.log('\n=== exam_v2_paper_templates._id -> exam_v2_exams lookup (paper_id) ===');
  // For each evaluated v2_paper, use paper_template_id → does it match exam_v2_exams.paper_id?
  const papers = await db.collection('exam_v2_papers').find({}).toArray();
  for (const p of papers) {
    const tplId = p.paper_template_id;
    const matchedExams = await db.collection('exam_v2_exams').countDocuments({ paper_id: tplId });
    console.log(`  paper ${p._id.toHexString()} tplId=${tplId.toHexString()} exams with same paper_id: ${matchedExams}`);
    if (matchedExams) {
      const ex = await db.collection('exam_v2_exams').findOne({ paper_id: tplId }, { projection: { _id: 1, course_id: 1, exam_mode: 1 } });
      console.log('    -> candidate exam course_id:', ex?.course_id?.toHexString?.(), 'mode:', ex?.exam_mode);
    }
  }

  // Legacy v1 student_papers: does Evaluated status match to course_id via blueprint/subject?
  console.log('\n=== legacy v1 student_papers Evaluated status -> course_id? ===');
  const spEval = await db.collection('student_papers').find({ status: { $regex: 'evaluated', $options: 'i' } }).toArray();
  for (const p of spEval) {
    console.log('  sp._id=', p._id.toHexString(), 'keys:', Object.keys(p).filter(k=>/_id$/.test(k)).join(','), 'other fields:', Object.keys(p).join(','));
    const keys = Object.keys(p);
    for (const k of ['course','course_name','course_id','blueprint_id','allotment_id','student_id','subject_id']) {
      if (k in p) console.log(`    ${k}=`, typeof p[k] === 'object' && p[k]?.toHexString ? p[k].toHexString() : p[k]);
    }
    // Try course_exam_attempts for same student + some subject/course linkage
    const attempt = await db.collection('course_exam_attempts').findOne({ student_id: p.student_id }, { sort: { created_at: -1 } });
    if (attempt) console.log('    latest cea course_id=', attempt.course_id?.toHexString?.(), 'overall_result=', attempt.overall_result);
  }

  console.log('\n=== course_exam_attempts.overall_result case distribution ===');
  const resultCases = await db.collection('course_exam_attempts').aggregate([
    { $group: { _id: { $ifNull: ['$overall_result', '__NULL__'] }, count: { $sum: 1 } } }
  ]).toArray();
  for (const g of resultCases) console.log(`  overall_result="${g._id}" ×${g.count}`);

  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
