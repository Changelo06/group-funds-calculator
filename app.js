const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
let state = { members: [], funds: [] }, activeRoute = "overview", activeFilter = "all", activeSort = "date", activeSortDirection = "desc", activeOwnership = "all", editingFundId = null, activeFundId = null, currentReceipt = null, calculatorExpression = "";
let sharedFundId = new URLSearchParams(location.search).get("fund") || "", forceSharedProfile = Boolean(sharedFundId), forceProfileSelection = true;
const byId = id => document.getElementById(id);
const dateInput = byId("fund-date"); dateInput.value = new Date().toISOString().slice(0, 10);
const money = value => currency.format(Number(value) || 0);
const dateLabel = date => new Intl.DateTimeFormat("en-PH", { month:"short", day:"numeric", year:"numeric" }).format(new Date(`${date}T12:00:00`));
const initials = name => name.split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase();
const escapeHtml = value => String(value || "").replace(/[&<'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const fundParticipantIds = fund => fund.participantIds || fund.memberIds;
const fundGuest = (fund, id) => (fund.guests || []).find(guest => guest.id === id);
const fundPerson = (fund, id) => state.members.find(member => member.id === id) || fundGuest(fund, id) || { id, name:"Former member" };
const fundPeople = fund => fundParticipantIds(fund).map(id => fundPerson(fund, id));
const payableMemberIds = fund => fundParticipantIds(fund).filter(id => !(fund.splitMode === "itemized" && fund.payerId === id));
const paidCount = fund => payableMemberIds(fund).filter(id => fund.payments?.[id]).length;
const share = fund => Number(fund.total) / Math.max(1, fundParticipantIds(fund).length);
const memberShare = (fund, memberId) => Number(fund.shares?.[memberId] ?? share(fund));
const settled = fund => payableMemberIds(fund).length === 0 || paidCount(fund) === payableMemberIds(fund).length;
const openFunds = () => state.funds.filter(fund => !settled(fund));
const postedAt = fund => String(fund.createdAt || fund.updatedAt || `${fund.date || ""}T12:00:00`);
const postedAge = fund => { const date = new Date(postedAt(fund)); if (Number.isNaN(date.getTime())) return "recently"; const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000)); return days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`; };
const posterName = fund => (state.members.find(member => member.id === (fund.createdById || "member-1")) || { name:"Chan" }).name;
const sortFunds = (funds, sort = activeSort) => { const sorted = [...funds].sort((a,b) => { if (sort === "name") return a.title.localeCompare(b.title) || postedAt(b).localeCompare(postedAt(a)); if (sort === "member") return posterName(a).localeCompare(posterName(b)) || a.title.localeCompare(b.title); return postedAt(a).localeCompare(postedAt(b)); }); return activeSortDirection === "asc" ? sorted : sorted.reverse(); };
function showToast(message) { const toast = byId("toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800); }
const DEBUG_TIMING = localStorage.getItem("rm331-debug-timing") === "1";
const pendingMutations = new Set();
let stateLoadPromise = null, lastStateSyncAt = 0, healthChecked = false;
const logTiming = (label, start) => { if (DEBUG_TIMING) console.debug(`[Group Funds Calculator] ${label}: ${(performance.now() - start).toFixed(0)}ms`); };
async function withPending(key, control, pendingLabel, action) { if (pendingMutations.has(key)) return; pendingMutations.add(key); const previousContent = control?.innerHTML; if (control) { control.disabled = true; if (pendingLabel) control.textContent = pendingLabel; control.setAttribute("aria-busy", "true"); } try { return await action(); } finally { pendingMutations.delete(key); if (control) { control.disabled = false; if (pendingLabel !== "") control.innerHTML = previousContent; control.removeAttribute("aria-busy"); } } }
async function api(url, options = {}) { const startedAt = performance.now(), isCreateFund = url === "/api/funds" && options.method === "POST"; if (isCreateFund) logTiming("T2 request sent", startedAt); const response = await fetch(url, { ...options, headers:{ "Content-Type":"application/json", ...(options.headers || {}) } }), text = await response.text(), contentType = response.headers.get("content-type") || ""; if (isCreateFund) logTiming(`T7 response received (${text.length} bytes)`, startedAt); if (!response.ok) { const body = contentType.includes("application/json") ? JSON.parse(text || "{}") : {}; throw new Error(body.error || "Could not save your changes."); } if (!contentType.includes("application/json")) { if (/continue with vercel|log in to vercel|vercel authentication/i.test(text)) throw new Error("This Vercel deployment is protected. Disable Vercel Authentication for the public app."); throw new Error("The shared-data service returned an unexpected response."); } try { return JSON.parse(text); } catch { throw new Error("The shared-data service returned invalid data."); } }
async function refreshHealth(silent = false) { const health = await api("/api/health"), needsSharedStorage = /\.vercel\.app$/i.test(location.hostname) && health.storage !== "redis"; healthChecked = true; document.querySelector(".connection").classList.toggle("online", !needsSharedStorage); byId("connection-status").textContent = needsSharedStorage ? "Shared storage needs setup" : "Live sync on"; if (needsSharedStorage && !silent) showToast("Shared storage is not connected. Complete the Vercel checklist before adding funds."); }
async function loadState(silent = false, checkHealth = !healthChecked) { if (stateLoadPromise) return stateLoadPromise; stateLoadPromise = (async () => { try { const nextState = await api("/api/state"); state = nextState; lastStateSyncAt = Date.now(); if (checkHealth) await refreshHealth(silent); if (sharedFundId && state.funds.some(fund => fund.id === sharedFundId)) activeFundId = sharedFundId; render(); } catch (error) { document.querySelector(".connection").classList.remove("online"); byId("connection-status").textContent = "Shared data unavailable"; healthChecked = false; if (!silent) showToast(error.message || "Could not reach the shared expense data."); } finally { stateLoadPromise = null; } })(); return stateLoadPromise; }
function renderOverview() { const profile = currentProfile(), open = openFunds(), toPay = profile ? memberUnpaidFunds(profile.id) : [], collections = profile ? open.map(fund => ({ fund, amount:payableMemberIds(fund).filter(id => id !== profile.id && !fund.payments?.[id]).reduce((sum,id) => sum + memberShare(fund,id),0), waiting:payableMemberIds(fund).filter(id => id !== profile.id && !fund.payments?.[id]).length })).filter(item => item.amount > 0 && fundCreatorId(item.fund) === profile.id) : [], collectTotal = collections.reduce((sum,item) => sum + item.amount,0), awaiting = collections.reduce((sum,item) => sum + item.waiting, 0), done = profile ? state.funds.filter(fund => fundCreatorId(fund) === profile.id && settled(fund)).length : 0; byId("stat-grid").innerHTML = [["Open to collect from others",money(collectTotal),collections.length ? `${collections.length} active collection${collections.length === 1 ? "" : "s"}` : "No active collections",collections.length ? "open":"ok"],["To pay",toPay.length,toPay.length ? `${money(memberOwed(profile?.id))} across your open funds` : "You are all caught up",toPay.length ? "open":"ok"],["Payments waiting",awaiting,awaiting ? "Payments due to you" : "Nothing is waiting",awaiting ? "open":"ok"],["Settled",done,done ? "Your completed collections" : "No completed collections","ok"]].map(([label,value,caption,kind], index) => `<article class="stat-card ${index === 0 ? "collection-summary" : "summary-counter"}"><span>${label}</span><strong>${value}</strong><small class="${kind}">${caption}</small></article>`).join(""); byId("recent-funds").innerHTML = fundsHtml(sortFunds(state.funds).slice(0,4), "No split funds yet", "Add your first shared purchase to get started."); }
function renderFunds() { const all = state.funds, open = all.filter(fund => !settled(fund)), closed = all.filter(settled), profileId = currentProfile()?.id; byId("all-count").textContent = all.length; byId("open-count").textContent = open.length; byId("settled-count").textContent = closed.length; byId("fund-sort").value = activeSort; byId("fund-sort-direction").textContent = activeSortDirection === "asc" ? "↑" : "↓"; byId("fund-sort-direction").setAttribute("aria-label", `Sort ${activeSortDirection === "asc" ? "ascending" : "descending"}`); const query = byId("fund-search").value.trim().toLowerCase(); let funds = activeFilter === "open" ? open : activeFilter === "settled" ? closed : all; if (activeOwnership === "yours") funds = funds.filter(fund => fundCreatorId(fund) === profileId); if (activeOwnership === "others") funds = funds.filter(fund => fundCreatorId(fund) !== profileId); if (query) funds = funds.filter(fund => `${fund.title} ${fund.description || ""} ${posterName(fund)}`.toLowerCase().includes(query)); byId("funds-list").innerHTML = fundsHtml(sortFunds(funds), query ? "No matching funds" : "No funds in this view", query ? "Try another word or clear the search." : "Create a split fund to start tracking the house expenses."); document.querySelectorAll(".filter").forEach(button => button.classList.toggle("active", button.dataset.filter === activeFilter)); document.querySelectorAll("[data-fund-owner]").forEach(button => button.classList.toggle("active", button.dataset.fundOwner === activeOwnership)); }
const memberFundCount = id => state.funds.filter(fund => fund.memberIds.includes(id)).length;
function updateFundPreview() { if (activeSplitMode === "itemized" && byId("itemized-editor")) { updateItemizedSummary(); return; } const selected = document.querySelectorAll(".member-choice input:checked").length, choices = document.querySelectorAll(".member-choice input").length, total = Number(byId("fund-total").value) || 0; byId("per-person-preview").innerHTML = `${money(total)} <small>bill total</small>`; byId("select-all-members").checked = choices > 0 && selected === choices; const note = byId("selection-note"); note.textContent = selected ? `${money(total)} ÷ ${selected} ${selected === 1 ? "person" : "people"} = ${money(total / selected)} each` : "Select at least one person to calculate the equal split."; note.classList.toggle("ready", Boolean(selected)); document.querySelectorAll(".member-choice").forEach(item => item.classList.toggle("selected", item.querySelector("input").checked)); }
function refreshFundMemberChoices(includeMemberId) { const selected = new Set([...document.querySelectorAll(".member-choice input:checked")].map(input => input.value)); if (includeMemberId) selected.add(includeMemberId); const people = [...state.members, ...itemizedGuests]; byId("fund-member-select").innerHTML = people.map(person => `<label class="member-choice"><input type="checkbox" value="${escapeHtml(person.id)}" ${selected.has(person.id) ? "checked" : ""}/><span class="custom-check"></span><span>${escapeHtml(person.nickname || person.name)}${person.guest ? " · temporary" : ""}</span></label>`).join(""); byId("all-members-caption").textContent = `${people.length} people`; updateFundPreview(); }
function renderReceiptPreview() { const preview = byId("receipt-preview"); preview.hidden = !currentReceipt; if (currentReceipt) byId("receipt-image").src = currentReceipt; }
function closeModals() { document.querySelectorAll(".modal-backdrop").forEach(modal => modal.hidden = true); activeFundId = null; }
function renderCalculator() { byId("calculator-display").textContent = calculatorExpression ? calculatorExpression.replace(/\*/g,"×").replace(/\//g,"÷") : "0"; }
async function compressReceipt(file) { if (!file || !file.type.startsWith("image/")) throw new Error("Choose a PNG, JPEG, or WebP receipt image."); const source = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("The receipt could not be read.")); reader.readAsDataURL(file); }); const image = await new Promise((resolve,reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error("The receipt image could not be opened.")); element.src = source; }); const scale = Math.min(1, 1000 / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height); let encoded = canvas.toDataURL("image/jpeg", .76); if (encoded.length > 850000) { canvas.width = Math.round(canvas.width * .78); canvas.height = Math.round(canvas.height * .78); canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height); encoded = canvas.toDataURL("image/jpeg", .62); } if (encoded.length > 900000) throw new Error("That receipt is still too large. Please use a smaller image."); return encoded; }
document.addEventListener("click", event => { const route = event.target.closest("[data-route]"); if (route) { event.preventDefault(); showRoute(route.dataset.route); return; } if (event.target.closest("[data-open-fund]") || event.target.closest("#mobile-add")) return openFundModal(); if (event.target.closest("[data-open-member]")) return openMemberModal(); if (event.target.closest("[data-close-modal]")) return closeModals(); const filter = event.target.closest(".filter"); if(filter) { activeFilter = filter.dataset.filter; renderFunds(); return; } const row = event.target.closest("[data-fund-id]"); if(row) { activeFundId = row.dataset.fundId; renderDetail(); } });
byId("fund-search").addEventListener("input", renderFunds); byId("fund-sort").addEventListener("change", event => { activeSort = event.target.value; renderFunds(); }); byId("fund-sort-direction").addEventListener("click", () => { activeSortDirection = activeSortDirection === "asc" ? "desc" : "asc"; renderFunds(); }); byId("fund-total").addEventListener("input", updateFundPreview); byId("fund-member-select").addEventListener("change", updateFundPreview); byId("select-all-members").addEventListener("change", event => { document.querySelectorAll(".member-choice input").forEach(input => input.checked = event.target.checked); updateFundPreview(); });
byId("edit-fund").addEventListener("click", () => { const fund = state.funds.find(item => item.id === activeFundId); byId("detail-modal").hidden = true; openFundModal(fund); });
byId("delete-fund").addEventListener("click", async () => { const fund = state.funds.find(item => item.id === activeFundId); if (!fund || !confirm(`Delete “${fund.title}”? This cannot be undone.`)) return; await withPending(`fund-delete:${fund.id}`, byId("delete-fund"), "Deleting…", async () => { try { state = await api(`/api/funds/${fund.id}`, {method:"DELETE"}); closeModals(); render(); showToast("Split fund deleted."); } catch(error) { showToast(error.message); } }); });
window.addEventListener("hashchange", () => { const rawRoute = location.hash.slice(1), route = rawRoute === "more" ? "profile" : rawRoute; if (rawRoute === "more") { location.hash = "profile"; return; } if (["overview","funds","members","profile"].includes(route) && route !== activeRoute) showRoute(route); });

// A profile is a lightweight, device-local selection—not a password account.
const PROFILE_STORAGE_KEY = "splitwise-house-profile-id";
let currentMemberId = localStorage.getItem(PROFILE_STORAGE_KEY) || "";
const currentProfile = () => state.members.find(member => member.id === currentMemberId) || null;
const fundCreatorId = fund => fund.createdById || "member-1";
const memberFunds = memberId => state.funds.filter(fund => fund.memberIds.includes(memberId));
const memberUnpaidFunds = memberId => memberFunds(memberId).filter(fund => payableMemberIds(fund).includes(memberId) && !fund.payments?.[memberId]);
const memberOwed = memberId => memberUnpaidFunds(memberId).reduce((total, fund) => total + memberShare(fund, memberId), 0);
const fundDetailsLoads = new Map();
async function ensureFundDetails(fund) { if (!fund?.hasReceipt || fund.receipt) return fund; if (!fundDetailsLoads.has(fund.id)) fundDetailsLoads.set(fund.id, api(`/api/funds/${fund.id}`).then(fullFund => { const index = state.funds.findIndex(item => item.id === fund.id); if (index >= 0) state.funds[index] = fullFund; return fullFund; }).finally(() => fundDetailsLoads.delete(fund.id))); return fundDetailsLoads.get(fund.id); }

function renderNavigation() {
  byId("open-nav-count").textContent = openFunds().length;
  document.querySelectorAll(".nav-link, .tab-link").forEach(link => link.classList.toggle("active", link.dataset.route === activeRoute));
}

function profileFundHtml(fund) {
  const amount = memberShare(fund, currentProfile()?.id);
  return `<article class="personal-fund"><span class="personal-fund-icon">${fund.icon || "◈"}</span><span><b>${escapeHtml(fund.title)}</b><small>${dateLabel(fund.date)} · ${money(amount)} your share</small></span><strong>${money(amount)}</strong></article>`;
}

function render() {
  if (currentMemberId && !currentProfile()) {
    currentMemberId = "";
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  }
  const profileRequired = state.members.length && (!currentProfile() || forceSharedProfile || forceProfileSelection);
  document.body.classList.toggle("profile-required", Boolean(profileRequired));
  document.querySelector(".app-shell").setAttribute("aria-hidden", profileRequired ? "true" : "false");
  renderNavigation();
  renderProfileChrome();
  renderOverview();
  renderFunds();
  renderMembers();
  renderProfile();
  if (activeFundId) renderDetail();
  if (profileRequired) openProfilePicker();
}

function showRoute(route) {
  if (state.members.length && (!currentProfile() || forceSharedProfile || forceProfileSelection)) return openProfilePicker();
  activeRoute = route;
  ["overview", "funds", "members", "profile"].forEach(name => byId(`${name}-view`).hidden = name !== route);
  if (window.location.hash.slice(1) !== route) window.location.hash = route;
  renderNavigation();
  if (route === "funds") renderFunds();
  if (route === "profile") renderProfile();
}

document.addEventListener("click", event => {
  const profileButton = event.target.closest("[data-select-profile]");
  if (profileButton) {
    currentMemberId = profileButton.dataset.selectProfile;
    forceSharedProfile = false;
    forceProfileSelection = false;
    localStorage.setItem(PROFILE_STORAGE_KEY, currentMemberId);
    byId("profile-modal").hidden = true;
    render();
    showToast(`Tracking payments for ${currentProfile().name}.`);
    return;
  }
  if (event.target.closest("[data-open-profile]")) openProfilePicker();
});

document.addEventListener("click", async event => {
  const key = event.target.closest("[data-calc]");
  if (key) {
    event.preventDefault();
    useCalculatorKey(key.dataset.calc);
    return;
  }
  if (event.target.closest("#remove-receipt")) {
    currentReceipt = null;
    byId("receipt-input").value = "";
    renderReceiptPreview();
  }
});

function sanitizeDescriptionHtml(value) {
  const template = document.createElement("template");
  template.innerHTML = String(value || "");
  const allowed = new Set(["B", "STRONG", "I", "EM", "UL", "OL", "LI", "P", "BR"]);
  template.content.querySelectorAll("*").forEach(element => {
    if (!allowed.has(element.tagName)) element.replaceWith(...element.childNodes);
    else [...element.attributes].forEach(attribute => element.removeAttribute(attribute.name));
  });
  return template.innerHTML.trim().slice(0, 1200);
}

function installDescriptionEditor() {
  const existing = byId("fund-description");
  if (!existing || existing.dataset.richEditor) return;
  const editor = document.createElement("div");
  editor.id = "fund-description";
  editor.dataset.richEditor = "true";
  editor.className = "rich-editor";
  editor.contentEditable = "true";
  editor.setAttribute("role", "textbox");
  editor.setAttribute("aria-multiline", "true");
  editor.setAttribute("aria-label", "Description");
  editor.dataset.placeholder = "Add a note, details, or a short list";
  existing.replaceWith(editor);
  const field = document.createElement("div");
  field.className = "rich-description-field";
  const toolbar = document.createElement("div");
  toolbar.className = "rich-toolbar";
  toolbar.setAttribute("aria-label", "Description formatting");
  toolbar.innerHTML = `<button type="button" data-description-format="bold" aria-label="Bold"><b>B</b></button><button type="button" data-description-format="italic" aria-label="Italic"><i>I</i></button><button type="button" data-description-format="insertUnorderedList" aria-label="Bulleted list">• List</button><button type="button" data-description-format="insertOrderedList" aria-label="Numbered list">1. List</button>`;
  editor.parentNode.insertBefore(field, editor);
  field.append(toolbar, editor);
}

let activeSplitMode = "equal", itemizedDraft = [], itemizedGuests = [];
const newItemId = () => (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID?.()) || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const itemizedPerson = id => state.members.find(member => member.id === id) || itemizedGuests.find(guest => guest.id === id) || { id, name:"Guest" };
function ensureItemizedEditor() {
  if (byId("itemized-editor")) return;
  const editor = document.createElement("section");
  editor.id = "itemized-editor";
  editor.className = "itemized-editor";
  editor.hidden = true;
  editor.innerHTML = `<div class="itemized-header"><div><b>Order items</b><small>Add dishes, drinks, tax, delivery, or any shared charge.</small></div><label><span>Paid by</span><select id="itemized-payer"></select></label></div><div id="itemized-rows"></div><button class="secondary-button itemized-add" type="button" data-add-item>＋ Add item or charge</button><div class="itemized-summary"><span>Itemized total</span><strong id="itemized-total">₱0.00</strong><div id="itemized-breakdown"></div></div>`;
  document.querySelector(".receipt-field").before(editor);
}
function itemizedRowHtml(item, index) {
  const selected = new Set(item.memberIds || []);
  const people = [...state.members, ...itemizedGuests];
  return `<article class="itemized-row" data-item-row="${escapeHtml(item.id)}"><div class="itemized-row-top"><label><span>Item ${index + 1}</span><input data-item-name maxlength="80" value="${escapeHtml(item.name || "")}" placeholder="e.g. Chicken rice" /></label><label class="itemized-price"><span>Price</span><div class="money-input"><b>₱</b><input data-item-amount type="number" min="0.01" step="0.01" value="${item.amount || ""}" placeholder="0.00" /></div></label><button type="button" class="itemized-remove" data-remove-item aria-label="Remove item">×</button></div><fieldset><legend>Who ordered this?</legend><div class="itemized-members">${people.map(person => `<label><input type="checkbox" data-item-member value="${escapeHtml(person.id)}" ${selected.has(person.id) ? "checked" : ""}/><span>${escapeHtml(person.nickname || person.name)}${person.guest ? " · guest" : ""}</span></label>`).join("")}</div><button type="button" class="itemized-add-person" data-add-item-guest>＋ Add person</button></fieldset></article>`;
}
function readItemizedRows() {
  return [...document.querySelectorAll("[data-item-row]")].map(row => ({ id:row.dataset.itemRow, name:row.querySelector("[data-item-name]").value.trim(), amount:Number(row.querySelector("[data-item-amount]").value), memberIds:[...row.querySelectorAll("[data-item-member]:checked")].map(input => input.value) }));
}
function renderItemizedRows() {
  byId("itemized-rows").innerHTML = itemizedDraft.map(itemizedRowHtml).join("");
  updateFundPreview();
}
function updateItemizedSummary() {
  const totals = {}, rows = readItemizedRows().filter(item => Number.isFinite(item.amount) && item.amount > 0 && item.memberIds.length), total = rows.reduce((sum, item) => sum + item.amount, 0);
  rows.forEach(item => { const cents = Math.round(item.amount * 100), base = Math.floor(cents / item.memberIds.length), remainder = cents % item.memberIds.length; item.memberIds.forEach((memberId, index) => { totals[memberId] = (totals[memberId] || 0) + base + (index < remainder ? 1 : 0); }); });
  byId("itemized-total").textContent = money(total);
  byId("itemized-breakdown").innerHTML = Object.entries(totals).map(([memberId, cents]) => { const person = itemizedPerson(memberId); return `<span>${escapeHtml(person.nickname || person.name)} <b>${money(cents / 100)}</b></span>`; }).join("") || `<span>Add an amount and the people sharing it.</span>`;
  return { rows, total };
}
function setSplitMode(mode) {
  activeSplitMode = mode === "itemized" ? "itemized" : "equal";
  byId("fund-form").dataset.splitMode = activeSplitMode;
  byId("itemized-editor").hidden = activeSplitMode !== "itemized";
  document.querySelector(".fund-tools").hidden = activeSplitMode === "itemized";
  document.querySelector(".member-selector").hidden = activeSplitMode === "itemized";
  byId("fund-total").disabled = activeSplitMode === "itemized";
  updateFundPreview();
}

function ensureSplitChoiceModal() {
  if (byId("split-choice-modal")) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop split-choice-backdrop" id="split-choice-modal" hidden><section class="modal split-choice-card" aria-labelledby="split-choice-title"><button class="close-button" type="button" data-close-modal aria-label="Close">×</button><h2 id="split-choice-title">How should this bill be split?</h2><div class="split-choice-grid"><button type="button" data-new-split-mode="equal"><span>÷</span><b>Equal split</b><small>One total divided equally among the selected members.</small></button><button type="button" data-new-split-mode="itemized"><span>≡</span><b>Itemized order</b><small>Assign each dish, item, or charge to the people who share it.</small></button></div></section></div>`);
}
function openSplitChoice() {
  ensureSplitChoiceModal();
  byId("split-choice-modal").hidden = false;
}
async function openFundModal(fund = null, requestedMode = null) {
  if (state.members.length && (!currentProfile() || forceSharedProfile || forceProfileSelection)) return openProfilePicker();
  if (!fund && !requestedMode) return openSplitChoice();
  if (fund) fund = await ensureFundDetails(fund);
  installDescriptionEditor();
  ensureItemizedEditor();
  editingFundId = fund?.id || null; currentReceipt = fund?.receipt || null; calculatorExpression = "";
  byId("calculator-display").textContent = "0"; byId("receipt-input").value = ""; renderReceiptPreview();
  const selectedMode = requestedMode || fund?.splitMode || "equal";
  byId("fund-modal-eyebrow").textContent = fund ? "EDIT SPLIT FUND" : selectedMode === "itemized" ? "ITEMIZED ORDER" : "EQUAL SPLIT";
  byId("fund-modal-title").textContent = fund ? "Edit split fund" : selectedMode === "itemized" ? "Add an itemized order" : "Add an equal split";
  byId("save-fund-button").textContent = fund ? "Save changes" : "Create split fund";
  byId("fund-title").value = fund?.title || ""; byId("fund-description").innerHTML = sanitizeDescriptionHtml(fund?.description || "");
  byId("fund-date").value = fund?.date || new Date().toISOString().slice(0,10); byId("fund-total").value = fund?.total || "";
  const defaultPayerId = currentProfile()?.id || ADMIN_MEMBER_ID;
  itemizedGuests = (fund?.guests || []).map(guest => ({ id:guest.id, name:guest.name, guest:true }));
  const selectedParticipantIds = new Set(fund ? fundParticipantIds(fund) : [defaultPayerId]);
  const people = [...state.members, ...itemizedGuests];
  byId("fund-member-select").innerHTML = people.map(person => `<label class="member-choice"><input type="checkbox" value="${escapeHtml(person.id)}" ${selectedParticipantIds.has(person.id) ? "checked" : ""}/><span class="custom-check"></span><span>${escapeHtml(person.nickname || person.name)}${person.guest ? " · temporary" : ""}</span></label>`).join("");
  byId("itemized-payer").innerHTML = state.members.map(member => `<option value="${member.id}">${escapeHtml(member.nickname || member.name)}</option>`).join("");
  byId("itemized-payer").value = fund?.payerId || defaultPayerId;
  itemizedDraft = fund?.splitMode === "itemized" && fund.items?.length ? fund.items.map(item => ({ ...item, memberIds:[...item.memberIds] })) : [{ id:newItemId(), name:"", amount:"", memberIds:[defaultPayerId] }];
  renderItemizedRows();
  byId("all-members-caption").textContent = `${people.length} people`; byId("fund-modal").hidden = false; setSplitMode(selectedMode); byId("fund-title").focus();
}

