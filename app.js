const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
let state = { members: [], funds: [] }, activeRoute = "overview", activeFilter = "all", editingFundId = null, activeFundId = null, currentReceipt = null, calculatorExpression = "";
const byId = id => document.getElementById(id);
const dateInput = byId("fund-date"); dateInput.value = new Date().toISOString().slice(0, 10);
const money = value => currency.format(Number(value) || 0);
const dateLabel = date => new Intl.DateTimeFormat("en-PH", { month:"short", day:"numeric", year:"numeric" }).format(new Date(`${date}T12:00:00`));
const initials = name => name.split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase();
const escapeHtml = value => String(value || "").replace(/[&<'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const fundPeople = fund => fund.memberIds.map(id => state.members.find(member => member.id === id) || { id, name:"Former member" });
const paidCount = fund => fund.memberIds.filter(id => fund.payments?.[id]).length;
const share = fund => Number(fund.total) / Math.max(1, fund.memberIds.length);
const settled = fund => fund.memberIds.length > 0 && paidCount(fund) === fund.memberIds.length;
const openFunds = () => state.funds.filter(fund => !settled(fund));
const sortFunds = funds => [...funds].sort((a,b) => String(b.date).localeCompare(String(a.date)) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
function showToast(message) { const toast = byId("toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800); }
async function api(url, options = {}) { const response = await fetch(url, { headers:{ "Content-Type":"application/json" }, ...options }); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || "Could not save your changes."); } return response.json(); }
async function loadState(silent = false) { try { state = await api("/api/state"); document.querySelector(".connection").classList.add("online"); byId("connection-status").textContent = "Live sync on"; render(); } catch (error) { document.querySelector(".connection").classList.remove("online"); byId("connection-status").textContent = "Offline mode"; if (!silent) showToast("Could not reach the shared expense data."); } }
function legacy_render_1() { renderNavigation(); renderOverview(); renderFunds(); renderMembers(); if (activeFundId) renderDetail(); }
function legacy_renderNavigation_1() { byId("open-nav-count").textContent = openFunds().length; document.querySelectorAll(".nav-link, .tab-link").forEach(link => link.classList.toggle("active", link.dataset.route === activeRoute)); }
function legacy_fundsHtml_1(funds, emptyTitle, emptyCopy) { if (!funds.length) return `<div class="empty-state"><b>${emptyTitle}</b>${emptyCopy}<br><button class="primary-button" type="button" data-open-fund>＋ Add split fund</button></div>`; return funds.map(fund => { const count = paidCount(fund), people = fund.memberIds.length, done = settled(fund), percent = people ? count / people * 100 : 0; return `<button class="fund-row" data-fund-id="${fund.id}" type="button"><span class="fund-icon">${fund.icon || "◈"}</span><span class="fund-copy"><strong>${escapeHtml(fund.title)}</strong><small>${escapeHtml(fund.description || "No description")}</small></span><span class="fund-meta"><b>${dateLabel(fund.date)}</b>${people} member${people === 1 ? "" : "s"}</span><span class="payment-progress"><span class="progress-caption"><span>${count}/${people} paid</span><b>${Math.round(percent)}%</b></span><span class="progress"><i style="width:${percent}%"></i></span></span><span class="fund-amount">${money(fund.total)}</span><span class="status-pill ${done ? "settled" : ""}">${done ? "Settled" : "Open"}</span><span class="row-arrow">›</span></button>`; }).join(""); }
function renderOverview() { const open = openFunds(), openTotal = open.reduce((sum,fund) => sum + Number(fund.total),0), awaiting = open.reduce((sum,fund) => sum + fund.memberIds.length - paidCount(fund),0), done = state.funds.filter(settled).length; byId("stat-grid").innerHTML = [["Open to collect",money(openTotal),`${open.length} open fund${open.length === 1 ? "" : "s"}`,"open"],["Payments awaiting",awaiting,awaiting ? "Mark payments as they come in" : "Everyone is up to date",awaiting ? "open":"ok"],["Fully settled",done,`${state.funds.length} total split fund${state.funds.length === 1 ? "" : "s"}`,"ok"]].map(([label,value,caption,kind]) => `<article class="stat-card"><span>${label}</span><strong>${value}</strong><small class="${kind}">${caption}</small></article>`).join(""); byId("recent-funds").innerHTML = fundsHtml(sortFunds(state.funds).slice(0,4), "No split funds yet", "Add your first shared purchase to get started."); }
function renderFunds() { const all = state.funds, open = all.filter(fund => !settled(fund)), closed = all.filter(settled); byId("all-count").textContent = all.length; byId("open-count").textContent = open.length; byId("settled-count").textContent = closed.length; const query = byId("fund-search").value.trim().toLowerCase(); let funds = activeFilter === "open" ? open : activeFilter === "settled" ? closed : all; if (query) funds = funds.filter(fund => `${fund.title} ${fund.description || ""}`.toLowerCase().includes(query)); byId("funds-list").innerHTML = fundsHtml(sortFunds(funds), query ? "No matching funds" : "No funds in this view", query ? "Try another word or clear the search." : "Create a split fund to start tracking the house expenses."); document.querySelectorAll(".filter").forEach(button => button.classList.toggle("active", button.dataset.filter === activeFilter)); }
function legacy_renderMembers_1() { byId("member-total").textContent = `${state.members.length} house member${state.members.length === 1 ? "" : "s"}`; byId("members-list").innerHTML = state.members.map(member => `<article class="member-card"><span class="avatar">${initials(member.name)}</span><span><b>${escapeHtml(member.name)}</b><small>${memberFundCount(member.id)} split fund${memberFundCount(member.id) === 1 ? "" : "s"}</small></span><button type="button" data-delete-member="${member.id}" aria-label="Remove ${escapeHtml(member.name)}">×</button></article>`).join("") || `<div class="empty-state"><b>No members yet</b>Add your housemates before creating a fund.</div>`; }
const memberFundCount = id => state.funds.filter(fund => fund.memberIds.includes(id)).length;
function legacy_showRoute_1(route) { activeRoute = route; ["overview","funds","members"].forEach(name => byId(`${name}-view`).hidden = name !== route); if (window.location.hash.slice(1) !== route) window.location.hash = route; renderNavigation(); if(route === "funds") renderFunds(); }
function updateFundPreview() { const selected = document.querySelectorAll(".member-choice input:checked").length, total = Number(byId("fund-total").value) || 0; byId("per-person-preview").innerHTML = `${money(selected ? total / selected : 0)} <small>each</small>`; byId("select-all-members").checked = state.members.length > 0 && selected === state.members.length; const note = byId("selection-note"); note.textContent = selected ? `${selected} member${selected === 1 ? "" : "s"} selected · ${money(total / selected)} each` : "Select at least one person to continue."; note.classList.toggle("ready", Boolean(selected)); document.querySelectorAll(".member-choice").forEach(item => item.classList.toggle("selected", item.querySelector("input").checked)); }
function refreshFundMemberChoices(includeMemberId) { const selected = new Set([...document.querySelectorAll(".member-choice input:checked")].map(input => input.value)); if (includeMemberId) selected.add(includeMemberId); byId("fund-member-select").innerHTML = state.members.map(member => `<label class="member-choice"><input type="checkbox" value="${member.id}" ${selected.has(member.id) ? "checked" : ""}/><span class="custom-check"></span><span>${escapeHtml(member.name)}</span></label>`).join(""); byId("all-members-caption").textContent = `${state.members.length} people`; updateFundPreview(); }
function renderReceiptPreview() { const preview = byId("receipt-preview"); preview.hidden = !currentReceipt; if (currentReceipt) byId("receipt-image").src = currentReceipt; }
function legacy_openFundModal_1(fund = null) { editingFundId = fund?.id || null; currentReceipt = fund?.receipt || null; calculatorExpression = ""; byId("calculator-display").textContent = "0"; byId("receipt-input").value = ""; renderReceiptPreview(); byId("fund-modal-eyebrow").textContent = fund ? "EDIT SPLIT FUND" : "NEW SPLIT FUND"; byId("fund-modal-title").textContent = fund ? "Edit split fund" : "Add a split fund"; byId("save-fund-button").textContent = fund ? "Save changes" : "Create split fund"; byId("fund-title").value = fund?.title || ""; byId("fund-description").value = fund?.description || ""; byId("fund-date").value = fund?.date || new Date().toISOString().slice(0,10); byId("fund-total").value = fund?.total || ""; byId("fund-member-select").innerHTML = state.members.map(member => `<label class="member-choice"><input type="checkbox" value="${member.id}" ${fund?.memberIds.includes(member.id) ? "checked" : ""}/><span class="custom-check"></span><span>${escapeHtml(member.name)}</span></label>`).join(""); byId("all-members-caption").textContent = `${state.members.length} people`; byId("fund-modal").hidden = false; updateFundPreview(); byId("fund-title").focus(); }
function closeModals() { document.querySelectorAll(".modal-backdrop").forEach(modal => modal.hidden = true); activeFundId = null; }
function legacy_openMemberModal_1() { byId("member-modal").hidden = false; byId("member-name").value = ""; byId("member-name").focus(); }
function legacy_renderDetail_1() { const fund = state.funds.find(item => item.id === activeFundId); if (!fund) return closeModals(); const people = fundPeople(fund), count = paidCount(fund); byId("detail-date").textContent = `${dateLabel(fund.date)} · SPLIT FUND`; byId("detail-title").textContent = fund.title; byId("detail-description").textContent = fund.description || "No description added."; byId("detail-total").textContent = money(fund.total); byId("detail-share").textContent = `${money(share(fund))} each`; byId("detail-payment-status").textContent = settled(fund) ? "All paid" : `${count} of ${people.length} paid`; byId("detail-receipt").hidden = !fund.receipt; if (fund.receipt) byId("detail-receipt-image").src = fund.receipt; byId("payment-list").innerHTML = people.map(person => { const paid = Boolean(fund.payments?.[person.id]); return `<div class="payment-row"><span class="avatar">${initials(person.name)}</span><span><strong>${escapeHtml(person.name)}</strong><small>${money(share(fund))} share</small></span><button type="button" class="${paid ? "paid" : ""}" data-toggle-payment="${person.id}">${paid ? "✓ Paid" : "Mark paid"}</button></div>`; }).join(""); byId("detail-modal").hidden = false; }
function renderCalculator() { byId("calculator-display").textContent = calculatorExpression ? calculatorExpression.replace(/\*/g,"×").replace(/\//g,"÷") : "0"; }
function legacy_useCalculatorKey_1(key) { if (key === "clear") calculatorExpression = ""; else if (key === "back") calculatorExpression = calculatorExpression.slice(0, -1); else if (key === "equals") { if (!calculatorExpression || !/^[0-9+\-*/.\s]+$/.test(calculatorExpression)) return showToast("Use valid numbers and calculator operators."); try { const result = Function(`"use strict"; return (${calculatorExpression})`)(); if (!Number.isFinite(result)) throw new Error(); const rounded = Math.round(result * 100) / 100; calculatorExpression = String(rounded); byId("fund-total").value = rounded; updateFundPreview(); } catch { return showToast("That calculation cannot be solved."); } } else { const operators = "+-*/"; const last = calculatorExpression.slice(-1); if (operators.includes(key) && (!calculatorExpression || operators.includes(last))) { if (key === "-" && !calculatorExpression) calculatorExpression = "-"; else if (calculatorExpression) calculatorExpression = calculatorExpression.slice(0,-1) + key; } else if (key === ".") { const currentNumber = calculatorExpression.split(/[+\-*/]/).pop(); if (!currentNumber.includes(".")) calculatorExpression += key; } else calculatorExpression += key; renderCalculator(); } }
async function compressReceipt(file) { if (!file || !file.type.startsWith("image/")) throw new Error("Choose a PNG, JPEG, or WebP receipt image."); const source = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("The receipt could not be read.")); reader.readAsDataURL(file); }); const image = await new Promise((resolve,reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error("The receipt image could not be opened.")); element.src = source; }); const scale = Math.min(1, 1000 / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height); let encoded = canvas.toDataURL("image/jpeg", .76); if (encoded.length > 850000) { canvas.width = Math.round(canvas.width * .78); canvas.height = Math.round(canvas.height * .78); canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height); encoded = canvas.toDataURL("image/jpeg", .62); } if (encoded.length > 900000) throw new Error("That receipt is still too large. Please use a smaller image."); return encoded; }
document.addEventListener("click", async event => { const route = event.target.closest("[data-route]"); if (route) { event.preventDefault(); showRoute(route.dataset.route); return; } if (event.target.closest("[data-open-fund]") || event.target.closest("#mobile-add")) return openFundModal(); if (event.target.closest("[data-open-member]")) return openMemberModal(); if (event.target.closest("[data-close-modal]") || event.target.classList.contains("modal-backdrop")) return closeModals(); const filter = event.target.closest(".filter"); if(filter) { activeFilter = filter.dataset.filter; renderFunds(); return; } const row = event.target.closest("[data-fund-id]"); if(row) { activeFundId = row.dataset.fundId; renderDetail(); return; } const pay = event.target.closest("[data-toggle-payment]"); if(pay) { const fund = state.funds.find(item => item.id === activeFundId); try { state = await api(`/api/funds/${fund.id}/payments`, { method:"PATCH", body:JSON.stringify({ memberId: pay.dataset.togglePayment, paid: !fund.payments?.[pay.dataset.togglePayment] }) }); render(); } catch(error) { showToast(error.message); } return; } const remove = event.target.closest("[data-delete-member]"); if(remove) { const member = state.members.find(item => item.id === remove.dataset.deleteMember); if (!confirm(`Remove ${member.name}? They will stay on past split funds as a former member.`)) return; try { state = await api(`/api/members/${member.id}`,{method:"DELETE"}); render(); showToast("Member removed."); } catch(error) { showToast(error.message); } } });
byId("fund-search").addEventListener("input", renderFunds); byId("fund-total").addEventListener("input", updateFundPreview); byId("fund-member-select").addEventListener("change", updateFundPreview); byId("select-all-members").addEventListener("change", event => { document.querySelectorAll(".member-choice input").forEach(input => input.checked = event.target.checked); updateFundPreview(); });
byId("fund-form").addEventListener("submit", async event => { event.preventDefault(); const memberIds = [...document.querySelectorAll(".member-choice input:checked")].map(input => input.value); if (!memberIds.length) return showToast("Select at least one member."); const payload = { title:byId("fund-title").value.trim(), description:byId("fund-description").value.trim(), date:byId("fund-date").value, total:Number(byId("fund-total").value), memberIds, receipt:currentReceipt }; try { state = editingFundId ? await api(`/api/funds/${editingFundId}`, {method:"PATCH",body:JSON.stringify(payload)}) : await api("/api/funds", {method:"POST",body:JSON.stringify(payload)}); const message = editingFundId ? "Split fund updated." : "Split fund added for the group."; closeModals(); render(); showToast(message); } catch(error) { showToast(error.message); } });
byId("member-form").addEventListener("submit", async event => { event.preventDefault(); const name = byId("member-name").value.trim(); try { state = await api("/api/members", {method:"POST",body:JSON.stringify({name})}); const newMember = state.members.at(-1); byId("member-modal").hidden = true; render(); if (!byId("fund-modal").hidden) refreshFundMemberChoices(newMember?.id); showToast(`${name} was added.`); } catch(error) { showToast(error.message); } });
byId("edit-fund").addEventListener("click", () => { const fund = state.funds.find(item => item.id === activeFundId); byId("detail-modal").hidden = true; openFundModal(fund); });
byId("delete-fund").addEventListener("click", async () => { const fund = state.funds.find(item => item.id === activeFundId); if (!confirm(`Delete “${fund.title}”? This cannot be undone.`)) return; try { state = await api(`/api/funds/${fund.id}`, {method:"DELETE"}); closeModals(); render(); showToast("Split fund deleted."); } catch(error) { showToast(error.message); } });
window.addEventListener("hashchange", () => { const route = location.hash.slice(1); if (["overview","funds","members"].includes(route) && route !== activeRoute) showRoute(route); });
const initialRoute = location.hash.slice(1); if (["overview","funds","members","more"].includes(initialRoute)) activeRoute = initialRoute; showRoute(activeRoute); loadState(); setInterval(() => loadState(true), 60000);

