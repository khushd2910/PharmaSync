from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv(os.path.join(os.getcwd(), '.env'))
uri = os.getenv('MONGO_URI')
print('MONGO_URI', uri)
client = MongoClient(uri)
db = client.get_default_database()

# sample 20 distinct medicine IDs from orders/possales
ids = set()
for row in db.orders.aggregate([
    {'$unwind': '$items'},
    {'$group': {'_id': '$items.medicine', 'name': {'$first': '$items.name'}}},
    {'$limit': 20}
]):
    ids.add(row['_id'])
    print('order id', row['_id'], 'name', row['name'], 'exists', db.medicines.count_documents({'_id': row['_id']}))

for row in db.possales.aggregate([
    {'$unwind': '$items'},
    {'$group': {'_id': '$items.medicine', 'name': {'$first': '$items.name'}}},
    {'$limit': 20}
]):
    ids.add(row['_id'])
    print('pos id', row['_id'], 'name', row['name'], 'exists', db.medicines.count_documents({'_id': row['_id']}))

print('total sample ids', len(ids))
print('total orders unique medicine IDs', next(db.orders.aggregate([{'$unwind': '$items'},{'$group': {'_id': '$items.medicine'}},{'$count': 'n'}]), {'n':0})['n'])
print('total possales unique medicine IDs', next(db.possales.aggregate([{'$unwind': '$items'},{'$group': {'_id': '$items.medicine'}},{'$count': 'n'}]), {'n':0})['n'])

# check if sample names correspond to any medicine doc by name
for row in db.orders.aggregate([
    {'$unwind': '$items'},
    {'$group': {'_id': '$items.medicine', 'name': {'$first': '$items.name'}}},
    {'$limit': 10}
]):
    name = row['name']
    count = db.medicines.count_documents({'name': name})
    print('order name', name, 'matching medicines by name', count)

for row in db.possales.aggregate([
    {'$unwind': '$items'},
    {'$group': {'_id': '$items.medicine', 'name': {'$first': '$items.name'}}},
    {'$limit': 10}
]):
    name = row['name']
    count = db.medicines.count_documents({'name': name})
    print('pos name', name, 'matching medicines by name', count)