document.addEventListener("mousedown", event => {
  if (event.target.closest("[data-description-format]")) event.preventDefault();
});
document.addEventListener("click", event => {
  const button = event.target.closest("[data-description-format]");
  if (!button) return;
  byId("fund-description").focus();
  document.execCommand(button.dataset.descriptionFormat, false, null);
});

document.addEventListener("click", event => {
  const modeButton = event.target.closest("[data-new-split-mode]");
  if (modeButton) { event.preventDefault(); byId("split-choice-modal").hidden = true; return openFundModal(null, modeButton.dataset.newSplitMode); }
  const addItem = event.target.closest("[data-add-item]");
  if (addItem) { event.preventDefault(); try { itemizedDraft = readItemizedRows(); itemizedDraft.push({ id:newItemId(), name:"", amount:"", memberIds:[currentProfile()?.id || ADMIN_MEMBER_ID] }); return renderItemizedRows(); } catch (error) { return showToast(error.message || "Could not add an item."); } }
  const addGuest = event.target.closest("[data-add-item-guest], [data-add-temporary-member]");
  if (addGuest) {
    event.preventDefault();
    const itemGuest = addGuest.matches("[data-add-item-guest]"), name = window.prompt("Temporary member's name (only for this fund)")?.trim();
    if (!name) return;
    if (name.length > 50) return showToast("Keep the guest name under 50 characters.");
    if ([...state.members, ...itemizedGuests].some(person => person.name.toLowerCase() === name.toLowerCase())) return showToast("That person is already available for this bill.");
    if (itemizedGuests.length >= 10) return showToast("This bill can include up to 10 guests.");
    if (itemGuest) itemizedDraft = readItemizedRows();
    const guest = { id:`guest-${newItemId()}`, name, guest:true };
    itemizedGuests.push(guest);
    if (!itemGuest) return refreshFundMemberChoices(guest.id);
    const row = addGuest.closest("[data-item-row]"), item = itemizedDraft.find(draft => draft.id === row?.dataset.itemRow);
    if (item) item.memberIds = [...new Set([...(item.memberIds || []), guest.id])];
    return renderItemizedRows();
  }
  const removeItem = event.target.closest("[data-remove-item]");
  if (removeItem) { event.preventDefault(); const row = removeItem.closest("[data-item-row]"); itemizedDraft = readItemizedRows().filter(item => item.id !== row.dataset.itemRow); if (!itemizedDraft.length) itemizedDraft.push({ id:newItemId(), name:"", amount:"", memberIds:[currentProfile()?.id || ADMIN_MEMBER_ID] }); return renderItemizedRows(); }
});
document.addEventListener("input", event => { if (event.target.matches("[data-item-name], [data-item-amount]")) updateFundPreview(); });
document.addEventListener("change", event => { if (event.target.matches("[data-item-member]")) updateFundPreview(); });