// A profile is a lightweight, device-local selection—not a password account.
const PROFILE_STORAGE_KEY = "splitwise-house-profile-id";
let currentMemberId = localStorage.getItem(PROFILE_STORAGE_KEY) || "";
const currentProfile = () => state.members.find(member => member.id === currentMemberId) || null;
const memberFunds = memberId => state.funds.filter(fund => fund.memberIds.includes(memberId));
const memberUnpaidFunds = memberId => memberFunds(memberId).filter(fund => !fund.payments?.[memberId]);
const memberOwed = memberId => memberUnpaidFunds(memberId).reduce((total, fund) => total + share(fund), 0);

function renderNavigation() {
  byId("open-nav-count").textContent = openFunds().length;
  document.querySelectorAll(".nav-link, .tab-link").forEach(link => link.classList.toggle("active", link.dataset.route === activeRoute));
}

function legacy_renderProfileChrome_1() {
  const profile = currentProfile();
  byId("profile-avatar").textContent = profile ? initials(profile.name) : "?";
  byId("profile-switcher-name").textContent = profile ? profile.name : "Choose a member";
  byId("overview-greeting").textContent = profile ? `Good morning, ${profile.name}` : "Welcome to RM331";
}

function profileFundHtml(fund) {
  return `<article class="personal-fund"><span class="personal-fund-icon">${fund.icon || "◈"}</span><span><b>${escapeHtml(fund.title)}</b><small>${dateLabel(fund.date)} · ${money(share(fund))} your share</small></span><strong>${money(share(fund))}</strong></article>`;
}

