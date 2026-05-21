const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "public");

const server = http.createServer((req, res) => {
  let filePath = path.join(publicDir, req.url === "/" ? "index.html" : decodeURIComponent(req.url));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === ".html" ? "text/html; charset=utf-8" :
      ext === ".js" ? "text/javascript" :
      ext === ".css" ? "text/css" :
      "application/octet-stream";
    res.writeHead(200, {"Content-Type": type});
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

let club = {
  name: null,
  members: [],
  chat: [],
  pendingBattle: null
};

const clients = new Map(); // ws -> { user, matchId }
const matches = new Map(); // matchId -> { players: [name1,name2] }

function safeName(name) {
  return String(name || "Oyuncu").trim().slice(0, 18) || "Oyuncu";
}

function send(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function broadcast(obj) {
  for (const ws of wss.clients) send(ws, obj);
}

function updateMember(user, online) {
  user = safeName(user);
  let m = club.members.find(x => x.name === user);
  if (!m) {
    m = { name: user, online, role: club.members.length === 0 ? "Kurucu" : "Üye", lastSeen: Date.now() };
    club.members.push(m);
  }
  m.online = online;
  m.lastSeen = Date.now();
}

function broadcastClub() {
  broadcast({ type: "clubState", club });
}

function addChat(who, text) {
  club.chat.push({ who, text: String(text || "").slice(0, 240), time: Date.now() });
  if (club.chat.length > 120) club.chat = club.chat.slice(-120);
}

function findClientByUser(user) {
  for (const [ws, info] of clients) {
    if (info.user === user && ws.readyState === WebSocket.OPEN) return ws;
  }
  return null;
}

wss.on("connection", (ws) => {
  clients.set(ws, { user: null, matchId: null });

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const info = clients.get(ws) || { user: null, matchId: null };

    if (msg.type === "hello") {
      info.user = safeName(msg.user);
      clients.set(ws, info);
      updateMember(info.user, true);
      send(ws, { type: "clubState", club });
      broadcastClub();
      return;
    }

    if (!info.user) return;

    if (msg.type === "createClub") {
      const name = String(msg.name || "").trim().slice(0, 20);
      if (!name) return;
      club.name = name;
      club.members = [];
      club.chat = [];
      club.pendingBattle = null;
      updateMember(info.user, true);
      addChat("Sistem", `${name} kulübü kuruldu.`);
      broadcastClub();
      return;
    }

    if (msg.type === "sendChat") {
      if (!club.name) return;
      addChat(info.user, msg.text);
      broadcastClub();
      return;
    }

    if (msg.type === "requestBattle") {
      if (!club.name) return;
      if (club.pendingBattle && club.pendingBattle.status === "waiting") {
        send(ws, { type: "clubState", club });
        return;
      }
      club.pendingBattle = {
        id: "battle_" + Date.now() + "_" + Math.floor(Math.random() * 9999),
        from: info.user,
        createdAt: Date.now(),
        status: "waiting",
        acceptedBy: null
      };
      addChat("Sistem", `${info.user} kulübe savaş isteği gönderdi.`);
      broadcastClub();
      return;
    }

    if (msg.type === "cancelBattle") {
      if (!club.pendingBattle) return;
      addChat("Sistem", `${info.user} savaş isteğini kapattı.`);
      club.pendingBattle = null;
      broadcastClub();
      return;
    }

    if (msg.type === "acceptBattle") {
      const req = club.pendingBattle;
      if (!req || req.status !== "waiting") return;
      if (req.from === info.user) return;

      req.status = "accepted";
      req.acceptedBy = info.user;
      req.acceptedAt = Date.now();

      const matchId = "match_" + Date.now() + "_" + Math.floor(Math.random() * 9999);
      matches.set(matchId, { players: [req.from, info.user] });

      addChat("Sistem", `${info.user}, ${req.from} kullanıcısının savaş isteğini kabul etti.`);
      broadcastClub();

      const a = findClientByUser(req.from);
      const b = findClientByUser(info.user);
      if (a) {
        const ai = clients.get(a); ai.matchId = matchId; clients.set(a, ai);
        send(a, { type: "battleStart", matchId, opponent: info.user });
      }
      if (b) {
        info.matchId = matchId; clients.set(ws, info);
        send(b, { type: "battleStart", matchId, opponent: req.from });
      }
      return;
    }

    if (msg.type === "placeCard") {
      const match = matches.get(msg.matchId);
      if (!match || !match.players.includes(info.user)) return;
      const payload = {
        type: "remotePlace",
        matchId: msg.matchId,
        from: info.user,
        cardKey: String(msg.cardKey || ""),
        x: Number(msg.x || 0),
        y: Number(msg.y || 0)
      };
      for (const player of match.players) {
        if (player === info.user) continue;
        const other = findClientByUser(player);
        if (other) send(other, payload);
      }
      return;
    }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    if (info && info.user) {
      updateMember(info.user, false);
      broadcastClub();
    }
    clients.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Castle Card Battle online server running on http://localhost:${PORT}`);
});
