import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from pymongo import MongoClient

# Attempt to import sklearn
try:
    from sklearn.ensemble import RandomForestRegressor
except ImportError:
    # If not installed yet, it will fail gracefully when imported, but we'll import it inside the training function.
    pass

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

LOOKBACK_DAYS = 90  # 90 days of history is optimal for short-term demand forecasting
RESULT_COLLECTION = 'demand_forecasts'

def get_db():
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        sys.exit('MONGO_URI is not set.')
    client = MongoClient(mongo_uri)
    return client.get_default_database()

def load_sales_df(db, since):
    """
    Load POS sales and online orders and flatten them.
    """
    online_rows = list(db.orders.aggregate([
        {'$match': {'orderStatus': {'$ne': 'Cancelled'}, 'createdAt': {'$gte': since}}},
        {'$unwind': '$items'},
        {'$project': {
            '_id': 0,
            'date': '$createdAt',
            'medicineId': '$items.medicine',
            'quantity': '$items.quantity',
        }},
    ]))
    pos_rows = list(db.possales.aggregate([
        {'$match': {'status': {'$ne': 'Refunded'}, 'createdAt': {'$gte': since}}},
        {'$unwind': '$items'},
        {'$project': {
            '_id': 0,
            'date': '$createdAt',
            'medicineId': '$items.medicine',
            'quantity': '$items.quantity',
        }},
    ]))

    rows = online_rows + pos_rows
    if not rows:
        return pd.DataFrame(columns=['date', 'medicineId', 'quantity'])
    
    df = pd.DataFrame(rows)
    df['medicineId'] = df['medicineId'].astype(str)
    df['date'] = pd.to_datetime(df['date'], utc=True).dt.tz_localize(None)
    df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)
    return df

def generate_forecast():
    db = get_db()
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=LOOKBACK_DAYS)
    
    # Load active medicines
    cursor = db.medicines.find({'isDiscontinued': {'$ne': True}}, {'name': 1, 'stock': 1})
    medicines = {str(m['_id']): {'name': m['name'], 'stock': int(m.get('stock', 0))} for m in cursor}
    
    # Load historical sales
    sales_df = load_sales_df(db, since)
    
    predictions = []
    
    # Define date range for continuous series
    date_index = pd.date_range(start=since.date(), end=now.date(), freq='D')
    
    for med_id, med_info in medicines.items():
        name = med_info['name']
        current_stock = med_info['stock']
        
        # Filter sales for this medicine
        med_sales = sales_df[sales_df['medicineId'] == med_id] if not sales_df.empty else pd.DataFrame()
        
        if med_sales.empty:
            # Baseline: zero historical sales
            weekly_demand = 0.0
        else:
            # Build daily series
            daily_series = med_sales.groupby(med_sales['date'].dt.date)['quantity'].sum().reindex(date_index.date, fill_value=0.0)
            total_sold = daily_series.sum()
            
            if total_sold < 5:
                # Baseline forecast if historical sample is too small
                weekly_demand = float((total_sold / LOOKBACK_DAYS) * 7)
            else:
                # Proper Machine Learning Pipeline using RandomForestRegressor
                try:
                    df_med = pd.DataFrame({'sales': daily_series.values}, index=daily_series.index)
                    # Feature Engineering: Lag & Calendar features
                    df_med['day_of_week'] = pd.to_datetime(df_med.index).dayofweek
                    df_med['day_of_month'] = pd.to_datetime(df_med.index).day
                    df_med['lag_1'] = df_med['sales'].shift(1)
                    df_med['lag_2'] = df_med['sales'].shift(2)
                    df_med['lag_7'] = df_med['sales'].shift(7)
                    df_med['rolling_mean_7'] = df_med['sales'].shift(1).rolling(window=7).mean()
                    
                    df_med = df_med.dropna()
                    
                    if len(df_med) < 10:
                        # Fallback to mean if not enough feature rows
                        weekly_demand = float((total_sold / LOOKBACK_DAYS) * 7)
                    else:
                        X = df_med[['day_of_week', 'day_of_month', 'lag_1', 'lag_2', 'lag_7', 'rolling_mean_7']]
                        y = df_med['sales']
                        
                        # Train Model
                        model = RandomForestRegressor(n_estimators=30, max_depth=5, random_state=42)
                        model.fit(X, y)
                        
                        # Autoregressive Forecasting for the next 7 days
                        last_row = df_med.iloc[-1]
                        history = list(df_med['sales'].values)
                        forecast_dates = pd.date_range(start=now.date() + timedelta(days=1), periods=7, freq='D')
                        
                        forecasted_sales = []
                        for i, f_date in enumerate(forecast_dates):
                            # Construct lag and rolling features dynamically from history
                            lag1 = history[-1]
                            lag2 = history[-2]
                            lag7 = history[-7]
                            roll7 = np.mean(history[-7:])
                            
                            feat = pd.DataFrame([{
                                'day_of_week': f_date.dayofweek,
                                'day_of_month': f_date.day,
                                'lag_1': lag1,
                                'lag_2': lag2,
                                'lag_7': lag7,
                                'rolling_mean_7': roll7
                            }])
                            
                            pred = float(model.predict(feat)[0])
                            pred = max(0.0, pred)  # Sales cannot be negative
                            forecasted_sales.append(pred)
                            history.append(pred)  # Feed prediction back to history for next steps
                            
                        weekly_demand = sum(forecasted_sales)
                except Exception as e:
                    # Fallback to average on any training exception
                    weekly_demand = float((total_sold / LOOKBACK_DAYS) * 7)
        
        # Round prediction
        weekly_demand = round(weekly_demand, 2)
        restock_suggested = weekly_demand > current_stock
        suggested_qty = int(np.ceil(weekly_demand - current_stock)) if restock_suggested else 0
        
        predictions.append({
            'medicineId': med_id,
            'name': name,
            'currentStock': current_stock,
            'predictedWeeklyDemand': weekly_demand,
            'suggestedRestockQty': suggested_qty,
            'restockSuggested': restock_suggested
        })
        
    # Sort predictions: restock suggested first, then highest predicted demand
    predictions.sort(key=lambda x: (not x['restockSuggested'], -x['predictedWeeklyDemand']))
    
    result = {
        'generatedAt': datetime.now(timezone.utc),
        'predictions': predictions  # Full set — the dashboard paginates through these
    }
    
    db[RESULT_COLLECTION].insert_one(result)
    return result

if __name__ == '__main__':
    res = generate_forecast()
    print(f"[demand_forecasting] Forecast generated at {res['generatedAt'].isoformat()}. "
          f"Generated predictions for {len(res['predictions'])} medicines.")