function legacy_renderMore_1() {
  const profile = currentProfile();
  const unpaid = profile ? memberUnpaidFunds(profile.id) : [];
  const owed = profile ? memberOwed(profile.id) : 0;
  byId("tracker-title").textContent = profile ? `${profile.name}'s tracker` : "My payments";
  byId("tracker-subheading").textContent = profile ? "Your share of every shared expense, in one place." : "Choose a member profile to see a personal tracker.";
  byId("profile-summary").innerHTML = profile
    ? `<span class="avatar">${initials(profile.name)}</span><span><b>${escapeHtml(profile.name)}</b><small>${unpaid.length ? `${unpaid.length} unpaid split${unpaid.length === 1 ? "" : "s"} · ${money(owed)} to pay` : "You are all caught up"}</small></span><button type="button" data-open-profile>Switch</button>`
    : `<span class="avatar">?</span><span><b>No member selected</b><small>Select who is using this device to see their tracker.</small></span><button type="button" data-open-profile>Choose</button>`;
  byId("unpaid-count").textContent = unpaid.length;
  byId("personal-unpaid-list").innerHTML = unpaid.length ? unpaid.map(profileFundHtml).join("") : `<div class="empty-state"><b>${profile ? "All caught up" : "Choose a member"}</b>${profile ? "There are no unpaid split funds for this profile." : "Select a profile to see personal payment reminders."}</div>`;
  byId("member-status-list").innerHTML = state.members.map(member => {
    const awaiting = memberUnpaidFunds(member.id), owedAmount = memberOwed(member.id);
    const label = awaiting.length ? `${awaiting.length} unpaid · ${money(owedAmount)} to pay` : "All paid up";
    return `<article class="member-status-card"><span class="avatar">${initials(member.name)}</span><span><b>${escapeHtml(member.name)}${profile?.id === member.id ? " (you)" : ""}</b><small class="${awaiting.length ? "owing" : ""}">${label}</small></span></article>`;
  }).join("") || `<div class="empty-state"><b>No members yet</b>Add housemates to start tracking payments.</div>`;
}

