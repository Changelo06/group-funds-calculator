const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const net = require("net");
const tls = require("tls");
const DATA_FILE = path.join(__dirname, "splitwise-house-data.json"), KV_KEY = "splitwise-house:state:v1";
const defaultState = { members:["Chan","Mika","Jules","Rina","Paolo","Kai"].map((name,index)=>({id:`member-${index+1}`,name})), funds:[{id:"fund-market",title:"Wet market run",description:"Vegetables, fish, rice, and household basics",date:"2026-08-29",total:1845,memberIds:["member-1","member-2","member-3","member-4","member-5","member-6"],payments:{"member-1":true,"member-2":true,"member-3":true},icon:"◈",updatedAt:"2026-08-29T10:00:00.000Z"},{id:"fund-car",title:"Car rental & gas",description:"Saturday trip to the wet market",date:"2026-08-29",total:1260,memberIds:["member-1","member-2","member-3","member-4","member-5","member-6"],payments:{"member-1":true,"member-4":true},icon:"◌",updatedAt:"2026-08-29T11:00:00.000Z"},{id:"fund-internet",title:"August internet",description:"Monthly house Wi-Fi",date:"2026-08-01",total:1599,memberIds:["member-1","member-2","member-3","member-4","member-5","member-6"],payments:{"member-1":true,"member-2":true,"member-3":true,"member-4":true,"member-5":true,"member-6":true},icon:"◫",updatedAt:"2026-08-01T08:00:00.000Z"}] };
defaultState.members = ["Chan","Winston","Wei","Ann","Lianne"].map((name,index)=>({id:`member-${index+1}`,name}));
defaultState.funds.forEach(fund => { fund.memberIds = ["member-1","member-2","member-3","member-4","member-5"]; delete fund.payments["member-6"]; fund.createdById="member-1"; fund.createdAt=fund.updatedAt; });
const cloneDefault = () => JSON.parse(JSON.stringify(defaultState));
const storageUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const storageToken = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
const hasKv = () => Boolean(storageUrl() && storageToken());
const directRedisUrl = () => process.env.MIKO_REDIS_URL || process.env.REDIS_URL || "";
const hasDirectRedis = () => Boolean(directRedisUrl());
const redisFrame = values => Buffer.from(`*${values.length}\r\n${values.map(value => { const text = String(value); return `$${Buffer.byteLength(text)}\r\n${text}\r\n`; }).join("")}`);
function readRedisReply(buffer) { const lineEnd = buffer.indexOf("\r\n"); if (lineEnd < 0) return null; const type = String.fromCharCode(buffer[0]), head = buffer.subarray(1, lineEnd).toString(); if (type === "+" || type === ":" || type === "-") return { bytes:lineEnd + 2, value:head, error:type === "-" ? new Error(head) : null }; if (type !== "$") throw new Error("Unexpected Redis response."); const size = Number(head); if (size === -1) return { bytes:lineEnd + 2, value:null }; if (!Number.isInteger(size) || buffer.length < lineEnd + 2 + size + 2) return null; return { bytes:lineEnd + 2 + size + 2, value:buffer.subarray(lineEnd + 2, lineEnd + 2 + size).toString() }; }
function directRedis(commands) { const endpoint = new URL(directRedisUrl()), encrypted = endpoint.protocol === "rediss:" || endpoint.searchParams.get("tls") === "true", port = Number(endpoint.port || (encrypted ? 6380 : 6379)), auth = endpoint.username || endpoint.password ? ["AUTH", decodeURIComponent(endpoint.username), decodeURIComponent(endpoint.password)] : null, requests = auth ? [auth, ...commands] : commands; return new Promise((resolve,reject) => { const socket = encrypted ? tls.connect({ host:endpoint.hostname, port, servername:endpoint.hostname }) : net.connect({ host:endpoint.hostname, port }); let pending = Buffer.alloc(0), replies = [], settled = false; const finish = (error, value) => { if (settled) return; settled = true; socket.destroy(); error ? reject(error) : resolve(value); }; socket.setTimeout(8000, () => finish(new Error("Redis connection timed out."))); socket.once(encrypted ? "secureConnect" : "connect", () => socket.write(Buffer.concat(requests.map(redisFrame)))); socket.on("error", error => finish(error)); socket.on("data", chunk => { pending = Buffer.concat([pending, chunk]); try { while (replies.length < requests.length) { const reply = readRedisReply(pending); if (!reply) break; pending = pending.subarray(reply.bytes); if (reply.error) return finish(reply.error); replies.push(reply.value); } if (replies.length === requests.length) finish(null, replies.at(-1)); } catch (error) { finish(error); } }); }); }
async function readState(){if(hasKv()){const response=await fetch(`${storageUrl()}/get/${encodeURIComponent(KV_KEY)}`,{headers:{Authorization:`Bearer ${storageToken()}`}});if(!response.ok)throw new Error("Could not read the configured Vercel KV database.");const payload=await response.json();return payload.result?JSON.parse(payload.result):cloneDefault();}if(hasDirectRedis()){try{const payload=await directRedis([["GET",KV_KEY]]);return payload?JSON.parse(payload):cloneDefault();}catch(error){throw new Error("Could not read the configured Redis database.");}}try{return JSON.parse(await fs.readFile(DATA_FILE,"utf8"));}catch(error){if(error.code==="ENOENT")return cloneDefault();throw error;}}
async function writeState(state){if(hasKv()){const response=await fetch(storageUrl(),{method:"POST",headers:{Authorization:`Bearer ${storageToken()}`,"Content-Type":"application/json"},body:JSON.stringify(["SET",KV_KEY,JSON.stringify(state)])});if(!response.ok)throw new Error("Could not save to the configured Vercel KV database.");return state;}if(hasDirectRedis()){try{await directRedis([["SET",KV_KEY,JSON.stringify(state)]]);return state;}catch(error){throw new Error("Could not save to the configured Redis database.");}}await fs.writeFile(DATA_FILE,JSON.stringify(state,null,2),"utf8");return state;}
function sendJson(response,status,body){response.statusCode=status;response.setHeader("Content-Type","application/json; charset=utf-8");response.setHeader("Cache-Control","no-store");response.end(JSON.stringify(body));}
function body(request){return new Promise((resolve,reject)=>{let text="";request.on("data",chunk=>{text+=chunk;if(Buffer.byteLength(text)>1000000){reject(new Error("Request is too large."));request.destroy();}});request.on("end",()=>{try{resolve(text?JSON.parse(text):{});}catch{reject(new Error("Request body must be valid JSON."));}});request.on("error",reject);});}
function legacyValidFund(input,members){const title=String(input.title||"").trim(),description=String(input.description||"").trim(),date=String(input.date||""),total=Number(input.total),receipt=input.receipt==null?null:String(input.receipt);const ids=[...new Set(Array.isArray(input.memberIds)?input.memberIds.filter(id=>typeof id==="string"):[])].filter(id=>members.some(member=>member.id===id));if(!title)throw new Error("A fund title is required.");if(title.length>80||description.length>160)throw new Error("Please shorten the title or description.");if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("Choose a valid date.");if(!Number.isFinite(total)||total<=0)throw new Error("Enter a total greater than zero.");if(!ids.length)throw new Error("Select at least one current member.");if(receipt&&(!/^data:image\/(png|jpeg|webp);base64,/i.test(receipt)||receipt.length>900000))throw new Error("Choose a smaller PNG, JPEG, or WebP receipt image.");return {title,description,date,total:Math.round(total*100)/100,memberIds:ids,receipt};}
async function handler(request,response){const url=new URL(request.url,"http://localhost"),parts=url.pathname.split("/").filter(Boolean);if(url.pathname==="/api/health")return sendJson(response,200,{ok:true,storage:hasKv()||hasDirectRedis()?"redis":"local-file"});if(url.pathname==="/api/state"&&request.method==="GET")return sendJson(response,200,await readState());const state=await readState();if(url.pathname==="/api/members"&&request.method==="POST"){const input=await body(request),name=String(input.name||"").trim();if(!name||name.length>50)throw new Error("Enter a member name up to 50 characters.");if(state.members.some(member=>member.name.toLowerCase()===name.toLowerCase()))throw new Error("That member is already in this group.");state.members.push({id:crypto.randomUUID(),name});return sendJson(response,201,await writeState(state));}if(parts[0]==="api"&&parts[1]==="members"&&parts[2]&&request.method==="DELETE"){const id=parts[2];if(!state.members.some(member=>member.id===id))return sendJson(response,404,{error:"Member not found."});state.members=state.members.filter(member=>member.id!==id);return sendJson(response,200,await writeState(state));}if(url.pathname==="/api/funds"&&request.method==="POST"){const raw=await body(request),input=validFund(raw,state.members),createdById=state.members.some(member=>member.id===raw.createdById)?raw.createdById:"member-1";state.funds.push({id:crypto.randomUUID(),...input,createdById,payments:{},paymentAudit:[],icon:"◈",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});return sendJson(response,201,await writeState(state));}if(parts[0]==="api"&&parts[1]==="funds"&&parts[2]){const fund=state.funds.find(item=>item.id===parts[2]);if(!fund)return sendJson(response,404,{error:"Split fund not found."});if(request.method==="DELETE"&&parts.length===3){state.funds=state.funds.filter(item=>item.id!==fund.id);return sendJson(response,200,await writeState(state));}if(request.method==="PATCH"&&parts.length===3){const update=validFund(await body(request),state.members),payments={};(update.participantIds||update.memberIds).forEach(id=>{if(fund.payments?.[id])payments[id]=fund.payments[id];});Object.assign(fund,update,{payments,updatedAt:new Date().toISOString()});return sendJson(response,200,await writeState(state));}if(request.method==="PATCH"&&parts[3]==="payments"){const input=await body(request),memberId=String(input.memberId||""),confirmedById=state.members.some(member=>member.id===input.confirmedById)?input.confirmedById:"member-1",paid=Boolean(input.paid),method=String(input.method||"").toLowerCase(),note=String(input.note||"").trim();if(!(fund.participantIds||fund.memberIds).includes(memberId))throw new Error("That member is not part of this fund.");if(paid&&!["cash","online"].includes(method))throw new Error("Choose cash or online before confirming payment.");if(note.length>300)throw new Error("Keep the payment note under 300 characters.");fund.payments||={};fund.paymentAudit||=[];const at=new Date().toISOString();if(paid){fund.payments[memberId]={paidAt:at,method,note,confirmedById};fund.paymentAudit.push({id:crypto.randomUUID(),action:"paid",memberId,method,note,confirmedById,at});}else{delete fund.payments[memberId];fund.paymentAudit.push({id:crypto.randomUUID(),action:"unpaid",memberId,confirmedById,at});}fund.updatedAt=at;return sendJson(response,200,await writeState(state));}}return sendJson(response,404,{error:"API endpoint not found."});}
module.exports=async(request,response)=>{try{await handler(request,response);}catch(error){sendJson(response,400,{error:error.message||"Something went wrong."});}};

