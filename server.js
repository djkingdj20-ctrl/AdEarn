const express=require("express");
const session=require("express-session");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const app=express();
app.set("trust proxy",1);

const PORT=Number(process.env.PORT)||10000;
const DATA_DIR=path.join(__dirname,"data");
const DB_FILE=path.join(DATA_DIR,"database.json");

if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});

function defaultDB(){
return{
users:[
{
id:"demo-user",
name:"Rahul Sharma",
email:"rahul.sharma@example.com",
password:"demo123",
mobile:"+91 98765 43210",
city:"Vizag",
role:"Member",
balance:0,
points:0,
referralCode:"AE2F85A827",
referredBy:null,
successfulReferrals:0,
referralEarnings:0,
tasksCompleted:0,
createdAt:new Date().toISOString()
}
],
ads:[
{
id:1,
title:"TechNova Cloud",
description:"Supercharge your workflow with AI-powered cloud tools.",
reward:1,
image:"https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80"
},
{
id:2,
title:"PayPulse UPI",
description:"Instant cashback and secure digital payments across India.",
reward:1,
image:"https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80"
},
{
id:3,
title:"ZestFit Wearables",
description:"Track your fitness and daily activity with smart technology.",
reward:1,
image:"https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=1200&q=80"
},
{
id:4,
title:"GreenLeaf Organic Mart",
description:"Fresh farm produce delivered directly to your doorstep.",
reward:1,
image:"https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80"
}
],
history:[],
withdrawals:[],
otps:[]
};
}

function loadDB(){
try{
if(fs.existsSync(DB_FILE)){
return JSON.parse(fs.readFileSync(DB_FILE,"utf8"));
}
}catch(e){}
return defaultDB();
}

let db=loadDB();

function saveDB(){
fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2));
}

app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));

app.use(session({
secret:process.env.SESSION_SECRET||"adearn-session-secret-change-this",
resave:false,
saveUninitialized:false,
cookie:{
httpOnly:true,
sameSite:"lax",
secure:process.env.NODE_ENV==="production",
maxAge:1000*60*60*24*30
}
}));

app.use(express.static(path.join(__dirname,"public")));

function getUser(req){
return db.users.find(u=>String(u.id)===String(req.session.userId));
}

function requireLogin(req,res,next){
const u=getUser(req);
if(!u)return res.status(401).json({error:"Please login first."});
req.user=u;
next();
}

function publicUser(u){
return{
id:u.id,
name:u.name,
email:u.email,
mobile:u.mobile||"",
city:u.city||"",
role:u.role||"Member",
balance:Number(u.balance||0),
points:Number(u.points||0),
referralCode:u.referralCode,
successfulReferrals:Number(u.successfulReferrals||0),
referralEarnings:Number(u.referralEarnings||0),
tasksCompleted:Number(u.tasksCompleted||0),
upi:u.upi||""
};
}

app.get("/api/me",requireLogin,(req,res)=>{
res.json({user:publicUser(req.user)});
});

app.post("/api/register",(req,res)=>{
const name=String(req.body.name||"").trim();
const email=String(req.body.email||"").trim().toLowerCase();
const password=String(req.body.password||"");
const referralCode=String(req.body.referralCode||"").trim();

if(!name||!email||!password){
return res.status(400).json({error:"Name, email and password are required."});
}

if(db.users.some(u=>u.email.toLowerCase()===email)){
return res.status(400).json({error:"Email already registered."});
}

const referrer=db.users.find(u=>u.referralCode===referralCode);

const u={
id:crypto.randomUUID(),
name,
email,
password,
mobile:"",
city:"",
role:"Member",
balance:0,
points:0,
referralCode:"AE"+crypto.randomBytes(5).toString("hex").toUpperCase(),
referredBy:referrer?referrer.id:null,
successfulReferrals:0,
referralEarnings:0,
tasksCompleted:0,
createdAt:new Date().toISOString()
};

db.users.push(u);
saveDB();

req.session.userId=u.id;

res.json({success:true,user:publicUser(u)});
});

app.post("/api/login",(req,res)=>{
const email=String(req.body.email||"").trim().toLowerCase();
const password=String(req.body.password||"");

const u=db.users.find(
x=>x.email.toLowerCase()===email&&x.password===password
);

if(!u){
return res.status(401).json({error:"Invalid email or password."});
}

req.session.userId=u.id;

res.json({success:true,user:publicUser(u)});
});

app.post("/api/logout",(req,res)=>{
req.session.destroy(()=>{
res.json({success:true});
});
});

app.put("/api/profile",requireLogin,(req,res)=>{
const u=req.user;

if(req.body.name!==undefined)u.name=String(req.body.name).trim();
if(req.body.mobile!==undefined)u.mobile=String(req.body.mobile).trim();
if(req.body.city!==undefined)u.city=String(req.body.city).trim();
if(req.body.upi!==undefined)u.upi=String(req.body.upi).trim();

saveDB();

res.json({success:true,user:publicUser(u)});
});