function render() {
  if (currentMemberId && !currentProfile()) {
    currentMemberId = "";
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  }
  renderNavigation();
  renderProfileChrome();
  renderOverview();
  renderFunds();
  renderMembers();
  renderMore();
  if (activeFundId) renderDetail();
  if (state.members.length && !currentProfile()) openProfilePicker();
}

function showRoute(route) {
  activeRoute = route;
  ["overview", "funds", "members", "more"].forEach(name => byId(`${name}-view`).hidden = name !== route);
  if (window.location.hash.slice(1) !== route) window.location.hash = route;
  renderNavigation();
  if (route === "funds") renderFunds();
  if (route === "more") renderMore();
}

function legacy_openProfilePicker_1() {
  byId("profile-picker-list").innerHTML = state.members.map(member => `<button class="profile-choice" type="button" data-select-profile="${member.id}"><span class="avatar">${initials(member.name)}</span><b>${escapeHtml(member.name)}</b><small>${memberUnpaidFunds(member.id).length ? `${memberUnpaidFunds(member.id).length} payment${memberUnpaidFunds(member.id).length === 1 ? "" : "s"} waiting` : "All caught up"}</small></button>`).join("");
  byId("profile-modal").hidden = false;
}

document.addEventListener("click", event => {
  const profileButton = event.target.closest("[data-select-profile]");
  if (profileButton) {
    currentMemberId = profileButton.dataset.selectProfile;
    localStorage.setItem(PROFILE_STORAGE_KEY, currentMemberId);
    byId("profile-modal").hidden = true;
    render();
    showToast(`Tracking payments for ${currentProfile().name}.`);
    return;
  }
  if (event.target.closest("[data-open-profile]")) openProfilePicker();
});

function legacy_useCalculatorKey_2(key) {
  const operators = "+-*/";
  if (key === "clear") calculatorExpression = "";
  else if (key === "back") calculatorExpression = calculatorExpression.slice(0, -1);
  else if (key === "equals") {
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
    } else calculatorExpression += key;
  }
  renderCalculator();
}

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

