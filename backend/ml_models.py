import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.neighbors import NearestNeighbors

def content_based_filtering(df, location_df, preferences, sort_by_distance=False):
    results = location_df.copy()
    
    if preferences.get('max_cost'):
        results = results[results['Average Cost for two'] <= preferences['max_cost']]
    if preferences.get('is_veg') == 'Yes':
        results = results[results['Is_Veg'] == 'Yes']
    if preferences.get('min_rating'):
        results = results[results['Aggregate rating'] >= preferences['min_rating']]
        
    if results.empty:
        return results
        
    if preferences.get('target_cuisines'):
        tfidf = TfidfVectorizer(stop_words='english')
        tfidf_matrix = tfidf.fit_transform(results['Cuisines'].fillna(''))
        
        target_vec = tfidf.transform([preferences['target_cuisines']])
        cosine_sim = cosine_similarity(target_vec, tfidf_matrix)
        results['similarity'] = cosine_sim[0]
        
        if sort_by_distance and 'Distance_km' in results.columns:
            results = results.sort_values(by=['similarity', 'Distance_km'], ascending=[False, True])
        else:
            results = results.sort_values(by=['similarity', 'Aggregate rating'], ascending=[False, False])
    else:
        if sort_by_distance and 'Distance_km' in results.columns:
            results = results.sort_values(by=['Distance_km'], ascending=[True])
        else:
            results = results.sort_values(by=['Aggregate rating'], ascending=[False])
        
    return results

def knn_distance_filtering(location_df, user_lat, user_lon, k=10):
    """
    Find nearest restaurants to the user's lat/lon.
    """
    # Create feature matrix for KNN
    features = location_df[['Latitude', 'Longitude']].dropna()
    if features.empty:
        return location_df.head(0)
    
    # Simple Haversine distance could be used, but KNN with Euclidean is quick for small areas
    # Convert lat/lon to radians for Haversine
    # Using NearestNeighbors with haversine requires input in radians
    features_rad = np.radians(features)
    user_coords = np.radians([[user_lat, user_lon]])
    
    n_neighbors = min(k, len(features))
    knn = NearestNeighbors(n_neighbors=n_neighbors, metric='haversine')
    knn.fit(features_rad)
    
    distances, indices = knn.kneighbors(user_coords)
    
    # Retrieve the top K
    recommended = location_df.iloc[indices[0]].copy()
    # Distance in km roughly by multiplying radians by earth radius (6371)
    recommended['Distance_km'] = distances[0] * 6371
    
    # Sort by closest and then highest rated
    recommended = recommended.sort_values(by=['Distance_km', 'Aggregate rating'], ascending=[True, False])
    return recommended

def collaborative_filtering(df, history_restaurant_ids, current_location_df, sort_by_distance=False):
    if not history_restaurant_ids:
        if sort_by_distance and 'Distance_km' in current_location_df.columns:
            return current_location_df.sort_values(by=['Distance_km'], ascending=[True])
        return current_location_df.sort_values(by=['Votes', 'Aggregate rating'], ascending=[False, False])
    
    past_restaurants = df[df['Restaurant ID'].isin(history_restaurant_ids)]
    
    if past_restaurants.empty:
        if sort_by_distance and 'Distance_km' in current_location_df.columns:
            return current_location_df.sort_values(by=['Distance_km'], ascending=[True])
        return current_location_df.sort_values(by=['Votes', 'Aggregate rating'], ascending=[False, False])
        
    past_cuisines = ' '.join(past_restaurants['Cuisines'].fillna('').tolist())
    
    tfidf = TfidfVectorizer(stop_words='english')
    tfidf_matrix = tfidf.fit_transform(current_location_df['Cuisines'].fillna(''))
    user_profile_vec = tfidf.transform([past_cuisines])
    
    cosine_sim = cosine_similarity(user_profile_vec, tfidf_matrix)
    
    results = current_location_df.copy()
    results['cf_score'] = cosine_sim[0] * results['Aggregate rating'] 
    
    if sort_by_distance and 'Distance_km' in results.columns:
        return results.sort_values(by=['cf_score', 'Distance_km'], ascending=[False, True])
    return results.sort_values(by=['cf_score', 'Votes'], ascending=[False, False])
