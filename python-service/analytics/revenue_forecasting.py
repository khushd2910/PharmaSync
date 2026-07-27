import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

LOOKBACK_DAYS = 180  # Fetch 6 months of data for trend & seasonality detection
RESULT_COLLECTION = 'revenue_forecasts'

def get_db():
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        sys.exit('MONGO_URI is not set.')
    client = MongoClient(mongo_uri)
    return client.get_default_database()

def load_transactions_df(db, since):
    """
    Load daily total amounts from online orders and POS sales.
    """
    online_rows = list(db.orders.aggregate([
        {'$match': {'orderStatus': {'$ne': 'Cancelled'}, 'createdAt': {'$gte': since}}},
        {'$project': {
            '_id': 0,
            'date': '$createdAt',
            'amount': '$totalAmount',
        }},
    ]))
    pos_rows = list(db.possales.aggregate([
        {'$match': {'status': {'$ne': 'Refunded'}, 'createdAt': {'$gte': since}}},
        {'$project': {
            '_id': 0,
            'date': '$createdAt',
            'amount': '$totalAmount',
        }},
    ]))

    rows = online_rows + pos_rows
    if not rows:
        return pd.DataFrame(columns=['date', 'amount'])
    
    df = pd.DataFrame(rows)
    df['date'] = pd.to_datetime(df['date'], utc=True).dt.tz_localize(None)
    df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0.0)
    return df

def generate_forecast():
    db = get_db()
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=LOOKBACK_DAYS)
    
    df = load_transactions_df(db, since)
    
    # Define time index for continuous daily series
    date_index = pd.date_range(end=now.date(), periods=LOOKBACK_DAYS, freq='D')
    
    if df.empty:
        # Return empty baseline
        daily_series = pd.Series(0.0, index=date_index)
    else:
        # Group by day and sum
        daily_series = df.groupby(df['date'].dt.date)['amount'].sum().reindex(date_index.date, fill_value=0.0)
    
    # Store the last 30 days of actual revenue for the UI
    last_30_actual = daily_series.tail(30)
    historical_data = [
        {'date': date.strftime('%Y-%m-%d'), 'revenue': round(float(val), 2)}
        for date, val in last_30_actual.items()
    ]
    
    actual_last_30_days_sum = float(last_30_actual.sum())
    
    forecast_dates = pd.date_range(start=now.date() + timedelta(days=1), periods=30, freq='D')
    forecasted_values = []
    
    model_type = "Baseline (Mean)"
    
    # Try statsmodels Holt-Winters Exponential Smoothing
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        
        # Fit Holt-Winters with additive trend and weekly seasonality
        # We need at least 14 days of data to fit weekly seasonality (seasonal_periods=7)
        if len(daily_series) >= 14 and daily_series.sum() > 0:
            # We add a tiny amount of noise or ensure no strict constant to avoid optimization errors
            data_to_fit = daily_series.values + 1e-4
            model = ExponentialSmoothing(data_to_fit, trend='add', seasonal='add', seasonal_periods=7)
            fitted = model.fit(optimized=True)
            forecasted_values = list(fitted.forecast(30))
            model_type = "Holt-Winters Exponential Smoothing"
    except Exception as e:
        print(f"Statsmodels fit failed: {e}. Falling back to scikit-learn regression model.")
        
    # Fallback to scikit-learn Linear Regression if statsmodels failed or was missing
    if not forecasted_values:
        try:
            from sklearn.linear_model import LinearRegression
            
            df_reg = pd.DataFrame({'revenue': daily_series.values}, index=daily_series.index)
            # Create features
            df_reg['day_of_week'] = pd.to_datetime(df_reg.index).dayofweek
            df_reg['day_of_month'] = pd.to_datetime(df_reg.index).day
            df_reg['lag_1'] = df_reg['revenue'].shift(1)
            df_reg['lag_7'] = df_reg['revenue'].shift(7)
            
            df_reg = df_reg.dropna()
            
            if len(df_reg) >= 10:
                X = df_reg[['day_of_week', 'day_of_month', 'lag_1', 'lag_7']]
                y = df_reg['revenue']
                
                model = LinearRegression()
                model.fit(X, y)
                
                # Autoregressive forecasting
                history = list(daily_series.values)
                for f_date in forecast_dates:
                    lag1 = history[-1]
                    lag7 = history[-7]
                    
                    feat = pd.DataFrame([{
                        'day_of_week': f_date.dayofweek,
                        'day_of_month': f_date.day,
                        'lag_1': lag1,
                        'lag_7': lag7
                    }])
                    
                    pred = float(model.predict(feat)[0])
                    forecasted_values.append(pred)
                    history.append(pred)
                model_type = "Linear Regression (Lags)"
        except Exception as e:
            print(f"Regression fallback failed: {e}. Falling back to baseline mean.")
            
    # Baseline fallback: simple mean of the last 30 days
    if not forecasted_values:
        mean_val = float(daily_series.tail(30).mean())
        forecasted_values = [mean_val] * 30
        model_type = "Mean Baseline"
        
    # Clean forecasted values (round and ensure non-negative)
    forecast_data = []
    total_forecasted_revenue = 0.0
    for date, val in zip(forecast_dates, forecasted_values):
        val = max(0.0, round(float(val), 2))
        forecast_data.append({
            'date': date.strftime('%Y-%m-%d'),
            'predictedRevenue': val
        })
        total_forecasted_revenue += val
        
    total_forecasted_revenue = round(total_forecasted_revenue, 2)
    
    # Compute growth rate compared to last 30 days actuals
    if actual_last_30_days_sum > 0:
        growth_rate = round((total_forecasted_revenue - actual_last_30_days_sum) / actual_last_30_days_sum, 4)
    else:
        growth_rate = 0.0
        
    result = {
        'generatedAt': datetime.now(timezone.utc),
        'modelType': model_type,
        'historical': historical_data,
        'predictions': forecast_data,
        'totalForecastedRevenue': total_forecasted_revenue,
        'actualLast30DaysRevenue': actual_last_30_days_sum,
        'growthRate': growth_rate
    }
    
    db[RESULT_COLLECTION].insert_one(result)
    return result

if __name__ == '__main__':
    res = generate_forecast()
    print(f"[revenue_forecasting] Forecast generated at {res['generatedAt'].isoformat()} using {res['modelType']}. "
          f"Projected 30-day revenue: Rs. {res['totalForecastedRevenue']}.")