function openFundModal(fund = null) {
  installDescriptionEditor();
  editingFundId = fund?.id || null; currentReceipt = fund?.receipt || null; calculatorExpression = "";
  byId("calculator-display").textContent = "0"; byId("receipt-input").value = ""; renderReceiptPreview();
  byId("fund-modal-eyebrow").textContent = fund ? "EDIT SPLIT FUND" : "NEW SPLIT FUND";
  byId("fund-modal-title").textContent = fund ? "Edit split fund" : "Add a split fund";
  byId("save-fund-button").textContent = fund ? "Save changes" : "Create split fund";
  byId("fund-title").value = fund?.title || ""; byId("fund-description").innerHTML = sanitizeDescriptionHtml(fund?.description || "");
  byId("fund-date").value = fund?.date || new Date().toISOString().slice(0,10); byId("fund-total").value = fund?.total || "";
  const defaultPayerId = currentProfile()?.id || ADMIN_MEMBER_ID;
  byId("fund-member-select").innerHTML = state.members.map(member => `<label class="member-choice"><input type="checkbox" value="${member.id}" ${(fund ? fund.memberIds.includes(member.id) : defaultPayerId === member.id) ? "checked" : ""}/><span class="custom-check"></span><span>${escapeHtml(member.name)}</span></label>`).join("");
  byId("all-members-caption").textContent = `${state.members.length} people`; byId("fund-modal").hidden = false; updateFundPreview(); byId("fund-title").focus();
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

byId("fund-form").addEventListener("submit", async event => {
  event.preventDefault(); event.stopImmediatePropagation();
  const memberIds = [...document.querySelectorAll(".member-choice input:checked")].map(input => input.value);
  if (!memberIds.length) return showToast("Select at least one member.");
  const payload = { title:byId("fund-title").value.trim(), description:sanitizeDescriptionHtml(byId("fund-description").innerHTML), date:byId("fund-date").value, total:Number(byId("fund-total").value), memberIds, receipt:currentReceipt };
  try { state = editingFundId ? await api(`/api/funds/${editingFundId}`, {method:"PATCH",body:JSON.stringify(payload)}) : await api("/api/funds", {method:"POST",body:JSON.stringify(payload)}); const message = editingFundId ? "Split fund updated." : "Split fund added for the group."; closeModals(); render(); showToast(message); } catch(error) { showToast(error.message); }
}, true);

function renderDetail() {
  const fund = state.funds.find(item => item.id === activeFundId); if (!fund) return closeModals();
  const people = fundPeople(fund), count = paidCount(fund); byId("detail-date").textContent = `${dateLabel(fund.date)} · SPLIT FUND`; byId("detail-title").textContent = fund.title;
  byId("detail-description").innerHTML = sanitizeDescriptionHtml(fund.description) || "No description added.";
  byId("detail-total").textContent = money(fund.total); byId("detail-share").textContent = `${money(share(fund))} each`; byId("detail-payment-status").textContent = settled(fund) ? "All paid" : `${count} of ${people.length} paid`;
  byId("detail-receipt").hidden = !fund.receipt; if (fund.receipt) byId("detail-receipt-image").src = fund.receipt;
  byId("payment-list").innerHTML = people.map(person => { const paid = Boolean(fund.payments?.[person.id]); return `<div class="payment-row"><span class="avatar">${initials(person.name)}</span><span><strong>${escapeHtml(person.name)}</strong><small>${money(share(fund))} share</small></span><button type="button" class="${paid ? "paid" : ""}" data-toggle-payment="${person.id}">${paid ? "✓ Paid" : "Mark paid"}</button></div>`; }).join(""); byId("detail-modal").hidden = false;
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

const MEMBER_PHOTO_STORAGE_KEY = "rm331-member-photos";
let memberPhotos = (() => { try { return JSON.parse(localStorage.getItem(MEMBER_PHOTO_STORAGE_KEY) || "{}"); } catch { return {}; } })();
let photoMemberId = "";
const memberPhoto = member => memberPhotos[member.id] || "";
const memberAvatarContent = member => memberPhoto(member) ? `<img src="${escapeHtml(memberPhoto(member))}" alt="" />` : initials(member.name);

function legacy_renderProfileChrome_2() {
  const profile = currentProfile();
  byId("profile-avatar").innerHTML = profile ? memberAvatarContent(profile) : "?";
  byId("profile-switcher-name").textContent = profile ? profile.name : "Choose a member";
  byId("overview-greeting").textContent = profile ? `Good morning, ${profile.name}` : "Welcome to RM331";
}

function legacy_renderMembers_2() {
  byId("member-total").textContent = `${state.members.length} house member${state.members.length === 1 ? "" : "s"}`;
  byId("members-list").innerHTML = state.members.map(member => `<article class="member-card"><span class="avatar">${memberAvatarContent(member)}</span><span><b>${escapeHtml(member.name)}</b><small>${memberFundCount(member.id)} split fund${memberFundCount(member.id) === 1 ? "" : "s"}</small></span><span class="member-card-actions"><button class="photo-button" type="button" data-select-member-photo="${member.id}">Photo</button><button type="button" data-delete-member="${member.id}" aria-label="Remove ${escapeHtml(member.name)}">×</button></span></article>`).join("") || `<div class="empty-state"><b>No members yet</b>Add your housemates before creating a fund.</div>`;
}

function legacy_openProfilePicker_2() {
  byId("profile-picker-list").innerHTML = state.members.map(member => `<button class="profile-choice" type="button" data-select-profile="${member.id}"><span class="avatar">${memberAvatarContent(member)}</span><b>${escapeHtml(member.name)}</b><small>${memberUnpaidFunds(member.id).length ? `${memberUnpaidFunds(member.id).length} payment${memberUnpaidFunds(member.id).length === 1 ? "" : "s"} waiting` : "All caught up"}</small></button>`).join("");
  byId("profile-modal").hidden = false;
}

async function compressMemberPhoto(file, size = 120) {
  if (!file || !file.type.startsWith("image/")) throw new Error("Choose a PNG, JPEG, or WebP photo.");
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

byId("member-photo-input").addEventListener("change", async event => {
  try {
    const photo = await compressMemberPhoto(event.target.files?.[0]);
    if (!photoMemberId) return;
    memberPhotos[photoMemberId] = photo;
    localStorage.setItem(MEMBER_PHOTO_STORAGE_KEY, JSON.stringify(memberPhotos));
    event.target.value = "";
    photoMemberId = "";
    render();
    showToast("Profile photo updated.");
  } catch (error) {
    event.target.value = "";
    showToast(error.message);
  }
});

let editingMemberId = null;
const ADMIN_MEMBER_ID = "member-1";
const isAdmin = () => currentProfile()?.id === ADMIN_MEMBER_ID;
const canManageMember = member => isAdmin() || currentProfile()?.id === member.id;

function ensureMemberContactField() {
  if (byId("member-contact")) return;
  byId("member-name").closest("label").insertAdjacentHTML("afterend", `<label><span>Nickname <em>optional</em></span><input id="member-nickname" maxlength="30" placeholder="How you want to be known" /></label><label><span>Profile label <em>optional</em></span><input id="member-label" maxlength="40" placeholder="e.g. Rent coordinator" /></label><label><span>Contact <em>optional</em></span><input id="member-contact" maxlength="80" placeholder="Phone, email, or contact note" autocomplete="email" /></label>`);
}

function openMemberModal(member = null) {
  ensureMemberContactField();
  if (!member) return showToast("This group uses five fixed member profiles.");
  if (member && !canManageMember(member)) return showToast("You can only edit your own account.");
  editingMemberId = member?.id || null;
  byId("member-modal").hidden = false;
  byId("member-modal").querySelector(".eyebrow").textContent = member ? "EDIT MEMBER" : "NEW MEMBER";
  byId("member-modal").querySelector("h2").textContent = member ? `Edit ${member.name}` : "Add someone to Group Funds Calculator";
  byId("member-name").value = member?.name || "";
  byId("member-nickname").value = member?.nickname || "";
  byId("member-label").value = member?.label || "";
  byId("member-contact").value = member?.contact || "";
  byId("member-form").querySelector("button[type=submit]").textContent = member ? "Save member" : "Add member";
  byId("member-name").focus();
}

function legacy_renderMembers_3() {
  byId("member-total").textContent = `${state.members.length} house member${state.members.length === 1 ? "" : "s"}`;
  byId("members-list").innerHTML = state.members.map((member, index) => {
    const unpaid = memberUnpaidFunds(member.id), status = unpaid.length ? `${unpaid.length} unpaid split${unpaid.length === 1 ? "" : "s"}` : "All paid up";
    return `<article class="member-id-card"><div class="member-id-band"><span>RM331</span><span>MEMBER ID ${String(index + 1).padStart(2, "0")}</span></div><div class="member-id-main"><span class="avatar">${memberAvatarContent(member)}</span><span class="member-id-copy"><small>HOUSE MEMBER</small><b>${escapeHtml(member.name)}</b><span>${escapeHtml(member.contact || "No contact added")}</span></span></div><div class="member-id-footer"><span>${memberFundCount(member.id)} shared fund${memberFundCount(member.id) === 1 ? "" : "s"}</span><b class="${unpaid.length ? "owing" : ""}">${status}</b></div><div class="member-id-actions"><button class="photo-button" type="button" data-select-member-photo="${member.id}">Photo</button><button class="edit-member-button" type="button" data-edit-member="${member.id}">Edit</button><button class="remove-member-button" type="button" data-delete-member="${member.id}" aria-label="Remove ${escapeHtml(member.name)}">Remove</button></div></article>`;
  }).join("") || `<div class="empty-state"><b>No members yet</b>Add your housemates before creating a fund.</div>`;
}

document.addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit-member]");
  if (!editButton) return;
  const member = state.members.find(item => item.id === editButton.dataset.editMember);
  if (member) openMemberModal(member);
});