const originalApiHandler = module.exports;
module.exports = async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  const isMembersRoute = parts[0] === "api" && parts[1] === "members";
  const isPaymentRoute = parts[0] === "api" && parts[1] === "funds" && parts[2] && parts[3] === "payments" && request.method === "PATCH";
  if (url.pathname === "/api/members" && request.method === "POST") return sendJson(response, 405, { error:"This group uses five fixed member accounts." });
  const isSingleMember = isMembersRoute && parts[2] && parts.length === 3;
  if (isSingleMember && request.method === "DELETE") return sendJson(response, 405, { error:"The five member accounts cannot be removed." });
  if (isPaymentRoute) {
    try {
      const state = await readState(), fund = state.funds.find(item => item.id === parts[2]);
      if (!fund) return sendJson(response, 404, { error:"Split fund not found." });
      const input = await body(request), memberId = String(input.memberId || ""), confirmedById = state.members.some(member => member.id === input.confirmedById) ? input.confirmedById : "member-1", paid = Boolean(input.paid), method = String(input.method || "").toLowerCase(), note = String(input.note || "").trim();
      if (!(fund.participantIds || fund.memberIds).includes(memberId)) throw new Error("That member is not part of this fund.");
      if (fund.splitMode === "itemized" && fund.payerId === memberId) throw new Error("The payer already covered their own itemized share.");
      if (paid && !["cash", "online"].includes(method)) throw new Error("Choose cash or online before confirming payment.");
      if (note.length > 300) throw new Error("Keep the payment note under 300 characters.");
      fund.payments ||= {}; fund.paymentAudit ||= [];
      const at = new Date().toISOString(), amount = Number(fund.shares?.[memberId] ?? Number(fund.total) / Math.max(1, fund.memberIds.length));
      if (paid) { fund.payments[memberId] = { paidAt:at, method, note, confirmedById, amount }; fund.paymentAudit.push({ id:crypto.randomUUID(), action:"paid", memberId, method, note, confirmedById, amount, at }); }
      else { delete fund.payments[memberId]; fund.paymentAudit.push({ id:crypto.randomUUID(), action:"unpaid", memberId, confirmedById, amount, at }); }
      fund.updatedAt = at;
      return sendJson(response, 200, await writeState(state));
    } catch (error) { return sendJson(response, 400, { error:error.message || "Something went wrong." }); }
  }
  const supportsMemberDetails = isSingleMember && request.method === "PATCH";
  if (!supportsMemberDetails) return originalApiHandler(request, response);
  try {
    const input = await body(request), name = String(input.name || "").trim(), contact = String(input.contact || "").trim(), nickname = String(input.nickname || "").trim(), label = String(input.label || "").trim(), avatar = input.avatar == null ? "" : String(input.avatar), paymentMethods = Array.isArray(input.paymentMethods) ? input.paymentMethods.slice(0, 3).map(item => ({ id:String(item.id || crypto.randomUUID()), label:String(item.label || "").trim(), image:String(item.image || "") })) : [];
    if (!name || name.length > 50) throw new Error("Enter a member name up to 50 characters.");
    if (contact.length > 80 || nickname.length > 30 || label.length > 40) throw new Error("Keep account details within the allowed length.");
    if (avatar && (!/^data:image\/(png|jpeg|webp);base64,/i.test(avatar) || avatar.length > 180000)) throw new Error("Choose a smaller profile photo.");
    if (paymentMethods.some(method => !method.label || method.label.length > 30 || !/^data:image\/(png|jpeg|webp);base64,/i.test(method.image) || method.image.length > 180000)) throw new Error("Each payment QR needs a bank label and a smaller PNG, JPEG, or WebP image.");
    const state = await readState();
    const member = isSingleMember ? state.members.find(item => item.id === parts[2]) : null;
    if (isSingleMember && !member) return sendJson(response, 404, { error:"Member not found." });
    if (member && name !== member.name) throw new Error("Member account names are fixed; edit the nickname or profile label instead.");
    if (state.members.some(item => item.id !== member?.id && item.name.toLowerCase() === name.toLowerCase())) throw new Error("That member is already in this group.");
    if (member) Object.assign(member, { name, contact, nickname, label, avatar, paymentMethods });
    else state.members.push({ id:crypto.randomUUID(), name, contact, nickname, label, avatar, paymentMethods });
    return sendJson(response, member ? 200 : 201, await writeState(state));
  } catch (error) { return sendJson(response, 400, { error:error.message || "Something went wrong." }); }
};

