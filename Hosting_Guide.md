# Hosting Guide: How to Share Gourmet Map

To make your Gourmet Map website accessible to other devices (like your phone or friends' laptops), you have two main options depending on whether they are in your house or anywhere in the world.

---

## Method 1: Local Network Access 
*(For friends and devices connected to your same Wi-Fi/Network)*

If you just want to test this on your phone while sitting at your computer, you don't need to rent servers!

### Step 1: Find Your Computer's Local IP Address
1. Open PowerShell or Command Prompt on the computer running the code.
2. Type `ipconfig` and press Enter.
3. Look for the line that says **IPv4 Address**. It usually looks like `192.168.1.X` or `10.0.0.X`. Write this number down.

### Step 2: Update the Frontend API Link
Right now, your frontend (`app.js`) connects to `localhost`. If you load "localhost" on your phone, your phone will look for a server inside your phone itself! We need to point it to your computer.
1. Open `frontend/app.js`
2. Change line 17:
   ```javascript
   // Change this:
   const API_BASE = 'http://localhost:8000/api';
   
   // To this (using your actual IP address from Step 1):
   const API_BASE = 'http://192.168.1.X:8000/api';
   ```

### Step 3: Run the Servers
Your backend is already programmed to run on `0.0.0.0` (which implies "listen to all incoming local traffic"), so simply start your `.bat` files like normal!

Now, anyone on your Wi-Fi can type:
`http://192.168.1.X:8080/`
...into their phone browser, and they will load the app and connect securely back to your computer!

---

## Method 2: Public Cloud Hosting
*(For anyone in the world to access your site permanently)*

To host it permanently, we need to host your **Backend (FastAPI)** and your **Frontend (HTML/JS)** on different services. Both can be hosted completely for **free**:

### Step 1: Host the Backend (Python FastAPI) on Render.com
1. Create a free account on [Render](https://render.com).
2. Upload your `backend` folder to a GitHub repository.
3. On Render, click **New > Web Service** and connect your GitHub repo.
4. Set the Build Command to: `pip install -r requirements.txt` (Make sure you create a `requirements.txt` file listing `fastapi, uvicorn, pandas, numpy, etc.`)
5. Set the Start Command to: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Once deployed, Render will give you a live URL (e.g., `https://gourmet-map-api.onrender.com`).

### Step 2: Update the Frontend API Link
1. Open `frontend/app.js`
2. Change the `API_BASE` URL to your brand new Render URL:
   ```javascript
   const API_BASE = 'https://gourmet-map-api.onrender.com/api';
   ```
   *(Note: Browsers block "mixed content". Since Render uses secure `https`, your frontend must also use `https`!)*

### Step 3: Host the Frontend (HTML/JS) on Netlify or Vercel
1. Create a free account on [Netlify](https://netlify.com) or [Vercel](https://vercel.com).
2. Upload your `frontend` folder to a GitHub repository.
3. On Netlify/Vercel, click "Add New Site" -> "Import an existing project".
4. Both platforms will automatically detect it's a static HTML site. Click **Deploy**.
5. Within seconds, it will give you a live URL (e.g., `https://gourmet-map.netlify.app`).

### Wrap-up
You can now share this URL seamlessly with anyone across the globe! They will browse the site hosted on Netlify, and clicking "Search" will secretly talk to your Python model running remotely on Render.