byId("member-form").addEventListener("submit", async event => {
  event.preventDefault();
  event.stopImmediatePropagation();
  const name = byId("member-name").value.trim(), nickname = byId("member-nickname").value.trim(), label = byId("member-label").value.trim(), contact = byId("member-contact").value.trim();
  const existing = editingMemberId ? state.members.find(member => member.id === editingMemberId) : null;
  if (!editingMemberId) return showToast("This group uses five fixed member profiles.");
  if (existing && !canManageMember(existing)) return showToast("You can only manage your own account.");
  try {
    state = editingMemberId
      ? await api(`/api/members/${editingMemberId}`, { method:"PATCH", body:JSON.stringify({ name, nickname, label, contact, avatar:existing.avatar || "", paymentMethods:existing.paymentMethods || [] }) })
      : await api("/api/members", { method:"POST", body:JSON.stringify({ name, nickname, label, contact, avatar:"", paymentMethods:[] }) });
    const newMember = editingMemberId ? null : state.members.at(-1);
    editingMemberId = null;
    byId("member-modal").hidden = true;
    render();
    if (!byId("fund-modal").hidden) refreshFundMemberChoices(newMember?.id);
    showToast(newMember ? `${name} was added.` : "Member details updated.");
  } catch (error) { showToast(error.message); }
}, true);

function paymentMethods(member) { return Array.isArray(member.paymentMethods) ? member.paymentMethods : []; }
function paymentMethodHtml(method, editable) { return `<article class="payment-method-card"><img src="${escapeHtml(method.image)}" alt="${escapeHtml(method.label)} QR code" loading="lazy" decoding="async" /><span><b>${escapeHtml(method.label)}</b><small>Scan to pay</small></span>${editable ? `<button type="button" data-remove-payment-method="${escapeHtml(method.id)}">Remove</button>` : ""}</article>`; }

