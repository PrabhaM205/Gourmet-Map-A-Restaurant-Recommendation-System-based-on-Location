import pandas as pd
import numpy as np
import os
import json

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'zomato')

def load_and_preprocess_data():
    csv_path = os.path.join(DATA_DIR, 'zomato.csv')
    excel_path = os.path.join(DATA_DIR, 'Country-Code.xlsx')
    
    # Load Main CSV
    try:
        df = pd.read_csv(csv_path, encoding='latin-1')
    except Exception as e:
        print(f"Error loading CSV: {e}")
        return None
        
    # Load Country Codes
    try:
        country_df = pd.read_excel(excel_path)
        df = pd.merge(df, country_df, on='Country Code', how='left')
    except Exception as e:
        print(f"Error loading Excel or merging: {e}")
    
    # Fill missing Drop NaNs in Cuisines
    df['Cuisines'] = df['Cuisines'].fillna('Unknown')
    
    # Add a 'Veg/Non-Veg' column as a basic heuristic
    # If a restaurant specializes in purely vegetarian cuisines we mark it as Veg, else assumed mixed/non-veg.
    veg_keywords = ['Vegetarian', 'Vegan']
    df['Is_Veg'] = df['Cuisines'].apply(lambda x: any(kw in str(x) for kw in veg_keywords))
    
    # Convert 'Is_Veg' to string 'Yes'/'No' for easier frontend handling
    df['Is_Veg'] = df['Is_Veg'].map({True: 'Yes', False: 'No'})
    
    # Ensure rating is float
    df['Aggregate rating'] = df['Aggregate rating'].astype(float)
    df['Votes'] = df['Votes'].astype(int)
    
    # Handle Location String (City + Locality)
    df['Full_Location'] = df['City'] + ', ' + df['Locality']

    print(f"Data Loaded: {len(df)} records")
    return df

def get_locations(df):
    locations = df[['Country', 'City', 'Locality']].drop_duplicates().to_dict('records')
    return locations

if __name__ == "__main__":
    df = load_and_preprocess_data()
    print(df.head(2))
