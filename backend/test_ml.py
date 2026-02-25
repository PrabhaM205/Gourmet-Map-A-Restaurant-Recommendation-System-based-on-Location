from data_processor import load_and_preprocess_data, get_locations
from ml_models import content_based_filtering, knn_distance_filtering, collaborative_filtering

def print_results(df, title):
    print(f"\n--- {title} ---")
    if df is not None and not df.empty:
        print(df[['Restaurant Name', 'Locality', 'Cuisines', 'Aggregate rating']].head(5).to_string())
    else:
        print("No results found.")

def run_tests():
    print("Loading data...")
    df = load_and_preprocess_data()
    if df is None:
        return
        
    print(f"Total Rows: {len(df)}")
    
    # 1. Test Content-Based Filtering
    prefs = {
        'target_cuisines': 'Italian, Pizza',
        'max_cost': 2000,
        'is_veg': None,
        'min_rating': 4.0
    }
    # Filter for New Delhi
    nd_df = df[df['City'] == 'New Delhi'].copy()
    cb_results = content_based_filtering(nd_df, nd_df, prefs)
    print_results(cb_results, "Content-Based: Italian/Pizza in New Delhi, Max 2000, Min 4.0")
    
    # 2. Test KNN
    # Connaught Place approx coords
    lat, lon = 28.6304, 77.2177 
    knn_results = knn_distance_filtering(nd_df, lat, lon, k=10)
    print("\n--- KNN: Nearest to Connaught Place ---")
    if not knn_results.empty:
        print(knn_results[['Restaurant Name', 'Distance_km', 'Aggregate rating']].head(5).to_string())
        
    # 3. Test Collaborative Filtering (history mock)
    # Let's say user likes a specific ID 
    # e.g., 18287358 (Farzi Cafe - Modern Indian)
    mock_history = [18287358]
    cf_results = collaborative_filtering(df, mock_history, nd_df)
    print_results(cf_results, "Collaborative Filtering: Similar to Farzi Cafe")

if __name__ == "__main__":
    run_tests()