function ensurePaymentDialog() {
  if (byId("payment-profile-modal")) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="payment-profile-modal" hidden><section class="modal payment-profile-modal-card"><div class="modal-header"><div><h2 id="payment-profile-name">Payment profile</h2><p class="detail-description" id="payment-profile-copy"></p></div><button class="close-button" type="button" data-close-modal aria-label="Close">×</button></div><div class="payment-method-list" id="payment-method-list"></div><div id="payment-method-form-wrap" hidden><form id="payment-method-form"><label><span>Bank or wallet</span><input id="payment-method-label" maxlength="30" required placeholder="e.g. GCash · Chan" /></label><label class="qr-upload-label"><span>QR code image</span><input id="payment-method-image" type="file" accept="image/png,image/jpeg,image/webp" required /></label><div class="modal-actions"><button type="button" class="cancel-button" data-close-modal>Cancel</button><button type="submit" class="primary-button">Save QR code</button></div></form></div><div class="detail-actions"><span></span><button type="button" class="secondary-button" id="add-payment-method" hidden>＋ Add QR code</button></div></section></div>`);
  byId("payment-method-form").addEventListener("submit", async event => {
    event.preventDefault();
    const member = state.members.find(item => item.id === byId("payment-profile-modal").dataset.memberId);
    if (!member || !canManageMember(member)) return showToast("You can only update your own payment profile.");
    try {
      const image = await compressMemberPhoto(byId("payment-method-image").files?.[0], 180);
      const methods = [...paymentMethods(member), { id:crypto.randomUUID(), label:byId("payment-method-label").value.trim(), image }];
      state = await api(`/api/members/${member.id}`, { method:"PATCH", body:JSON.stringify({ ...accountPayload(member), paymentMethods:methods }) });
      render(); openPaymentProfile(state.members.find(item => item.id === member.id)); showToast("QR code added.");
    } catch (error) { showToast(error.message); }
  });
}

function openPaymentProfile(member) {
  ensurePaymentDialog();
  const editable = canManageMember(member), open = memberUnpaidFunds(member.id), name = member.nickname || member.name;
  byId("payment-profile-modal").dataset.memberId = member.id;
  byId("payment-profile-name").textContent = `${name}'s payment profile`;
  byId("payment-profile-copy").textContent = paymentMethods(member).length ? `Use a listed QR code to pay ${name}. ${open.length ? `${open.length} shared expense${open.length === 1 ? " is" : "s are"} still open.` : "No unpaid shared expenses."}` : `${name} has not added a payment QR code yet.`;
  byId("payment-method-list").innerHTML = paymentMethods(member).map(method => paymentMethodHtml(method, editable)).join("") || `<div class="empty-state"><b>No QR codes yet</b>${editable ? "Add a bank or wallet code so other members can pay you quickly." : "Ask this member to add a payment method."}</div>`;
  byId("payment-method-form-wrap").hidden = true;
  byId("add-payment-method").hidden = !editable || paymentMethods(member).length >= 3;
  byId("payment-profile-modal").hidden = false;
}

function renderMore() {
  const profile = currentProfile(), unpaid = profile ? memberUnpaidFunds(profile.id) : [], owed = profile ? memberOwed(profile.id) : 0;
  byId("tracker-title").textContent = profile ? `${profile.nickname || profile.name}'s tracker` : "My payments";
  byId("tracker-subheading").textContent = profile ? "Your payment status and public payment details, in one place." : "Choose a member profile to see a personal tracker.";
  byId("profile-summary").innerHTML = profile ? `<span class="avatar">${accountAvatarContent(profile)}</span><span><b>${escapeHtml(profile.nickname || profile.name)}</b><small>${unpaid.length ? `${unpaid.length} unpaid split${unpaid.length === 1 ? "" : "s"} · ${money(owed)} to pay` : "You are all caught up"}</small></span><span class="profile-summary-actions"><button type="button" data-view-payment-profile="${profile.id}">Payment profile</button><button type="button" data-open-profile>Switch</button></span>` : `<span class="avatar">?</span><span><b>No member selected</b><small>Select who is using this device to see their tracker.</small></span><button type="button" data-open-profile>Choose</button>`;
  byId("unpaid-count").textContent = unpaid.length;
  byId("personal-unpaid-list").innerHTML = unpaid.length ? unpaid.map(profileFundHtml).join("") : `<div class="empty-state"><b>${profile ? "All caught up" : "Choose a member"}</b>${profile ? "There are no unpaid split funds for this profile." : "Select a profile to see personal payment reminders."}</div>`;
  byId("member-status-list").innerHTML = state.members.map(member => { const awaiting = memberUnpaidFunds(member.id), owedAmount = memberOwed(member.id); return `<article class="member-status-card"><span class="avatar">${accountAvatarContent(member)}</span><span><b>${escapeHtml(member.nickname || member.name)}${profile?.id === member.id ? " (you)" : ""}</b><small class="${awaiting.length ? "owing" : ""}">${awaiting.length ? `${awaiting.length} unpaid · ${money(owedAmount)} to pay` : "All paid up"}</small></span></article>`; }).join("") || `<div class="empty-state"><b>No members yet</b>Add housemates to start tracking payments.</div>`;
}

document.addEventListener("click", async event => {
  const viewButton = event.target.closest("[data-view-payment-profile]");
  if (viewButton) { const member = state.members.find(item => item.id === viewButton.dataset.viewPaymentProfile); if (member) openPaymentProfile(member); return; }
  if (event.target.closest("#add-payment-method")) { byId("payment-method-form-wrap").hidden = false; byId("payment-method-label").focus(); return; }
  const removeButton = event.target.closest("[data-remove-payment-method]");
  if (removeButton) {
    const member = state.members.find(item => item.id === byId("payment-profile-modal").dataset.memberId);
    if (!member || !canManageMember(member)) return showToast("You can only update your own payment profile.");
    try { state = await api(`/api/members/${member.id}`, { method:"PATCH", body:JSON.stringify({ ...accountPayload(member), paymentMethods:paymentMethods(member).filter(method => method.id !== removeButton.dataset.removePaymentMethod) }) }); render(); openPaymentProfile(state.members.find(item => item.id === member.id)); } catch (error) { showToast(error.message); }
  }
});