app.get("/api/tasks",requireLogin,(req,res)=>{
res.json({
tasks:db.ads.map(ad=>({
id:ad.id,
title:ad.title,
description:ad.description,
reward:Number(ad.reward),
image:ad.image
}))
});
});

function todayStart(){
const d=new Date();
d.setHours(0,0,0,0);
return d.getTime();
}

app.post("/api/reward",requireLogin,(req,res)=>{
const u=req.user;
const taskId=Number(req.body.taskId);
const ad=db.ads.find(a=>Number(a.id)===taskId);

if(!ad){
return res.status(404).json({error:"Advertisement not found."});
}

const todayCount=db.history.filter(h=>
String(h.userId)===String(u.id)&&
new Date(h.date).getTime()>=todayStart()
).length;

if(todayCount>=10){
return res.status(429).json({
error:"Daily reward limit of 10 ads reached."
});
}

const reward=Number(ad.reward||1);

u.balance=Number((Number(u.balance||0)+reward).toFixed(2));
u.points=Number(u.points||0)+10;
u.tasksCompleted=Number(u.tasksCompleted||0)+1;

db.history.push({
id:"SUB-"+crypto.randomBytes(4).toString("hex").toUpperCase(),
userId:u.id,
title:ad.title,
reward,
points:10,
status:"PASSED",
date:new Date().toISOString()
});

if(u.tasksCompleted===100&&!u.oneHundredBonus){
u.oneHundredBonus=true;
u.balance=Number((u.balance+10).toFixed(2));
u.points+=10;

db.history.push({
id:"BONUS-"+crypto.randomBytes(4).toString("hex").toUpperCase(),
userId:u.id,
title:"100 Tasks Completion Bonus",
reward:10,
points:10,
status:"BONUS",
date:new Date().toISOString()
});
}

saveDB();

res.json({
success:true,
balance:u.balance,
points:u.points,
reward
});
});

app.get("/api/history",requireLogin,(req,res)=>{
const items=db.history
.filter(h=>String(h.userId)===String(req.user.id))
.sort((a,b)=>new Date(b.date)-new Date(a.date))
.map(h=>({
...h,
date:new Date(h.date).toLocaleString("en-IN",{
day:"2-digit",
month:"short",
year:"numeric",
hour:"2-digit",
minute:"2-digit"
})
}));

res.json({items});
});

app.post("/api/withdrawal-otp",requireLogin,(req,res)=>{
const code=String(Math.floor(100000+Math.random()*900000));

db.otps=db.otps.filter(x=>String(x.userId)!==String(req.user.id));

db.otps.push({
userId:req.user.id,
code,
expires:Date.now()+10*60*1000
});

saveDB();

console.log(
"========================================"
);
console.log("WITHDRAWAL OTP");
console.log("Email:",req.user.email);
console.log("OTP:",code);
console.log(
"========================================"
);

res.json({
success:true,
message:"Withdrawal OTP generated. For this demo, check the server console."
});
});

app.post("/api/withdraw",requireLogin,(req,res)=>{
const u=req.user;
const amount=Number(req.body.amount||0);
const otp=String(req.body.otp||"").trim();

if(amount<100){
return res.status(400).json({
error:"Minimum withdrawal amount is ₹100."
});
}

if(amount>Number(u.balance||0)){
return res.status(400).json({
error:"Insufficient wallet balance."
});
}

const otpRecord=db.otps.find(x=>
String(x.userId)===String(u.id)&&
x.code===otp&&
x.expires>Date.now()
);

if(!otpRecord){
return res.status(400).json({
error:"Invalid or expired withdrawal OTP."
});
}

u.balance=Number((Number(u.balance)-amount).toFixed(2));

db.withdrawals.push({
id:crypto.randomUUID(),
userId:u.id,
amount,
method:req.body.method||"upi",
upi:req.body.upi||"",
status:"pending",
date:new Date().toISOString()
});

db.otps=db.otps.filter(x=>x!==otpRecord);

saveDB();

res.json({
success:true,
balance:u.balance,
message:"Withdrawal request submitted."
});
});

app.get("/api/withdrawals",requireLogin,(req,res)=>{
const items=db.withdrawals
.filter(w=>String(w.userId)===String(req.user.id))
.sort((a,b)=>new Date(b.date)-new Date(a.date));

res.json({items});
});

app.get("*",(req,res)=>{
res.sendFile(path.join(__dirname,"public","index.html"));
});

app.listen(PORT,"0.0.0.0",()=>{
console.log("AdEarn running on port "+PORT);
});