byId("fund-form").addEventListener("submit", async event => {
  event.preventDefault();
  const startedAt = performance.now();
  if (DEBUG_TIMING) console.debug("[Group Funds Calculator] T0 create/save pressed");
  const isItemized = activeSplitMode === "itemized", items = isItemized ? readItemizedRows() : [], memberIds = isItemized ? [...new Set(items.flatMap(item => item.memberIds))] : [...document.querySelectorAll(".member-choice input:checked")].map(input => input.value);
  if (!memberIds.length) return showToast(isItemized ? "Choose who shares at least one item." : "Select at least one member.");
  if (isItemized && items.some(item => !item.name || !Number.isFinite(item.amount) || item.amount <= 0 || !item.memberIds.length)) return showToast("Complete each item with a name, price, and people sharing it.");
  const payload = { title:byId("fund-title").value.trim(), description:sanitizeDescriptionHtml(byId("fund-description").innerHTML), date:byId("fund-date").value, total:isItemized ? items.reduce((sum, item) => sum + item.amount, 0) : Number(byId("fund-total").value), memberIds, receipt:currentReceipt, createdById:currentProfile()?.id || ADMIN_MEMBER_ID, splitMode:activeSplitMode, payerId:isItemized ? byId("itemized-payer").value : null, items, guests:itemizedGuests.map(({ id, name }) => ({ id, name })) };
  logTiming("T1 payload prepared", startedAt);
  const saveButton = byId("save-fund-button"), pendingKey = editingFundId ? `fund:${editingFundId}` : "fund:create";
  await withPending(pendingKey, saveButton, editingFundId ? "Saving…" : "Creating…", async () => { try { state = editingFundId ? await api(`/api/funds/${editingFundId}`, {method:"PATCH",body:JSON.stringify(payload)}) : await api("/api/funds", {method:"POST",body:JSON.stringify(payload)}); const message = editingFundId ? "Split fund updated." : "Split fund added for the group."; closeModals(); render(); logTiming("T8 render completed", startedAt); showToast(message); } catch(error) { showToast(error.message); } });
});