function fundsHtml(funds, emptyTitle, emptyCopy) {
  if (!funds.length) return `<div class="empty-state"><b>${emptyTitle}</b>${emptyCopy}<br><button class="primary-button" type="button" data-open-fund>＋ Add split fund</button></div>`;
  return funds.map(fund => {
    const count = paidCount(fund), people = fund.memberIds.length, done = settled(fund), remaining = Math.max(0, people - count);
    const summary = done ? "Settled" : `${remaining} ${remaining === 1 ? "person" : "people"} still to pay`;
    return `<button class="fund-row" data-fund-id="${fund.id}" type="button"><span class="fund-icon">${fund.icon || "◈"}</span><span class="fund-copy"><strong>${escapeHtml(fund.title)}</strong><small>${summary} · ${count}/${people} paid</small></span><span class="fund-meta"><b>${dateLabel(fund.date)}</b>${people} member${people === 1 ? "" : "s"}</span><span class="payment-progress"><span class="progress-caption"><span>${count}/${people} paid</span><b>${Math.round(people ? count / people * 100 : 0)}%</b></span><span class="progress"><i style="width:${people ? count / people * 100 : 0}%"></i></span></span><span class="fund-amount">${money(fund.total)}</span><span class="status-pill ${done ? "settled" : ""}">${done ? "Settled" : "Open"}</span><span class="row-arrow">›</span></button>`;
  }).join("");
}

const accountAvatarContent = member => member.avatar ? `<img src="${escapeHtml(member.avatar)}" alt="" loading="lazy" decoding="async" />` : memberAvatarContent(member);
const accountPayload = member => ({ name:member.name, nickname:member.nickname || "", label:member.label || "", contact:member.contact || "", avatar:member.avatar || "", paymentMethods:member.paymentMethods || [] });

function renderProfileChrome() {
  const profile = currentProfile();
  byId("profile-avatar").innerHTML = profile ? accountAvatarContent(profile) : "?";
  byId("profile-switcher-name").textContent = profile ? (profile.nickname || profile.name) : "Choose a member";
  byId("overview-greeting").textContent = profile ? `Good morning, ${profile.nickname || profile.name}` : "Welcome to Group Funds Calculator";
}

function renderMembers() {
  byId("member-total").textContent = `${state.members.length} member account${state.members.length === 1 ? "" : "s"}`;
  const addButton = document.querySelector("[data-open-member]"); if (addButton) addButton.hidden = true;
  byId("members-list").innerHTML = state.members.map((member, index) => {
    const unpaid = memberUnpaidFunds(member.id), status = unpaid.length ? `${unpaid.length} unpaid split${unpaid.length === 1 ? "" : "s"}` : "All paid up", canManage = canManageMember(member);
    const avatar = canManage ? `<button class="avatar avatar-photo" type="button" data-select-member-photo="${member.id}" aria-label="Change ${escapeHtml(member.name)} profile photo">${accountAvatarContent(member)}<i>＋</i></button>` : `<span class="avatar">${accountAvatarContent(member)}</span>`;
    const actions = `<button class="view-payment-button" type="button" data-view-payment-profile="${member.id}">Payment profile</button>${canManage ? `<button class="edit-member-button" type="button" data-edit-member="${member.id}">Edit</button>` : ""}`;
    return `<article class="member-id-card"><div class="member-id-band"><span>GROUP FUNDS</span><span>MEMBER ID ${String(index + 1).padStart(2, "0")}</span></div><div class="member-id-main">${avatar}<span class="member-id-copy"><small>${escapeHtml(member.label || "HOUSE MEMBER")}</small><b>${escapeHtml(member.nickname || member.name)}</b><span>${escapeHtml(member.contact || "No contact added")}</span></span></div><div class="member-id-footer"><span>${memberFundCount(member.id)} shared fund${memberFundCount(member.id) === 1 ? "" : "s"}</span><b class="${unpaid.length ? "owing" : ""}">${status}</b></div><div class="member-id-actions">${actions}</div></article>`;
  }).join("") || `<div class="empty-state"><b>No accounts available</b>This group is limited to its five member profiles.</div>`;
}

function openProfilePicker() {
  byId("profile-picker-list").innerHTML = state.members.map(member => `<button class="profile-choice" type="button" data-select-profile="${member.id}"><span class="avatar">${accountAvatarContent(member)}</span><b>${escapeHtml(member.nickname || member.name)}</b><small>${escapeHtml(member.label || (memberUnpaidFunds(member.id).length ? `${memberUnpaidFunds(member.id).length} payment${memberUnpaidFunds(member.id).length === 1 ? "" : "s"} waiting` : "All caught up"))}</small></button>`).join("");
  byId("profile-modal").hidden = false;
}

document.addEventListener("click", event => {
  const removeButton = event.target.closest("[data-delete-member]");
  if (removeButton) { event.preventDefault(); event.stopImmediatePropagation(); showToast("The five member profiles are fixed."); }
}, true);

byId("member-photo-input").addEventListener("change", async event => {
  if (!photoMemberId) return;
  event.stopImmediatePropagation();
  const member = state.members.find(item => item.id === photoMemberId);
  if (!member || !canManageMember(member)) { event.target.value = ""; return showToast("You can only change your own profile photo."); }
  try {
    const avatar = await compressMemberPhoto(event.target.files?.[0]);
    state = await api(`/api/members/${member.id}`, { method:"PATCH", body:JSON.stringify({ ...accountPayload(member), avatar }) });
    event.target.value = ""; photoMemberId = ""; render(); showToast("Profile photo updated.");
  } catch (error) { event.target.value = ""; showToast(error.message); }
}, true);