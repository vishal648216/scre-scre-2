import pymongo
from bson.objectid import ObjectId
from datetime import datetime

client = pymongo.MongoClient("mongodb://localhost:27017")
db = client["scre_db"]

# 1. Create Question Bank
bank = {
    "name": "test003",
    "created_at": datetime.utcnow()
}
bank_id = db.qb_banks.insert_one(bank).inserted_id
print(f"Created Question Bank 'test003' with ID: {bank_id}")

questions = []

# 2. Add 40 questions of 2 marks
for i in range(1, 41):
    questions.append({
        "bank_id": bank_id,
        "question_text": f"Test Question {i} (2 Marks)",
        "question_type": "MCQ",
        "marks": 2.0,
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correct_option_index": 0,
        "created_at": datetime.utcnow()
    })

# 3. Add 60 questions of 1 mark
for i in range(41, 101):
    questions.append({
        "bank_id": bank_id,
        "question_text": f"Test Question {i} (1 Mark)",
        "question_type": "MCQ",
        "marks": 1.0,
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correct_option_index": 0,
        "created_at": datetime.utcnow()
    })

# 4. Insert Questions
result = db.qb_questions.insert_many(questions)
print(f"Successfully added {len(result.inserted_ids)} questions to 'test003'.")