function generateReceipt(fund) {
  const creator = fundPerson(fund, fundCreatorId(fund)), receiver = fund.splitMode === "itemized" ? fundPerson(fund, fund.payerId) : creator, qr = paymentMethods(receiver)[0];
  const participantRows = fundPeople(fund).map(person => {
    const items = fund.splitMode === "itemized" ? (fund.items || []).filter(item => (item.memberIds || []).includes(person.id)).map(item => `${escapeHtml(item.name)} (${money(Number(item.amount) / Math.max(1, item.memberIds?.length || 1))})`).join(", ") : "Equal share";
    const payerCovered = fund.splitMode === "itemized" && person.id === fund.payerId, status = payerCovered ? "Covered as payer" : fund.payments?.[person.id] ? "Paid" : "Unpaid";
    return `<tr><td>${escapeHtml(person.nickname || person.name)}</td><td>${items || "No item assigned"}</td><td>${money(memberShare(fund, person.id))}</td><td>${status}</td></tr>`;
  }).join("");
  const receipt = window.open("", "_blank", "noopener,noreferrer,width=720,height=850");
  if (!receipt) return showToast("Allow pop-ups to generate a receipt.");
  receipt.document.write(`<!doctype html><html><head><title>${escapeHtml(fund.title)} receipt</title><style>body{margin:0;padding:32px;color:#111;font:14px Arial,sans-serif}h1{margin:0 0 6px;font-size:24px}p{color:#555}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:10px 6px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#666}.total{font-size:20px;font-weight:700}.qr{max-width:180px;max-height:180px;margin-top:12px}@media print{body{padding:20px}}</style></head><body><h1>${escapeHtml(fund.title)}</h1><p>Created by ${escapeHtml(creator.nickname || creator.name)} · ${escapeHtml(dateLabel(fund.date))}</p><table><thead><tr><th>Participant</th><th>Orders</th><th>Total</th><th>Status</th></tr></thead><tbody>${participantRows}</tbody></table><p class="total">Overall total: ${money(fund.total)}</p><p>Payable to: <b>${escapeHtml(receiver.nickname || receiver.name)}</b></p>${qr ? `<img class="qr" src="${escapeHtml(qr.image)}" alt="${escapeHtml(qr.label)} QR code" /><p>${escapeHtml(qr.label)}</p>` : "<p>No payment QR code has been added for this receiving profile.</p>"}<script>window.onload=()=>window.print()<\/script></body></html>`);
  receipt.document.close();
}

