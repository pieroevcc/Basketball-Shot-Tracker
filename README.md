# Basketball-Data-Collection-Web-App
This project is a web application designed to collect basketball data from various sources and store it in a structured format for analysis. The application allows users to input basketball statistics, player information, and game details, which are then stored in a database for easy retrieval and analysis.

## Features
- User-friendly interface for data entry
- Database integration for storing basketball data
- Data validation to ensure accuracy and consistency
- Ability to export data for analysis

## Technologies Used
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB

## Installation
1. Open Terminal (if Windows user, install git before continuing)
2. Clone the repository in preferred directory: `git clone https://github.com/pieroevcc/Basketball-Data-Collection-Web-App.git`
3. Navigate to the project directory: `cd basketball-data-collection-web-app`
4. Install dependencies: `npm install`
5. Start the application: `npm run dev`
6. Open your browser and navigate to `http://localhost:####` to access the application.
7. To exit the application: `q`

1. Deploy the security rules (one-time setup):

npm install -g firebase-tools
firebase login
firebase use basketball-shot-tracker-21c0e
firebase deploy --only firestore:rules
2. Run the app:


npm run dev