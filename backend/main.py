from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json

from data_processor import load_and_preprocess_data, get_locations
from ml_models import content_based_filtering, knn_distance_filtering, collaborative_filtering

app = FastAPI(title="Restaurant Recommendation API")

# Setup CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables to hold data
df = None
locations_data = None

@app.on_event("startup")
def load_data():
    global df, locations_data
    print("Loading data...")
    df = load_and_preprocess_data()
    if df is not None:
        locations_data = get_locations(df)
        print("Data successfully loaded!")
    else:
        print("Failed to load data")

@app.get("/api/locations")
def get_all_locations():
    if locations_data is None:
        raise HTTPException(status_code=500, detail="Data not loaded")
    return locations_data

@app.get("/api/recommend")
def recommend_restaurants(
    country: Optional[str] = None,
    city: Optional[str] = None,
    locality: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    target_cuisines: Optional[str] = None,
    max_cost: Optional[int] = None,
    is_veg: Optional[str] = None,
    min_rating: Optional[float] = None,
    history_ids: Optional[str] = None,  # comma separated
    limit: int = 10,
    offset: int = 0
):
    if df is None:
        raise HTTPException(status_code=500, detail="Data not loaded")
        
    # Filter by Location First
    curr_df = df.copy()
    if country:
        curr_df = curr_df[curr_df['Country'] == country]
    if city:
        curr_df = curr_df[curr_df['City'] == city]
    if locality:
        curr_df = curr_df[curr_df['Locality'] == locality]
        
    # If GPS provided, use KNN for location and apply filters
    if lat is not None and lon is not None:
        # Find the absolute closest restaurant to determine city and locality
        closest = knn_distance_filtering(curr_df, lat, lon, k=1)
        if not closest.empty:
            user_city = closest.iloc[0]['City']
            user_locality = closest.iloc[0]['Locality']
            # Hard filter strictly to this city and locality
            curr_df = curr_df[(curr_df['City'] == user_city) & (curr_df['Locality'] == user_locality)]
            
        # Get all restaurants in this restricted area, sorted by distance
        curr_df = knn_distance_filtering(curr_df, lat, lon, k=len(curr_df))
        
    # If CF is requested (history provided)
    if history_ids:
        hist_list = [int(x) for x in history_ids.split(',')] if history_ids else []
        curr_df = collaborative_filtering(df, hist_list, curr_df, sort_by_distance=(lat is not None and lon is not None))
    else:
        # Content Filtering / General Filtering
        prefs = {
            'target_cuisines': target_cuisines,
            'max_cost': max_cost,
            'is_veg': is_veg,
            'min_rating': min_rating
        }
        curr_df = content_based_filtering(curr_df, curr_df, prefs, sort_by_distance=(lat is not None and lon is not None))
        
    # Final cleanup to remove NaNs for JSON serialization
    curr_df = curr_df.fillna('')
    
    # Pagination
    total = len(curr_df)
    results = curr_df.iloc[offset:offset+limit].to_dict('records')
    
    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "results": results
    }

# Mock history storage for simplicity (in-memory for now)
# In production, this would be a real user database
user_history_db = {}

class HistoryItem(BaseModel):
    user_id: str
    restaurant_id: int

@app.post("/api/history")
def save_history(item: HistoryItem):
    if item.user_id not in user_history_db:
        user_history_db[item.user_id] = []
    if item.restaurant_id not in user_history_db[item.user_id]:
        user_history_db[item.user_id].append(item.restaurant_id)
    return {"status": "success"}

@app.get("/api/history")
def get_history(user_id: str):
    ids = user_history_db.get(user_id, [])
    if df is None:
        return {"history": []}
    
    hist_df = df[df['Restaurant ID'].isin(ids)].fillna('')
    return {"history": hist_df.to_dict('records')}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