function renderDetail() {
  const fund = state.funds.find(item => item.id === activeFundId); if (!fund) return closeModals();
  const people = fundPeople(fund), payablePeople = people.filter(person => payableMemberIds(fund).includes(person.id)), count = paidCount(fund), payer = state.members.find(member => member.id === fund.payerId), receivingProfile = fund.splitMode === "itemized" ? (payer || fundPerson(fund, fund.payerId)) : fundPerson(fund, fundCreatorId(fund)); byId("detail-date").textContent = `${dateLabel(fund.date)} · ${fund.splitMode === "itemized" ? "ITEMIZED ORDER" : "SPLIT FUND"}`; byId("detail-title").textContent = fund.title;
  byId("detail-description").innerHTML = sanitizeDescriptionHtml(fund.description) || "No description added.";
  if (fund.splitMode === "itemized") { byId("detail-total").previousElementSibling.textContent = "Itemized bill"; byId("detail-total").textContent = money(fund.total); byId("detail-share").textContent = `Individual amounts below · paid by ${payer?.nickname || payer?.name || "a member"}`; } else { byId("detail-total").previousElementSibling.textContent = "Each person pays"; byId("detail-total").textContent = money(share(fund)); byId("detail-share").textContent = `${money(fund.total)} total bill`; } byId("detail-payment-status").textContent = settled(fund) ? "All paid" : `${count} of ${payablePeople.length} paid`;
  byId("detail-receipt").hidden = !(fund.receipt || fund.hasReceipt); if (fund.receipt) byId("detail-receipt-image").src = fund.receipt; else byId("detail-receipt-image").removeAttribute("src");
  byId("payment-list").innerHTML = people.map(person => { const paid = Boolean(fund.payments?.[person.id]), amount = memberShare(fund, person.id), covered = fund.splitMode === "itemized" && person.id === fund.payerId, assignedItems = fund.splitMode === "itemized" ? (fund.items || []).filter(item => (item.memberIds || []).includes(person.id)) : [], itemMarkup = assignedItems.length ? `<small class="payment-order-lines"><b>Order:</b> ${assignedItems.map(item => `${escapeHtml(item.name)} · ${money(Number(item.amount) / Math.max(1, item.memberIds?.length || 1))}`).join(" &nbsp;·&nbsp; ")}</small>` : "", recipient = receivingProfile.nickname || receivingProfile.name, amountLine = covered ? `${money(amount)} covered by ${escapeHtml(recipient)}` : `${money(amount)} to pay to ${escapeHtml(recipient)}`, status = covered ? `<span class="payment-status covered">Covered as payer</span>` : `<button type="button" class="${paid ? "paid" : "unpaid"}" data-toggle-payment="${person.id}">${paid ? "Paid" : "Mark as paid"}</button>`; return `<div class="payment-row ${assignedItems.length ? "has-assigned-items" : ""} ${covered || paid ? "is-paid" : "is-unpaid"}"><span class="avatar">${initials(person.name)}</span><span class="payment-copy"><strong>${escapeHtml(person.name)}</strong><small>${amountLine}</small>${itemMarkup}</span>${status}</div>`; }).join(""); byId("payment-audit-list").innerHTML = paymentAuditMarkup(fund); byId("detail-modal").hidden = false;
}

installDescriptionEditor();

byId("receipt-input").addEventListener("change", async event => {
  try {
    currentReceipt = await compressReceipt(event.target.files?.[0]);
    renderReceiptPreview();
    showToast("Receipt attached.");
  } catch (error) {
    currentReceipt = null;
    event.target.value = "";
    renderReceiptPreview();
    showToast(error.message);
  }
});

function renderCalculatorLayout() {
  document.querySelector(".calculator-keys").innerHTML = `
    <button type="button" data-calc="clear">C</button><button type="button" data-calc="percent">%</button><button type="button" data-calc="back">DEL</button><button type="button" data-calc="/">÷</button>
    <button type="button" data-calc="7">7</button><button type="button" data-calc="8">8</button><button type="button" data-calc="9">9</button><button type="button" data-calc="*">×</button>
    <button type="button" data-calc="4">4</button><button type="button" data-calc="5">5</button><button type="button" data-calc="6">6</button><button type="button" data-calc="-">−</button>
    <button type="button" data-calc="1">1</button><button type="button" data-calc="2">2</button><button type="button" data-calc="3">3</button><button type="button" data-calc="+">+</button>
    <button type="button" data-calc="00">00</button><button type="button" data-calc="0">0</button><button type="button" data-calc=".">.</button><button type="button" class="calculator-equals" data-calc="equals">=</button>`;
}

function useCalculatorKey(key) {
  const operators = "+-*/";
  if (key === "clear") calculatorExpression = "";
  else if (key === "back") calculatorExpression = calculatorExpression.slice(0, -1);
  else if (key === "percent") {
    if (!calculatorExpression || !/^[0-9+\-*/.\s]+$/.test(calculatorExpression)) return showToast("Enter a number before using percent.");
    try {
      const value = Function(`"use strict"; return (${calculatorExpression})`)();
      if (!Number.isFinite(value)) throw new Error();
      calculatorExpression = String(Math.round(value * 100) / 10000);
    } catch { return showToast("That percentage cannot be solved."); }
  } else if (key === "equals") {
    if (!calculatorExpression || !/^[0-9+\-*/.\s]+$/.test(calculatorExpression)) return showToast("Use valid numbers and calculator operators.");
    try {
      const result = Function(`"use strict"; return (${calculatorExpression})`)();
      if (!Number.isFinite(result)) throw new Error();
      const rounded = Math.round(result * 100) / 100;
      calculatorExpression = String(rounded);
      byId("fund-total").value = rounded;
      updateFundPreview();
    } catch { return showToast("That calculation cannot be solved."); }
  } else {
    const last = calculatorExpression.slice(-1);
    if (operators.includes(key) && (!calculatorExpression || operators.includes(last))) {
      calculatorExpression = key === "-" && !calculatorExpression ? "-" : calculatorExpression ? calculatorExpression.slice(0, -1) + key : "";
    } else if (key === ".") {
      const currentNumber = calculatorExpression.split(/[+\-*/]/).pop();
      if (!currentNumber.includes(".")) calculatorExpression += key;
    } else if (key === "00") calculatorExpression += calculatorExpression ? "00" : "0";
    else calculatorExpression += key;
  }
  renderCalculator();
}

renderCalculatorLayout();
document.querySelectorAll(".page-header .eyebrow").forEach(label => label.remove());
document.querySelector("#profile-modal .profile-picker-mark").remove();
document.querySelector("#profile-modal .eyebrow").textContent = "GROUP FUNDS CALCULATOR";
document.querySelector("#member-modal h2").textContent = "Add someone to RM331";

let photoMemberId = "";

async function compressMemberPhoto(file, size = 120, kind = "profile") {
  if (!file) throw new Error("Choose an image to upload.");
  if (file.size > 2 * 1024 * 1024) throw new Error(`${kind === "profile" ? "Profile photos" : "QR images"} must be 2 MB or smaller.`);
  const accepted = kind === "profile" ? ["image/jpeg"] : ["image/png", "image/jpeg", "image/webp"];
  if (!accepted.includes(file.type)) throw new Error(kind === "profile" ? "Profile photos must be JPG or JPEG files." : "QR images must be PNG, JPG, JPEG, or WebP files.");
  const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("The photo could not be read.")); reader.readAsDataURL(file); });
  const image = await new Promise((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error("The photo could not be opened.")); element.src = source; });
  const crop = Math.min(image.width, image.height), left = (image.width - crop) / 2, top = (image.height - crop) / 2, canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.getContext("2d").drawImage(image, left, top, crop, crop, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", .8);
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-select-member-photo]");
  if (!button) return;
  photoMemberId = button.dataset.selectMemberPhoto;
  byId("member-photo-input").click();
});


let editingMemberId = null, memberCreationRequiresPayment = false;
const ADMIN_MEMBER_ID = "member-1";
const isAdmin = () => currentProfile()?.id === ADMIN_MEMBER_ID;
const canManageMember = member => isAdmin() || currentProfile()?.id === member.id;

function ensureMemberContactField() {
  if (byId("member-contact")) return;
  byId("member-name").closest("label").insertAdjacentHTML("afterend", `<label><span>Nickname <em>optional</em></span><input id="member-nickname" maxlength="30" placeholder="How you want to be known" /></label><label><span>Profile label <em>optional</em></span><input id="member-label" maxlength="40" placeholder="e.g. Rent coordinator" /></label><label><span>Contact <em>optional</em></span><input id="member-contact" maxlength="80" placeholder="Phone, email, or contact note" autocomplete="email" /></label><label><span>Member ID color</span><select id="member-theme"><option value="sakura-pink">Sakura Pink</option><option value="wise-green">Wise Green</option><option value="gotyme-light-blue">GoTyme Light Blue</option><option value="royal-gray">Royal Gray</option><option value="maribank-orange">MariBank Orange</option><option value="maya-black">Maya Black</option><option value="bpi-maroon">BPI Maroon</option></select></label><fieldset class="new-member-payment-setup" id="new-member-payment-setup" hidden><legend>Payment profile</legend><p>Add the QR payment details before creating this account.</p><label><span>Bank or wallet</span><input id="new-member-payment-label" maxlength="30" placeholder="e.g. GCash · Jamie" /></label><label class="qr-upload-label"><span>Payment QR code</span><input id="new-member-payment-image" type="file" accept="image/png,image/jpeg,image/webp" /></label><small>PNG, JPG, JPEG, or WebP · up to 2 MB</small></fieldset><button class="secondary-button manage-qr-button" type="button" data-manage-member-qr>Manage payment QR codes</button>`);
}

function openMemberModal(member = null) {
  ensureMemberContactField();
  if (member && !canManageMember(member)) return showToast("You can only edit your own account.");
  editingMemberId = member?.id || null;
  memberCreationRequiresPayment = !member;
  byId("member-modal").hidden = false;
  byId("member-modal").querySelector(".eyebrow").textContent = member ? "EDIT MEMBER" : "NEW MEMBER";
  byId("member-modal").querySelector("h2").textContent = member ? `Edit ${member.name}` : "Add someone to Group Funds Calculator";
  byId("member-name").value = member?.name || "";
  byId("member-name").readOnly = Boolean(member);
  byId("member-nickname").value = member?.nickname || "";
  byId("member-label").value = member?.label || "";
  byId("member-contact").value = member?.contact || "";
  byId("member-theme").value = member?.theme || "maya-black";
  byId("new-member-payment-setup").hidden = !memberCreationRequiresPayment;
  byId("new-member-payment-label").required = memberCreationRequiresPayment;
  byId("new-member-payment-image").required = memberCreationRequiresPayment;
  if (memberCreationRequiresPayment) { byId("new-member-payment-label").value = ""; byId("new-member-payment-image").value = ""; }
  byId("member-form").querySelector("[data-manage-member-qr]").hidden = memberCreationRequiresPayment;
  byId("member-form").querySelector("button[type=submit]").textContent = member ? "Save member" : "Add member";
  byId("member-name").focus();
}