function validFund(input, members) {
  const title = String(input.title || "").trim(), description = String(input.description || "").trim().replace(/<(?!\/?(?:b|strong|i|em|ul|ol|li|p|br)\b)[^>]*>/gi, "").replace(/<(b|strong|i|em|ul|ol|li|p|br)(?:\s[^>]*)?>/gi, "<$1>").replace(/<\/(b|strong|i|em|ul|ol|li|p)>/gi, "</$1>"), date = String(input.date || ""), receipt = input.receipt == null ? null : String(input.receipt), splitMode = input.splitMode === "itemized" ? "itemized" : "equal";
  const ids = [...new Set(Array.isArray(input.memberIds) ? input.memberIds.filter(id => typeof id === "string") : [])].filter(id => members.some(member => member.id === id));
  if (!title) throw new Error("A fund title is required.");
  if (title.length > 80 || description.length > 1200) throw new Error("Please shorten the title or description.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a valid date.");
  if (receipt && (!/^data:image\/(png|jpeg|webp);base64,/i.test(receipt) || receipt.length > 900000)) throw new Error("Choose a smaller PNG, JPEG, or WebP receipt image.");
  if (splitMode === "itemized") {
    const payerId = String(input.payerId || ""), rawItems = Array.isArray(input.items) ? input.items.slice(0, 40) : [], rawGuests = Array.isArray(input.guests) ? input.guests.slice(0, 10) : [], sharesInCents = {};
    const seenGuestIds = new Set(), seenNames = new Set(members.map(member => member.name.toLowerCase()));
    const guests = rawGuests.map((guest, index) => {
      const id = String(guest?.id || "").trim(), name = String(guest?.name || "").trim();
      if (!/^guest-[a-zA-Z0-9-]+$/.test(id) || seenGuestIds.has(id)) throw new Error(`Guest ${index + 1} is invalid.`);
      if (!name || name.length > 50 || seenNames.has(name.toLowerCase())) throw new Error(`Guest ${index + 1} needs a unique name up to 50 characters.`);
      seenGuestIds.add(id); seenNames.add(name.toLowerCase());
      return { id, name };
    });
    const peopleById = new Map([...members, ...guests].map(person => [person.id, person]));
    if (!members.some(member => member.id === payerId)) throw new Error("Choose the member who paid the bill.");
    if (!rawItems.length) throw new Error("Add at least one item or shared charge.");
    const items = rawItems.map((item, index) => {
      const name = String(item.name || "").trim(), amountInCents = Math.round(Number(item.amount) * 100), memberIds = [...new Set(Array.isArray(item.memberIds) ? item.memberIds.filter(id => typeof id === "string") : [])].filter(id => peopleById.has(id));
      if (!name || name.length > 80) throw new Error(`Name item ${index + 1} with up to 80 characters.`);
      if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) throw new Error(`Enter a valid amount for ${name}.`);
      if (!memberIds.length) throw new Error(`Choose who shares ${name}.`);
      const shareInCents = Math.floor(amountInCents / memberIds.length), remainder = amountInCents % memberIds.length;
      memberIds.forEach((memberId, memberIndex) => { sharesInCents[memberId] = (sharesInCents[memberId] || 0) + shareInCents + (memberIndex < remainder ? 1 : 0); });
      return { id:typeof item.id === "string" && item.id ? item.id.slice(0, 80) : crypto.randomUUID(), name, amount:amountInCents / 100, memberIds };
    });
    const participantIds = Object.keys(sharesInCents), memberIds = participantIds.filter(id => members.some(member => member.id === id)), totalInCents = items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0), shares = Object.fromEntries(participantIds.map(memberId => [memberId, sharesInCents[memberId] / 100]));
    return { title, description, date, total:totalInCents / 100, memberIds, participantIds, guests, receipt, splitMode, payerId, items, shares };
  }
  const total = Number(input.total);
  if (!Number.isFinite(total) || total <= 0) throw new Error("Enter a total greater than zero.");
  if (!ids.length) throw new Error("Select at least one current member.");
  return { title, description, date, total:Math.round(total * 100) / 100, memberIds:ids, participantIds:ids, guests:[], receipt, splitMode:"equal", payerId:null, items:[], shares:{} };
}
