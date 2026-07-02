# PianoJam 🎹

A real-time collaborative piano application that enables multiple users to play music together online. Built with React, Node.js/Express, Socket.io, and Tone.js.

## Overview

PianoJam is an interactive web-based platform where users can:
- **Play piano collaboratively** in real-time with other musicians
- **Create and join rooms** to establish collaborative music sessions
- **Chat with other players** during sessions
- **Support MIDI input** for hardware keyboard connectivity
- **Experience low-latency audio synthesis** using Tone.js
- **View sheet music** with OpenSheetMusicDisplay (OSMD) integration
- **Record and save audio** from collaborative sessions
- **Customize themes** for personalized UI experience
- **Use a virtual keyboard** with visual feedback (note highlighting, trailing effects)

## Tech Stack

### Frontend
- **React 18** - UI framework
- **Redux** - State management
- **Material-UI (MUI)** - Component library
- **Tone.js** - Web audio synthesis
- **Socket.io-client** - Real-time communication
- **OpenSheetMusicDisplay** - MusicXML rendering
- **Styled Components** - CSS-in-JS styling
- **React Router** - Client-side routing

### Backend
- **Node.js/Express** - Server framework
- **Socket.io** - WebSocket-based real-time events
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Bcrypt.js** - Password hashing
- **CORS** - Cross-origin resource sharing

## Project Structure

```
PianoJam/
├── client/                    # React frontend application
│   ├── src/
│   │   ├── features/         # UI components (Piano, Chat, Menus, etc.)
│   │   ├── pages/            # Route pages (Home, Playing)
│   │   ├── reducers/         # Redux reducers
│   │   ├── actions/          # Redux actions
│   │   ├── config/           # Config files (store, settings, notes)
│   │   ├── utils/            # Utilities (API routes, WebSocket, Recorder)
│   │   ├── libs/             # External libraries (Tone.js instruments)
│   │   ├── assets/           # Images, styles
│   │   └── App.js            # Main app component
│   └── package.json
│
├── server/                    # Express backend application
│   ├── controllers/          # Route handlers
│   ├── routes/               # API route definitions
│   ├── model/                # Database models (User, Room)
│   ├── server.js             # Express server setup
│   └── package.json
│
├── .gitignore               # Git ignore rules
├── Bachelor_s_Thesis.pdf    # Project documentation
└── README.md                # This file
```

## Getting Started

### Prerequisites
- Node.js (v14+)
- npm or yarn
- MongoDB instance (local or cloud)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Halfaxas/PianoJam.git
   cd PianoJam
   ```

2. **Install backend dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../client
   npm install
   ```

4. **Configure environment variables**
   - Create `.env` file in `server/` directory
   - Add MongoDB connection URI: `MONGODB_URI=mongodb://...`
   - Add other required env vars

### Running the Application

1. **Start the backend server**
   ```bash
   cd server
   npm start
   ```
   Server runs on `http://localhost:5000`

2. **Start the frontend development server** (in another terminal)
   ```bash
   cd client
   npm start
   ```
   Frontend runs on `http://localhost:3000`

3. **Access the application**
   - Open browser to `http://localhost:3000`

## Features

### Core Features
- 🎹 Virtual piano keyboard with multiple octaves
- 🎵 Real-time multi-player collaboration
- 💬 In-app chat system
- 🏠 Room-based sessions
- 👥 Player list with user information
- 🎚️ Metronome with adjustable tempo
- 📊 Sound pack selection
- 🎨 Theme customization

### Audio Features
- Web Audio API synthesis via Tone.js
- Support for various instruments
- Recording capability
- Audio playback synchronization

### User Features
- User authentication (login/registration)
- Guest mode support
- User profiles
- Room creation and joining
- Persistent user data

## API Endpoints

### User Routes
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - User login
- `GET /api/users/:id` - Get user info

### Room Routes
- `GET /api/rooms` - List all rooms
- `POST /api/rooms` - Create new room
- `GET /api/rooms/:id` - Get room details
- `PUT /api/rooms/:id` - Update room
- `DELETE /api/rooms/:id` - Delete room

## Real-time Events (Socket.io)

- `receive-guest-id` - Receive guest identifier
- `room-joined` - Notification when user joins room
- `player-left` - Notification when user leaves room
- `note-played` - Broadcast note played by user
- `chat-message` - Receive chat messages
- `metronome-tick` - Synchronized metronome events

## Development

### Running Tests
```bash
cd client
npm test
```

### Building for Production
```bash
cd client
npm run build
```

## File Exclusions

The following files are excluded from version control:
- `Bachelor_s_Thesis.pdf` - Project thesis documentation
- `node_modules/` - Installed dependencies
- `.env` - Environment variables
- Build artifacts and temporary files

## Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## License

This project is part of a Bachelor's thesis. See `Bachelor_s_Thesis.pdf` for more details.

## Author

- **Vlad Marius Andrei** - Initial development

## Acknowledgments

- Tone.js for web audio synthesis
- OpenSheetMusicDisplay for music notation rendering
- Material-UI for component library
- Socket.io for real-time communication