document.addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit-member]");
  if (!editButton) return;
  const member = state.members.find(item => item.id === editButton.dataset.editMember);
  if (member) openMemberModal(member);
});

document.addEventListener("click", event => {
  if (!event.target.closest("[data-edit-current-profile]")) return;
  const profile = currentProfile();
  if (profile) openMemberModal(profile);
});

document.addEventListener("click", event => {
  if (!event.target.closest("[data-manage-member-qr]")) return;
  const member = state.members.find(item => item.id === editingMemberId);
  if (!member || !canManageMember(member)) return showToast("Open your own account to manage QR codes.");
  byId("member-modal").hidden = true;
  openPaymentProfile(member);
});

byId("member-form").addEventListener("submit", async event => {
  event.preventDefault();
  const name = byId("member-name").value.trim(), nickname = byId("member-nickname").value.trim(), label = byId("member-label").value.trim(), contact = byId("member-contact").value.trim(), theme = byId("member-theme").value;
  const existing = editingMemberId ? state.members.find(member => member.id === editingMemberId) : null;
  if (existing && !canManageMember(existing)) return showToast("You can only manage your own account.");
  const submitButton = byId("member-form").querySelector("button[type=submit]"), pendingKey = editingMemberId ? `member:${editingMemberId}` : "member:create";
  await withPending(pendingKey, submitButton, editingMemberId ? "Saving…" : "Adding…", async () => { try {
    let paymentMethods = existing?.paymentMethods || [];
    if (!editingMemberId) {
      const paymentLabel = byId("new-member-payment-label").value.trim(), paymentFile = byId("new-member-payment-image").files?.[0];
      if (!memberCreationRequiresPayment || !paymentLabel || !paymentFile) return showToast("Add a bank or wallet and payment QR before creating the profile.");
      paymentMethods = [{ id:crypto.randomUUID(), label:paymentLabel, image:await compressMemberPhoto(paymentFile, 720, "qr") }];
    }
    state = editingMemberId
      ? await api(`/api/members/${editingMemberId}`, { method:"PATCH", body:JSON.stringify({ name, nickname, label, contact, theme, avatar:existing.avatar || "", paymentMethods:existing.paymentMethods || [] }) })
      : await api("/api/members", { method:"POST", body:JSON.stringify({ name, nickname, label, contact, theme, avatar:"", paymentMethods }) });
    const newMember = editingMemberId ? null : state.members.at(-1);
    editingMemberId = null; memberCreationRequiresPayment = false;
    byId("member-modal").hidden = true;
    if (newMember) { currentMemberId = newMember.id; forceSharedProfile = false; forceProfileSelection = false; localStorage.setItem(PROFILE_STORAGE_KEY, currentMemberId); }
    render();
    if (!byId("fund-modal").hidden) refreshFundMemberChoices(newMember?.id);
    showToast(newMember ? `${name} was added.` : "Member details updated.");
  } catch (error) { showToast(error.message); } });
});

function paymentMethods(member) { return Array.isArray(member.paymentMethods) ? member.paymentMethods : []; }
function paymentMethodHtml(method, editable) { return `<article class="payment-method-card"><button type="button" class="qr-thumbnail" data-open-qr="${escapeHtml(method.id)}" aria-label="Open ${escapeHtml(method.label)} QR code"><img src="${escapeHtml(method.image)}" alt="${escapeHtml(method.label)} QR code" loading="lazy" decoding="async" /></button><span><b>${escapeHtml(method.label)}</b><small>Scan to pay</small></span>${editable ? `<span class="payment-method-actions"><button type="button" data-replace-payment-method="${escapeHtml(method.id)}">Replace</button><button type="button" data-remove-payment-method="${escapeHtml(method.id)}">Remove</button></span>` : ""}</article>`; }
let editingPaymentMethodId = "";

function ensurePaymentDialog() {
  if (byId("payment-profile-modal")) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="payment-profile-modal" hidden><section class="modal payment-profile-modal-card"><div class="modal-header"><div><h2 id="payment-profile-name">Payment profile</h2><p class="detail-description" id="payment-profile-copy"></p></div><button class="close-button" type="button" data-close-modal aria-label="Close">×</button></div><div class="payment-method-list" id="payment-method-list"></div><div id="payment-method-form-wrap" hidden><form id="payment-method-form"><label><span>Bank or wallet</span><input id="payment-method-label" maxlength="30" required placeholder="e.g. GCash · Chan" /></label><label class="qr-upload-label"><span>QR code image</span><input id="payment-method-image" type="file" accept="image/png,image/jpeg,image/webp" required /></label><small class="upload-help">PNG, JPG, JPEG, or WebP · up to 2 MB</small><div class="modal-actions"><button type="button" class="cancel-button" data-close-modal>Cancel</button><button type="submit" class="primary-button" id="save-payment-method">Save QR code</button></div></form></div><div class="detail-actions"><span></span><button type="button" class="secondary-button" id="add-payment-method" hidden>＋ Add QR code</button></div></section></div><div class="modal-backdrop" id="qr-preview-modal" hidden><section class="modal qr-preview-card"><button class="close-button" type="button" data-close-modal aria-label="Close">×</button><h2 id="qr-preview-title">Payment QR</h2><img id="qr-preview-image" alt="Payment QR code" /></section></div>`);
  byId("payment-method-form").addEventListener("submit", async event => {
    event.preventDefault();
    const member = state.members.find(item => item.id === byId("payment-profile-modal").dataset.memberId);
    if (!member || !canManageMember(member)) return showToast("You can only update your own payment profile.");
    const saveButton = byId("save-payment-method");
    await withPending(`payment-method:${member.id}`, saveButton, "Saving…", async () => { try {
      const isReplacement = Boolean(editingPaymentMethodId);
      if (!isReplacement && paymentMethods(member).length >= 3) return showToast("Each profile can keep up to 3 QR codes.");
      const image = await compressMemberPhoto(byId("payment-method-image").files?.[0], 720, "qr"), label = byId("payment-method-label").value.trim();
      const methods = isReplacement ? paymentMethods(member).map(method => method.id === editingPaymentMethodId ? { ...method, label, image } : method) : [...paymentMethods(member), { id:crypto.randomUUID(), label, image }];
      state = await api(`/api/members/${member.id}`, { method:"PATCH", body:JSON.stringify({ ...accountPayload(member), paymentMethods:methods }) });
      render(); openPaymentProfile(state.members.find(item => item.id === member.id)); showToast(isReplacement ? "QR code replaced." : "QR code added.");
    } catch (error) { showToast(error.message); } });
  });
}

function openPaymentProfile(member) {
  ensurePaymentDialog();
  const editable = canManageMember(member), open = memberUnpaidFunds(member.id), name = member.nickname || member.name;
  byId("payment-profile-modal").dataset.memberId = member.id;
  byId("payment-profile-name").textContent = `${name}'s payment profile`;
  byId("payment-profile-copy").textContent = paymentMethods(member).length ? `Use a listed QR code to pay ${name}. ${open.length ? `${open.length} shared expense${open.length === 1 ? " is" : "s are"} still open.` : "No unpaid shared expenses."}` : `${name} has not added a payment QR code yet.`;
  byId("payment-method-list").innerHTML = paymentMethods(member).map(method => paymentMethodHtml(method, editable)).join("") || `<div class="empty-state"><b>No QR codes yet</b>${editable ? "Add a bank or wallet code so other members can pay you quickly." : "Ask this member to add a payment method."}</div>`;
  editingPaymentMethodId = "";
  byId("payment-method-form").reset();
  byId("save-payment-method").textContent = "Save QR code";
  byId("payment-method-form-wrap").hidden = true;
  byId("add-payment-method").hidden = !editable || paymentMethods(member).length >= 3;
  byId("payment-profile-modal").hidden = false;
}

