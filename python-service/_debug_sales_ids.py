from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv(os.path.join(os.getcwd(), '.env'))
uri = os.getenv('MONGO_URI')
print('MONGO_URI', uri)
client = MongoClient(uri)
db = client.get_default_database()

sample = []
for doc in db.possales.aggregate([
    {'$unwind': '$items'},
    {'$group': {'_id': '$items.medicine'}},
    {'$limit': 10}
]):
    sample.append(doc['_id'])
print('sample', sample)
print('exists', [db.medicines.count_documents({'_id': sid}) for sid in sample])
print('total unique sales medicine ids', next(db.possales.aggregate([
    {'$unwind': '$items'},
    {'$group': {'_id': '$items.medicine'}},
    {'$count': 'n'}
]), {'n': 0})['n'])
