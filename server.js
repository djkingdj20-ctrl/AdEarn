var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var path = require('path');

var app = express();
var PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

var users = [
    { 
        email: "rahul.sharma@example.com", 
        password: "password123", 
        fullName: "Rahul Sharma", 
        mobile: "+91 98765 43210", 
        city: "Vizag", 
        balance: 1.00, 
        upiId: "rahul@okaxis" 
    }
];

var currentUser = users[0];

app.post('/api/login', function(req, res) {
    var email = req.body.email;
    var password = req.body.password;
    var user = null;
    
    for(var i = 0; i < users.length; i++) {
        if(users[i].email === email && users[i].password === password) {
            user = users[i];
            break;
        }
    }

    if (user) {
        currentUser = user;
        res.json({ success: true, message: "Login successful", user: user });
    } else {
        res.status(401).json({ success: false, message: "Invalid email or password" });
    }
});

app.post('/api/register', function(req, res) {
    var fullName = req.body.fullName;
    var email = req.body.email;
    var password = req.body.password;
    var mobile = req.body.mobile;
    var city = req.body.city;
    var exists = false;

    for(var i = 0; i < users.length; i++) {
        if(users[i].email === email) {
            exists = true;
            break;
        }
    }

    if (exists) {
        return res.status(400).json({ success: false, message: "Email already registered" });
    }

    var newUser = { 
        fullName: fullName, 
        email: email, 
        password: password, 
        mobile: mobile, 
        city: city, 
        balance: 0.00, 
        upiId: "" 
    };
    
    users.push(newUser);
    currentUser = newUser;
    res.json({ success: true, message: "Registration successful", user: newUser });
});

app.get('/api/profile', function(req, res) {
    res.json({ success: true, data: currentUser });
});

app.post('/api/profile/update', function(req, res) {
    if (req.body.fullName) currentUser.fullName = req.body.fullName;
    if (req.body.mobile) currentUser.mobile = req.body.mobile;
    if (req.body.city) currentUser.city = req.body.city;
    
    res.json({ success: true, message: "Profile updated", data: currentUser });
});

app.post('/api/task/complete', function(req, res) {
    currentUser.balance += 1.00;
    res.json({ success: true, newBalance: currentUser.balance });
});

app.listen(PORT, function() {
    console.log("Server is running on port " + PORT);
});
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