function renderProfile() {
  const profile = currentProfile(), unpaid = profile ? memberUnpaidFunds(profile.id) : [], owed = profile ? memberOwed(profile.id) : 0;
  byId("tracker-title").textContent = profile ? `${profile.nickname || profile.name}'s profile` : "Profile";
  byId("profile-summary").innerHTML = profile ? `<span class="avatar">${accountAvatarContent(profile)}</span><span><b>${escapeHtml(profile.nickname || profile.name)}</b><small>${unpaid.length ? `${unpaid.length} unpaid split${unpaid.length === 1 ? "" : "s"} · ${money(owed)} to pay` : "You are all caught up"}</small></span><span class="profile-summary-actions"><button type="button" data-edit-current-profile>Edit my details</button><button type="button" data-open-profile>Switch accounts</button></span>` : `<span class="avatar">?</span><span><b>No member selected</b><small>Select who is using this device to see their tracker.</small></span><button type="button" data-open-profile>Choose</button>`;
  byId("unpaid-count").textContent = unpaid.length;
  byId("personal-unpaid-list").innerHTML = unpaid.length ? unpaid.map(profileFundHtml).join("") : `<div class="empty-state"><b>${profile ? "All caught up" : "Choose a member"}</b>${profile ? "There are no unpaid split funds for this profile." : "Select a profile to see personal payment reminders."}</div>`;
  byId("member-status-list").innerHTML = state.members.map(member => { const awaiting = memberUnpaidFunds(member.id), owedAmount = memberOwed(member.id); return `<article class="member-status-card"><span class="avatar">${accountAvatarContent(member)}</span><span><b>${escapeHtml(member.nickname || member.name)}${profile?.id === member.id ? " (you)" : ""}</b><small class="${awaiting.length ? "owing" : ""}">${awaiting.length ? `${awaiting.length} unpaid · ${money(owedAmount)} to pay` : "All paid up"}</small></span></article>`; }).join("") || `<div class="empty-state"><b>No members yet</b>Add housemates to start tracking payments.</div>`;
}

document.addEventListener("click", async event => {
  const viewButton = event.target.closest("[data-view-payment-profile]");
  if (viewButton) { const member = state.members.find(item => item.id === viewButton.dataset.viewPaymentProfile); if (member) openPaymentProfile(member); return; }
  if (event.target.closest("#add-payment-method")) { editingPaymentMethodId = ""; byId("payment-method-form").reset(); byId("save-payment-method").textContent = "Save QR code"; byId("payment-method-form-wrap").hidden = false; byId("payment-method-label").focus(); return; }
  const replaceButton = event.target.closest("[data-replace-payment-method]");
  if (replaceButton) { const member = state.members.find(item => item.id === byId("payment-profile-modal").dataset.memberId), method = paymentMethods(member || {}).find(item => item.id === replaceButton.dataset.replacePaymentMethod); if (!member || !method || !canManageMember(member)) return showToast("You can only update your own payment profile."); editingPaymentMethodId = method.id; byId("payment-method-label").value = method.label; byId("payment-method-image").value = ""; byId("payment-method-form-wrap").hidden = false; byId("save-payment-method").textContent = "Replace QR code"; return; }
  const qrButton = event.target.closest("[data-open-qr]");
  if (qrButton) { const member = state.members.find(item => item.id === byId("payment-profile-modal").dataset.memberId), method = paymentMethods(member || {}).find(item => item.id === qrButton.dataset.openQr); if (method) { byId("qr-preview-title").textContent = method.label; byId("qr-preview-image").src = method.image; byId("qr-preview-modal").hidden = false; } return; }
  const removeButton = event.target.closest("[data-remove-payment-method]");
  if (removeButton) {
    const member = state.members.find(item => item.id === byId("payment-profile-modal").dataset.memberId);
    if (!member || !canManageMember(member)) return showToast("You can only update your own payment profile.");
    if (!window.confirm("Remove this QR code? This cannot be undone.")) return;
    await withPending(`payment-method-remove:${member.id}:${removeButton.dataset.removePaymentMethod}`, removeButton, "Removing…", async () => { try { state = await api(`/api/members/${member.id}`, { method:"PATCH", body:JSON.stringify({ ...accountPayload(member), paymentMethods:paymentMethods(member).filter(method => method.id !== removeButton.dataset.removePaymentMethod) }) }); render(); openPaymentProfile(state.members.find(item => item.id === member.id)); } catch (error) { showToast(error.message); } });
  }
});

function fundsHtml(funds, emptyTitle, emptyCopy) {
  if (!funds.length) return `<div class="empty-state"><b>${emptyTitle}</b>${emptyCopy}<br><button class="primary-button" type="button" data-open-fund>＋ Add split fund</button></div>`;
  return funds.map(fund => {
    const count = paidCount(fund), people = payableMemberIds(fund).length, done = settled(fund), remaining = Math.max(0, people - count);
    const summary = done ? "Settled" : `${remaining} ${remaining === 1 ? "person" : "people"} still to pay`;
    const profile = currentProfile(), receiverId = fund.splitMode === "itemized" ? fund.payerId : fundCreatorId(fund), included = Boolean(profile && fundParticipantIds(fund).includes(profile.id)), profilePaid = Boolean(profile && fund.payments?.[profile.id]);
    const profileState = !profile ? { tone:"not-included", label:"No profile" } : profile.id === receiverId ? { tone:"receiving", label:"You receive" } : !included ? { tone:"not-included", label:"Not included" } : profilePaid ? { tone:"paid", label:"Paid" } : { tone:"unpaid", label:"You need to pay" };
    const mine = fundCreatorId(fund) === profile?.id, title = `${fund.title} by ${posterName(fund)}`; return `<button class="fund-row ${mine ? "posted-by-you" : ""} ${done ? "is-settled" : ""} profile-${profileState.tone}" data-fund-id="${fund.id}" type="button"><span class="fund-icon">${fund.icon || "◈"}</span><span class="fund-copy"><strong>${done ? `<s>${escapeHtml(title)}</s>` : escapeHtml(title)}</strong><small>Posted ${postedAge(fund)} · ${mine ? "Posted by you · " : ""}${summary} · ${count}/${people} paid</small></span><span class="fund-meta"><b>${dateLabel(fund.date)}</b>${people} member${people === 1 ? "" : "s"}</span><span class="payment-progress"><span class="progress-caption"><span>${count}/${people} paid</span><b>${Math.round(people ? count / people * 100 : 0)}%</b></span><span class="progress"><i style="width:${people ? count / people * 100 : 0}%"></i></span></span><span class="fund-amount">${money(fund.total)}</span><span class="row-arrow">›</span></button>`;
  }).join("");
}

const accountAvatarContent = member => member.avatar ? `<img src="${escapeHtml(member.avatar)}" alt="" loading="lazy" decoding="async" />` : initials(member.name);
const accountPayload = member => ({ name:member.name, nickname:member.nickname || "", label:member.label || "", contact:member.contact || "", theme:member.theme || "maya-black", avatar:member.avatar || "", paymentMethods:member.paymentMethods || [] });

function renderProfileChrome() {
  const profile = currentProfile();
  byId("profile-avatar").innerHTML = profile ? accountAvatarContent(profile) : "?";
  byId("profile-switcher-name").textContent = profile ? (profile.nickname || profile.name) : "Choose a member";
  byId("overview-greeting").textContent = profile ? `Good morning, ${profile.nickname || profile.name}` : "Welcome to Group Funds Calculator";
}

let pipolStackIndex = 0;
function renderMembers() {
  byId("member-total").textContent = `${state.members.length} member account${state.members.length === 1 ? "" : "s"}`;
  pipolStackIndex = Math.min(pipolStackIndex, Math.max(0, state.members.length - 1));
  byId("members-list").innerHTML = state.members.map((member, index) => {
    const unpaid = memberUnpaidFunds(member.id), status = unpaid.length ? `${unpaid.length} unpaid split${unpaid.length === 1 ? "" : "s"}` : "All paid up", canManage = canManageMember(member);
    const avatar = canManage ? `<button class="avatar avatar-photo" type="button" data-select-member-photo="${member.id}" aria-label="Change ${escapeHtml(member.name)} profile photo">${accountAvatarContent(member)}<i>＋</i></button>` : `<span class="avatar">${accountAvatarContent(member)}</span>`;
    const actions = `<button class="view-payment-button" type="button" data-view-payment-profile="${member.id}">Payment profile</button>${canManage ? `<button class="edit-member-button" type="button" data-edit-member="${member.id}">Edit</button>` : ""}`;
    const stackPosition = (index - pipolStackIndex + state.members.length) % state.members.length;
    return `<article class="member-id-card pipol-card pipol-card-${Math.min(stackPosition, 3)}" data-theme="${escapeHtml(member.theme || "maya-black")}" data-rotate-pipol aria-label="Show next member card"><div class="member-id-band"><span>RM331</span><span>MEMBER ID ${String(index + 1).padStart(2, "0")}</span></div><div class="member-id-main">${avatar}<span class="member-id-copy"><small>${escapeHtml(member.label || "HOUSE MEMBER")}</small><b>${escapeHtml(member.nickname || member.name)}</b><span>${escapeHtml(member.contact || "No contact added")}</span></span></div><div class="member-id-footer"><span>${memberFundCount(member.id)} shared fund${memberFundCount(member.id) === 1 ? "" : "s"}</span><b class="${unpaid.length ? "owing" : ""}">${status}</b></div><div class="member-id-actions">${actions}</div></article>`;
  }).join("") || `<div class="empty-state"><b>No accounts available</b>This group is limited to its five member profiles.</div>`;
}

