import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

mongo_uri = os.getenv('MONGO_URI')
print(f"MONGO_URI resolved to: {mongo_uri}")

client = MongoClient(mongo_uri)
db = client.get_default_database()
print(f"Connected to database: {db.name}")

total = db.medicines.count_documents({})
active = db.medicines.count_documents({'isDiscontinued': {'$ne': True}})

print(f"Total medicines: {total}")
print(f"Active (isDiscontinued != True): {active}")