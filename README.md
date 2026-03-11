# Basketball-Data-Collection-Web-App
This project is a web application designed to collect basketball data from various sources and store it in a structured format for analysis. The application allows users to input basketball statistics, player information, and game details, which are then stored in a database for easy retrieval and analysis.

## Features
- User-friendly interface for data entry
- Database integration for storing basketball data
- Data validation to ensure accuracy and consistency
- Ability to export data for analysis


## Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Git](https://git-scm.com/)

### First-time setup (one per machine)
```bash
npm install -g firebase-tools
firebase login
```

### Running locally
```bash
git clone https://github.com/pieroevcc/Basketball-Data-Collection-Web-App.git
cd Basketball-Data-Collection-Web-App
npm install
npm run dev
```
Open your browser to `http://localhost:5173`.

### Deploying to Firebase
```bash
npm run build
firebase deploy
```