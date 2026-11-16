require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database("data.sqlite");
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'customer',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 product_name TEXT NOT NULL,
 player_id TEXT NOT NULL,
 nickname TEXT,
 price_aoa INTEGER NOT NULL,
 proof_file TEXT,
 status TEXT NOT NULL DEFAULT 'awaiting_payment',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
`);

const products = [
 {id:"d100", category:"Diamantes", name:"100 diamantes", price:1500},
 {id:"d310", category:"Diamantes", name:"310 diamantes", price:4550},
 {id:"d520", category:"Diamantes", name:"520 diamantes", price:6850},
 {id:"d1060", category:"Diamantes", name:"1.060 diamantes", price:14650},
 {id:"d2180", category:"Diamantes", name:"2.180 diamantes", price:28600},
 {id:"d5600", category:"Diamantes", name:"5.600 diamantes", price:68250},
 {id:"d22400", category:"Diamantes", name:"22.400 diamantes", price:273000},
 {id:"weekly", category:"Passes", name:"Assinatura semanal", price:2950},
 {id:"monthly", category:"Passes", name:"Assinatura mensal", price:14650},
 {id:"booyah", category:"Passes", name:"Passe Booyah", price:null},
 {id:"premium", category:"Passes", name:"Passe Booyah Premium Plus", price:null}
];

function seedAdmin() {
 const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
 const password = process.env.ADMIN_PASSWORD || "";
 if (!email || !password) return;
 const found = db.prepare("SELECT id FROM users WHERE email=?").get(email);
 if (!found) {
   const hash = bcrypt.hashSync(password, 12);
   db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')")
     .run("Administrador", email, hash);
 }
}
seedAdmin();

app.use(helmet({contentSecurityPolicy: false}));
app.use(express.urlencoded({extended:false, limit:"20kb"}));
app.use(express.json({limit:"20kb"}));
app.use(session({
 secret: process.env.SESSION_SECRET || "dev-only-change-me",
 resave: false, saveUninitialized: false,
 store: new SQLiteStore({db:"sessions.sqlite", dir:"."}),
 cookie: {httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV==="production", maxAge: 1000*60*60*8}
}));
app.use(express.static(path.join(__dirname, "public")));

const authLimiter = rateLimit({windowMs:15*60*1000, limit:10, standardHeaders:true, legacyHeaders:false});
const upload = multer({
 dest: path.join(__dirname,"uploads"),
 limits:{fileSize:5*1024*1024, files:1},
 fileFilter:(req,file,cb)=>{
   const ok = ["image/jpeg","image/png","application/pdf"].includes(file.mimetype);
   cb(ok ? null : new Error("Formato não permitido. Envia JPG, PNG ou PDF."), ok);
 }
});
const requireAuth = (req,res,next)=> req.session.user ? next() : res.status(401).json({error:"Inicia sessão para continuar."});
const requireAdmin = (req,res,next)=> req.session.user?.role==="admin" ? next() : res.status(403).json({error:"Acesso reservado ao administrador."});

app.get("/api/config",(req,res)=>res.json({
 paymentNumber:process.env.PAYMENT_NUMBER || "956042943",
 whatsapp:"+"+(process.env.WHATSAPP_NUMBER || "244998552711")
}));
app.get("/api/products",(req,res)=>res.json(products));

app.post("/api/register",authLimiter,async(req,res)=>{
 const name=String(req.body.name||"").trim();
 const email=String(req.body.email||"").trim().toLowerCase();
 const password=String(req.body.password||"");
 if(name.length<2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length<10)
   return res.status(400).json({error:"Indica nome, email válido e palavra-passe com pelo menos 10 caracteres."});
 try {
   const hash=await bcrypt.hash(password,12);
   const result=db.prepare("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)").run(name,email,hash);
   req.session.user={id:result.lastInsertRowid,name,email,role:"customer"};
   res.json({ok:true,user:req.session.user});
 } catch(e) { res.status(409).json({error:"Este email já tem uma conta."}); }
});
app.post("/api/login",authLimiter,async(req,res)=>{
 const email=String(req.body.email||"").trim().toLowerCase();
 const password=String(req.body.password||"");
 const user=db.prepare("SELECT * FROM users WHERE email=?").get(email);
 if(!user || !(await bcrypt.compare(password,user.password_hash)))
   return res.status(401).json({error:"Email ou palavra-passe incorretos."});
 req.session.user={id:user.id,name:user.name,email:user.email,role:user.role};
 res.json({ok:true,user:req.session.user});
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",(req,res)=>res.json({user:req.session.user||null}));

app.post("/api/orders",requireAuth,(req,res)=>{
 const product=products.find(p=>p.id===req.body.productId);
 const playerId=String(req.body.playerId||"").trim();
 const nickname=String(req.body.nickname||"").trim();
 if(!product || !product.price) return res.status(400).json({error:"Este passe ainda está com preço por confirmar. Contacta o atendimento."});
 if(!/^\d{5,15}$/.test(playerId)) return res.status(400).json({error:"Confirma o ID de jogador (5 a 15 algarismos)."});
 const result=db.prepare("INSERT INTO orders(user_id,product_name,player_id,nickname,price_aoa) VALUES(?,?,?,?,?)")
   .run(req.session.user.id,product.name,playerId,nickname,product.price);
 res.json({ok:true,orderId:result.lastInsertRowid,price:product.price,paymentNumber:process.env.PAYMENT_NUMBER||"956042943"});
});
app.post("/api/orders/:id/proof",requireAuth,(req,res)=>{
 const order=db.prepare("SELECT * FROM orders WHERE id=? AND user_id=?").get(req.params.id,req.session.user.id);
 if(!order) return res.status(404).json({error:"Encomenda não encontrada."});
 upload.single("proof")(req,res,(err)=>{
   if(err) return res.status(400).json({error:err.message});
   if(!req.file) return res.status(400).json({error:"Anexa o comprovativo."});
   db.prepare("UPDATE orders SET proof_file=?,status='proof_received' WHERE id=?")
     .run(req.file.filename,order.id);
   res.json({ok:true,message:"Comprovativo recebido. Aguarda a verificação manual do pagamento."});
 });
});
app.get("/api/my-orders",requireAuth,(req,res)=>{
 const rows=db.prepare("SELECT id,product_name,price_aoa,status,created_at FROM orders WHERE user_id=? ORDER BY id DESC").all(req.session.user.id);
 res.json(rows);
});
app.get("/api/admin/orders",requireAuth,requireAdmin,(req,res)=>{
 const rows=db.prepare(`SELECT o.*,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC`).all();
 res.json(rows);
});
app.post("/api/admin/orders/:id/verify",requireAuth,requireAdmin,(req,res)=>{
 const order=db.prepare("SELECT id,status FROM orders WHERE id=?").get(req.params.id);
 if(!order) return res.status(404).json({error:"Encomenda não encontrada."});
 db.prepare("UPDATE orders SET status='paid_verified' WHERE id=?").run(order.id);
 res.json({ok:true});
});
app.post("/api/admin/orders/:id/complete",requireAuth,requireAdmin,(req,res)=>{
 const order=db.prepare("SELECT id,status FROM orders WHERE id=?").get(req.params.id);
 if(!order || order.status!=="paid_verified") return res.status(400).json({error:"Só podes concluir encomendas com pagamento verificado."});
 db.prepare("UPDATE orders SET status='completed' WHERE id=?").run(order.id);
 res.json({ok:true});
});
app.get("/api/admin/proof/:id",requireAuth,requireAdmin,(req,res)=>{
 const order=db.prepare("SELECT proof_file FROM orders WHERE id=?").get(req.params.id);
 if(!order?.proof_file) return res.status(404).end();
 res.sendFile(path.join(__dirname,"uploads",path.basename(order.proof_file)));
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Angola Diamonds a correr em http://localhost:${PORT}`));
