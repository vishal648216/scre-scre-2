
db = db.getSiblingDB("scre_db");

const studentId = ObjectId('69e7a10f2607bec72e1cff1a');
const centerId = ObjectId('69b83909ff0e34c7c2353548');
const adcaCourseId = ObjectId("69b82218ff0e34c7c235353c");
const sessionId = ObjectId('69d62e4d5e7e086ab0db7cd2');

const blueprints = db.exam_blueprints.find({course_id: adcaCourseId}).toArray();

console.log(`Found ${blueprints.length} blueprints for ADCA`);

// Clear existing papers for these blueprints for this student
const blueprintIds = blueprints.map(b => b._id);
const deleteResult = db.student_papers.deleteMany({
    student_id: studentId,
    blueprint_id: { $in: blueprintIds }
});
console.log(`Deleted ${deleteResult.deletedCount} existing papers`);

for (const bp of blueprints) {
    console.log(`Processing blueprint: ${bp.name}`);
    
    // Fetch questions from bank
    const questionsInBank = db.qb_questions.find({ bank_id: bp.bank_id }).toArray();
    console.log(`  Found ${questionsInBank.length} questions in bank`);
    
    if (questionsInBank.length === 0) {
        console.log(`  Skipping ${bp.name} because no questions found in bank`);
        continue;
    }

    // Determine how many questions to include (usually defined in blueprint rules, but we can just take 20 or all if less)
    let questionsToIncludeCount = 20;
    if (bp.rules && bp.rules.length > 0) {
        questionsToIncludeCount = bp.rules.reduce((acc, r) => acc + (r.count || 0), 0);
    }
    if (questionsToIncludeCount === 0) questionsToIncludeCount = 20;
    
    const selectedQuestions = questionsInBank.slice(0, questionsToIncludeCount);
    
    // Target marks: 13-15
    const targetMarks = 13 + Math.floor(Math.random() * 3);
    console.log(`  Target marks: ${targetMarks}`);
    
    let currentMarks = 0;
    const paperQuestions = selectedQuestions.map((q, idx) => {
        const isCorrect = currentMarks < targetMarks;
        if (isCorrect) currentMarks += (q.marks || 1);
        
        return {
            question_id: q._id,
            question_text: q.question_text,
            options_pool: q.options_pool,
            correct_option_id: q.correct_option_id,
            student_response: isCorrect ? q.correct_option_id : (q.options_pool.find(o => o.id !== q.correct_option_id)?.id || "wrong"),
            marks: q.marks || 1,
            is_correct: isCorrect,
            obtained_marks: isCorrect ? (q.marks || 1) : 0
        };
    });

    const paper = {
        student_id: studentId,
        blueprint_id: bp._id,
        center_id: centerId,
        session_id: sessionId,
        course_id: adcaCourseId,
        subject_id: bp.subject_id, // Might be undefined but that's okay
        status: "Evaluated",
        total_obtained_marks: currentMarks,
        total_marks: bp.total_marks,
        questions: paperQuestions,
        created_at: new Date(),
        submitted_at: new Date(),
        evaluated_at: new Date(),
        attempt_number: 1
    };

    const result = db.student_papers.insertOne(paper);
    console.log(`  Paper created with ID: ${result.insertedId} and marks: ${currentMarks}`);
}
