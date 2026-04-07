# Hosting on Koyeb

To host this app on Koyeb, follow these steps:

1.  **Push to GitHub:** Push this code to a GitHub repository.
2.  **Create App on Koyeb:**
    *   Go to [Koyeb Console](https://app.koyeb.com/).
    *   Click **Create Service**.
    *   Select **GitHub** and choose your repository.
3.  **Configure Environment Variables:**
    *   Add a new environment variable:
        *   **Key:** `GEMINI_API_KEY`
        *   **Value:** `YOUR_REAL_TIME_API_KEY` (Paste your Gemini API key here)
4.  **Build & Run Settings:**
    *   Koyeb will automatically detect the `Dockerfile`.
    *   If you want to use the buildpack instead:
        *   **Build Command:** `npm install && npm run build`
        *   **Run Command:** `npm start`
    *   **Port:** `3000`
5.  **Deploy:** Click **Deploy**.

Raj will be live on your Koyeb URL! 😉
