const { MongoClient, ObjectId } = require('mongodb');

async function run() {
    const uri = "mongodb://localhost:27017";
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db("scre_db");

        const studentId = new ObjectId("69ef5c51dbbd001e2044ba94");
        const courseId = new ObjectId("69ef5c51dbbd001e2044ba8a");
        const centerId = new ObjectId("69edcc3542b5fe7dbc24d100");

        // 1. Clean up
        console.log("Cleaning up old data...");
        await db.collection("qb_banks").deleteMany({});
        await db.collection("qb_questions").deleteMany({});
        await db.collection("exam_blueprints").deleteMany({});
        await db.collection("student_papers").deleteMany({});

        // 2. Get subjects
        const subjects = await db.collection("subjects").find({ status: "active" }).toArray();
        console.log(`Found ${subjects.length} subjects.`);

        for (const subject of subjects) {
            console.log(`Setting up subject: ${subject.subject_name}`);

            // a. Create Question Bank
            const qbResult = await db.collection("qb_banks").insertOne({
                name: `${subject.subject_name} Bank`,
                description: `Question bank for ${subject.subject_name}`,
                status: "active",
                created_at: new Date()
            });
            const bankId = qbResult.insertedId;

            // b. Create Questions (20 questions of 1 mark each)
            const questions = [];
            for (let i = 1; i <= 20; i++) {
                questions.push({
                    bank_id: bankId,
                    question_text: `Sample question ${i} for ${subject.subject_name}`,
                    question_type: "MCQ",
                    options: ["Option A", "Option B", "Option C", "Option D"],
                    correct_answer: "Option A",
                    marks: 1.0,
                    status: "active",
                    created_at: new Date()
                });
            }
            await db.collection("qb_questions").insertMany(questions);

            // c. Create Blueprint
            const blueprintResult = await db.collection("exam_blueprints").insertOne({
                name: `${subject.subject_name} Exam`,
                course_id: courseId,
                bank_id: bankId,
                subject_id: subject._id,
                total_marks: 20.0,
                minimum_marks: 7.0,
                duration_minutes: 60,
                max_attempts: 1,
                instructions: "Answer all questions.",
                mode: "Strict",
                exam_mode: "Online",
                rules: [
                    { marks: 1.0, count: 20 }
                ],
                status: "active",
                created_at: new Date()
            });
            const blueprintId = blueprintResult.insertedId;

            // d. Create Student Paper (Attempt)
            const marks = 13 + Math.floor(Math.random() * 4); // 13-16
            const paperQuestions = [];
            const allQs = await db.collection("qb_questions").find({ bank_id: bankId }).toArray();
            
            for (let i = 0; i < 20; i++) {
                paperQuestions.push({
                    section_id: "default",
                    question_id: allQs[i]._id,
                    order: i + 1,
                    student_response: i < marks ? "Option A" : "Option B",
                    obtained_marks: i < marks ? 1.0 : 0.0,
                    evaluation_status: "Evaluated"
                });
            }

            await db.collection("student_papers").insertOne({
                blueprint_id: blueprintId,
                student_id: studentId,
                center_id: centerId,
                subject_id: subject._id,
                status: "Submitted",
                start_window: new Date(),
                end_window: new Date(Date.now() + 86400000),
                start_time: new Date(),
                submit_time: new Date(),
                attempt_number: 1,
                total_obtained_marks: parseFloat(marks.toFixed(2)),
                is_passed: marks >= 7,
                questions: paperQuestions,
                created_at: new Date()
            });

            console.log(`Created attempt for ${subject.subject_name} with ${marks} marks.`);
        }

        console.log("All tasks completed successfully.");

    } finally {
        await client.close();
    }
}

run().catch(console.dir);