document.addEventListener("click", event => {
  const card = event.target.closest("[data-rotate-pipol]");
  if (!card || event.target.closest("button")) return;
  pipolStackIndex = (pipolStackIndex + 1) % Math.max(1, state.members.length);
  renderMembers();
});

function openProfilePicker() {
  byId("profile-picker-list").innerHTML = `${state.members.map(member => `<button class="profile-choice" type="button" data-select-profile="${member.id}"><span class="avatar">${accountAvatarContent(member)}</span><b>${escapeHtml(member.nickname || member.name)}</b><small>${escapeHtml(member.label || (memberUnpaidFunds(member.id).length ? `${memberUnpaidFunds(member.id).length} payment${memberUnpaidFunds(member.id).length === 1 ? "" : "s"} waiting` : "All caught up"))}</small></button>`).join("")}<button class="profile-choice profile-choice-add" type="button" data-create-member><span class="avatar">＋</span><b>Add member</b><small>Set up their payment profile</small></button>`;
  byId("profile-modal").hidden = false;
}

document.addEventListener("click", event => {
  if (!event.target.closest("[data-create-member]")) return;
  byId("profile-modal").hidden = true;
  openMemberModal();
});

document.addEventListener("click", event => {
  const removeButton = event.target.closest("[data-delete-member]");
  if (removeButton) { event.preventDefault(); showToast("The five member profiles are fixed."); }
});

byId("member-photo-input").addEventListener("change", async event => {
  if (!photoMemberId) return;
  const member = state.members.find(item => item.id === photoMemberId);
  if (!member || !canManageMember(member)) { event.target.value = ""; return showToast("You can only change your own profile photo."); }
  await withPending(`member-photo:${member.id}`, event.target, "", async () => { try {
    const avatar = await compressMemberPhoto(event.target.files?.[0]);
    state = await api(`/api/members/${member.id}`, { method:"PATCH", body:JSON.stringify({ ...accountPayload(member), avatar }) });
    event.target.value = ""; photoMemberId = ""; render(); showToast("Profile photo updated.");
  } catch (error) { event.target.value = ""; showToast(error.message); } });
});
function paymentRecord(fund, memberId) {
  const record = fund.payments?.[memberId];
  return record && record !== true ? record : null;
}

function paymentAuditMarkup(fund) {
  const entries = Array.isArray(fund.paymentAudit) ? [...fund.paymentAudit].reverse() : [];
  if (!entries.length) return `<p class="payment-audit-empty">Payment confirmations will appear here.</p>`;
  return entries.map(entry => {
    const member = fundPerson(fund, entry.memberId);
    const confirmer = state.members.find(item => item.id === entry.confirmedById) || { name:"Unknown profile" };
    const timestamp = new Intl.DateTimeFormat("en-PH", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }).format(new Date(entry.at));
    const action = entry.action === "paid" ? `marked ${Number.isFinite(Number(entry.amount)) ? `${money(entry.amount)} ` : ""}paid via ${escapeHtml(entry.method)}` : `reopened ${Number.isFinite(Number(entry.amount)) ? `${money(entry.amount)} ` : ""}payment`;
    const note = entry.note ? `<small>${escapeHtml(entry.note)}</small>` : "";
    return `<article class="payment-audit-row"><span><b>${escapeHtml(member.name)}</b> ${action}</span><span>by ${escapeHtml(confirmer.name)} · ${timestamp}</span>${note}</article>`;
  }).join("");
}

let pendingPayment = null;
function ensurePaymentConfirmationDialog() {
  if (byId("payment-confirm-modal")) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="payment-confirm-modal" hidden><form class="modal small-modal payment-confirm-card" id="payment-confirm-form"><div class="modal-header"><div><p class="eyebrow">CONFIRM PAYMENT</p><h2 id="payment-confirm-title">Mark payment as paid</h2><p class="detail-description" id="payment-confirm-copy"></p></div><button class="close-button" type="button" data-close-modal aria-label="Close">×</button></div><fieldset class="payment-method-picker"><legend>How was this paid?</legend><label><input type="radio" name="payment-method" value="cash" required /><span>Cash</span></label><label><input type="radio" name="payment-method" value="online" /><span>Online</span></label></fieldset><label><span>Note <em>optional</em></span><textarea id="payment-confirm-note" maxlength="300" placeholder="e.g. GCash sent, handed over at home"></textarea></label><div class="modal-actions"><button type="button" class="cancel-button" data-close-modal>Cancel</button><button class="primary-button" type="submit">Confirm paid</button></div></form></div>`);
  byId("payment-confirm-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!pendingPayment) return;
    const method = document.querySelector('input[name="payment-method"]:checked')?.value;
    if (!method) return showToast("Choose cash or online.");
    const confirmButton = byId("payment-confirm-form").querySelector("button[type=submit]"), paymentKey = `payment:${pendingPayment.fundId}:${pendingPayment.memberId}`;
    await withPending(paymentKey, confirmButton, "Confirming…", async () => { try {
      state = await api(`/api/funds/${pendingPayment.fundId}/payments`, { method:"PATCH", body:JSON.stringify({ memberId:pendingPayment.memberId, paid:true, method, note:byId("payment-confirm-note").value.trim(), confirmedById:currentProfile()?.id || ADMIN_MEMBER_ID }) });
      byId("payment-confirm-modal").hidden = true;
      pendingPayment = null;
      render();
      showToast("Payment recorded in the audit trail.");
    } catch (error) { showToast(error.message); } });
  });
}

function openPaymentConfirmation(fund, memberId) {
  ensurePaymentConfirmationDialog();
  const member = fundPerson(fund, memberId);
  pendingPayment = { fundId:fund.id, memberId };
  byId("payment-confirm-title").textContent = `Confirm ${member.name}'s payment`;
  byId("payment-confirm-copy").textContent = `${money(memberShare(fund, memberId))} for ${fund.title}. Choose how it was paid; a note is optional.`;
  document.querySelectorAll('input[name="payment-method"]').forEach(input => input.checked = false);
  byId("payment-confirm-note").value = "";
  byId("payment-confirm-modal").hidden = false;
}

document.addEventListener("click", async event => {
  const paymentButton = event.target.closest("[data-toggle-payment]");
  if (!paymentButton) return;
  event.preventDefault();
  const fund = state.funds.find(item => item.id === activeFundId);
  if (!fund) return;
  const memberId = paymentButton.dataset.togglePayment;
  if (!fund.payments?.[memberId]) return openPaymentConfirmation(fund, memberId);
  if (!window.confirm("Reopen this payment? The change will remain in the payment history.")) return;
  await withPending(`payment:${fund.id}:${memberId}`, paymentButton, "Reopening…", async () => { try {
    state = await api(`/api/funds/${fund.id}/payments`, { method:"PATCH", body:JSON.stringify({ memberId, paid:false, confirmedById:currentProfile()?.id || ADMIN_MEMBER_ID }) });
    render();
    showToast("Payment reopened and logged.");
  } catch (error) { showToast(error.message); } });
});

byId("share-fund").addEventListener("click", async () => {
  const fund = state.funds.find(item => item.id === activeFundId);
  if (!fund) return;
  const link = new URL(location.href);
  link.searchParams.set("fund", fund.id);
  link.hash = "funds";
  try {
    await navigator.clipboard.writeText(link.toString());
    showToast("Share link copied. It will ask the visitor to choose a profile.");
  } catch {
    window.prompt("Copy this share link", link.toString());
  }
});

document.addEventListener("click", event => {
  const ownership = event.target.closest("[data-fund-owner]");
  if (!ownership) return;
  activeOwnership = ownership.dataset.fundOwner;
  renderFunds();
});

byId("generate-receipt").addEventListener("click", () => {
  const fund = state.funds.find(item => item.id === activeFundId);
  if (fund) generateReceipt(fund);
});

byId("detail-receipt").addEventListener("click", async () => {
  const fund = state.funds.find(item => item.id === activeFundId);
  if (!fund) return;
  if (fund.receipt) return window.open(fund.receipt, "_blank", "noopener,noreferrer");
  const fullFund = await withPending(`receipt:${fund.id}`, byId("detail-receipt"), "Loading receipt…", () => ensureFundDetails(fund));
  if (fullFund?.receipt) { renderDetail(); showToast("Receipt loaded. Tap it again to view."); }
  else showToast("The receipt could not be loaded.");
});

function renderSyncDateTime() {
  const timestamp = byId("sync-date-time");
  if (!timestamp) return;
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-PH", { month:"short", day:"numeric", year:"numeric" }).format(now);
  const time = new Intl.DateTimeFormat("en-PH", { hour:"numeric", minute:"2-digit" }).format(now);
  timestamp.dateTime = now.toISOString();
  timestamp.textContent = `${date} • ${time}`;
}
renderSyncDateTime();
setInterval(renderSyncDateTime, 30000);
const initialRoute = location.hash.slice(1) === "more" ? "profile" : location.hash.slice(1); if (["overview","funds","members","profile"].includes(initialRoute)) activeRoute = initialRoute; showRoute(activeRoute); loadState(); setInterval(() => loadState(true, false), 300000); document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Date.now() - lastStateSyncAt > 180000) loadState(true, false); });
