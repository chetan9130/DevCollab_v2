# DevCollab - Remote Developer Collaboration Platform (Phase 1)

DevCollab is a real-time remote collaboration platform for developers. This is **Phase 1** of the project, which implements the **Room Management and WebRTC Signaling Relay layer**. 

## Objective
Establish client-server WebSocket communication, handle multi-user rooms, discover other peers dynamically as they join/leave, and relay mock WebRTC negotiation descriptions (SDP offers, answers) and direct messages. 

This sets a production-ready, modular foundation for Phase 2 (audio/video streaming integration).

---

## Tech Stack
* **Frontend**: React 18, Vite, React Router, Socket.IO Client, Tailwind CSS v4
* **Backend**: Node.js, Express.js, Socket.IO, CORS

---

## Directory Structure
```
devcollab/
├── client/                     # Frontend Application (React 18 + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   └── TerminalConsole.jsx  # Styled developer logging console
│   │   ├── pages/
│   │   │   └── RoomPage.jsx         # Workspace dashboard & action panels
│   │   ├── services/
│   │   │   └── socket.js            # Lazy singleton Socket.IO connection service
│   │   ├── App.jsx                  # React routing configuration
│   │   ├── index.css                # Tailwind imports & CSS-first theme config
│   │   └── main.jsx                 # Client entrypoint
│   ├── index.html
│   ├── package.json
│   └── vite.config.js          # Configured with @tailwindcss/vite plugin
│
├── server/                     # Backend Signaling Server (Node + Express)
│   ├── src/
│   │   ├── socket/
│   │   │   └── handler.js      # Socket event rules (join_room, signal, disconnect)
│   │   └── index.js            # Express setup and Socket.IO initialization
│   └── package.json
│
└── README.md                   # Setup and execution guide
```

---

## Socket Event Flows

### 1. Room Joins & Discovery
* **`join_room` (Client $\rightarrow$ Server)**: 
  * Payload: `{ roomId: string }`
  * Callback returns list of active peer session IDs already in that room to allow immediate discovery.
* **`peer_joined` (Server $\rightarrow$ Room Sockets)**:
  * Payload: `{ peerId: string }`
  * Alerts existing room members that a new peer has connected.
* **`peer_left` (Server $\rightarrow$ Room Sockets)**:
  * Payload: `{ peerId: string }`
  * Triggered automatically on socket disconnect/disconnecting, letting peers remove the session from their active UI.

### 2. Signaling Relay
* **`signal` (Client $\rightarrow$ Server $\rightarrow$ Target Client)**:
  * Sent Payload: `{ to: string, signal: any }`
  * Relayed Payload: `{ from: string, signal: any }`
  * Serves as the raw, transparent mailman for WebRTC SDP Offers, Answers, or ICE Candidates.

---

## Installation & Setup

Ensure you have [Node.js (v22+)](https://nodejs.org/) installed.

### 1. Install Backend Server dependencies
```bash
cd server
npm install
```

### 2. Install Frontend Client dependencies
```bash
cd ../client
npm install
```

---

## Run Commands

### Start the Backend Signaling Server
Run in the `server` directory:
```bash
npm run dev
```
* The server will run on port `5000` (`http://localhost:5000` / `ws://localhost:5000`).
* Uses Node 22's native `--watch` mode to reload automatically on code changes.

### Start the Frontend Client Dev Server
Run in the `client` directory:
```bash
npm run dev
```
* The client will boot on port `5173` (`http://localhost:5173`).

---

## How to Test and Verify

### Scenario 1: Room Join & Peer Discovery
1. Open two separate browser tabs or private windows at `http://localhost:5173`.
2. Observe both consoles connect to the signaling server and receive unique Socket IDs.
3. In Tab A, type `room-101` in the room ID input and click **JOIN ROOM**.
4. In Tab B, type `room-101` and click **JOIN ROOM**.
5. **Result**: Tab A's terminal immediately outputs `PEER: Peer joined: <Tab_B_ID>`, and Tab A's workspace renders a Session Card for Tab B. Tab B's workspace displays a Session Card for Tab A.

### Scenario 2: WebRTC Signaling Relay
1. In Tab A, look at Tab B's Session Card and click **SDP HANDSHAKE**.
2. **Observation**:
   * Tab A generates and emits a mock SDP Offer to Tab B.
   * Tab B receives the signaling offer, logs the SDP metadata, and automatically replies by sending a mock SDP Answer back to Tab A.
   * Tab A receives the Answer and prints a success notification in its terminal, completing the simulated WebRTC signaling loop.
3. In Tab A, click **MSG** on Tab B's card.
4. Type a message (e.g. `Hello Partner!`) and click **SEND**.
5. **Observation**: Tab B's console prints the received signaling message in real-time.
