// Servidor sem dependências (Node 18+). Senha no servidor, respostas só com token, relay em tempo real por SSE.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,D=__dirname,SALT='quizshow3d';
const H=p=>crypto.scryptSync(String(p),SALT,32);
let PASS=H(process.env.QUIZ_PASS||'1234');
const Q=JSON.parse(fs.readFileSync(path.join(D,'questions.json')));
const sessions=new Map(),tries=new Map(),clients=new Set(),last={};
const ok=t=>{const e=sessions.get(t);if(e&&e>Date.now()){sessions.set(t,Date.now()+6*36e5);return true}sessions.delete(t);return false};
const body=r=>new Promise(res=>{let b='';r.on('data',d=>{b+=d;if(b.length>2e5)r.destroy()});r.on('end',()=>{try{res(JSON.parse(b))}catch{res({})}})});
setInterval(()=>clients.forEach(c=>c.write(': ping\n\n')),20000);
http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x'),ip=req.headers['x-forwarded-for']||req.socket.remoteAddress,J=(c,o)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};
 if(u.pathname==='/api/login'&&req.method==='POST'){const t=tries.get(ip)||{n:0,until:0};if(t.until>Date.now())return J(429,{error:'Muitas tentativas. Aguarde 1 minuto.'});
  const {password=''}=await body(req);if(!crypto.timingSafeEqual(H(password),PASS)){if(++t.n>=5){t.until=Date.now()+6e4;t.n=0}tries.set(ip,t);return J(401,{error:'Senha incorreta'})}
  tries.delete(ip);const tk=crypto.randomBytes(24).toString('hex');sessions.set(tk,Date.now()+6*36e5);return J(200,{token:tk})}
 if(u.pathname==='/api/questions'){if(!ok(u.searchParams.get('token')))return J(401,{error:'Sem acesso'});return J(200,Q)}
 if(u.pathname==='/api/relay'&&req.method==='POST'){const m=await body(req);if(!ok(m.token))return J(401,{error:'Sessão inválida'});delete m.token;last[m.type]=m;const s='data: '+JSON.stringify(m)+'\n\n';clients.forEach(c=>c.write(s));return J(200,{})}
 if(u.pathname==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','X-Accel-Buffering':'no'});clients.add(res);Object.values(last).forEach(m=>res.write('data: '+JSON.stringify(m)+'\n\n'));req.on('close',()=>clients.delete(res));return}
 if(['/','/palco','/controle'].includes(u.pathname)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return fs.createReadStream(path.join(D,'','index.html')).pipe(res)}
 res.writeHead(404);res.end()}).listen(PORT,'0.0.0.0',()=>console.log('Palco: /palco  Controle: /controle  (porta '+PORT+')'));
