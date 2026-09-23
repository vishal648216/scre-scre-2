const { MongoClient, ObjectId } = require('mongodb');

async function fixPaper() {
  const client = new MongoClient('mongodb://localhost:27017');
  try {
    await client.connect();
    const db = client.db('scre_db');
    const coll = db.collection('student_papers');

    const studentId = new ObjectId('69e7a10f2607bec72e1cff1a');
    const paper = await coll.findOne({ student_id: studentId });

    if (paper) {
      console.log('Found paper, fixing types...');
      
      // Update fields to correct types
      const update = {
        $set: {
          total_obtained_marks: 0.0,
          section_wise_marks: {},
          is_passed: null,
          practical_passed: null,
          assignment_passed: null,
          exam_passed: null,
          security_log: [],
          start_time: null,
          submit_time: null
        }
      };

      // Fix questions array
      const fixedQuestions = paper.questions.map(q => ({
        ...q,
        obtained_marks: 0.0,
        evaluation_status: q.evaluation_status || 'Pending'
      }));
      update.$set.questions = fixedQuestions;

      const result = await coll.updateOne({ _id: paper._id }, update);
      console.log('Update result:', result);
    } else {
      console.log('Paper not found for student');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

fixPaper();
