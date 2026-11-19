/* =====================================================
   Health Insurance Claim Tracker
   Plain JavaScript only. Data is saved in localStorage.
   ===================================================== */

// ---------- Constants ----------
var STORAGE_KEY = "claimTrackerData";

var STATUSES = ["Draft", "Submitted", "Under Review", "Query Raised", "Approved", "Settled", "Rejected"];

var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

var DOCS_REIMBURSEMENT = [
  "Claim form (signed)",
  "Policy copy / e-card",
  "ID proof",
  "Discharge summary",
  "Hospital bills (original)",
  "Payment receipts",
  "Doctor's prescriptions",
  "Diagnostic reports",
  "Cancelled cheque / bank details"
];

var DOCS_CASHLESS = [
  "Pre-authorisation form",
  "Policy copy / e-card",
  "ID proof",
  "Doctor's admission note",
  "Diagnostic reports",
  "Final hospital bill"
];

// Small icons used inside generated HTML
var ICON = {
  check: '<svg viewBox="0 0 24 24" class="ico"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24" class="ico"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" class="ico"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/></svg>',
  close: '<svg viewBox="0 0 24 24" class="ico"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" class="ico"><path d="M12 5v14M5 12h14"/></svg>'
};

// ---------- App data ----------
var data = loadData();
var currentClaimId = null; // claim currently open in the detail page

function loadData() {
  var saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    saved = null;
  }
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      // saved data is broken, start fresh
    }
  }
  return { policies: [], claims: [], nextPolicyNo: 1, nextClaimNo: 1 };
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    toast("Could not save. Your browser may be blocking storage.", "error");
  }
}

// ---------- Small helper functions ----------
function el(id) {
  return document.getElementById(id);
}

// Stops user-typed text from being treated as HTML
function esc(text) {
  var div = document.createElement("div");
  div.textContent = text === undefined || text === null ? "" : text;
  return div.innerHTML;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dateToStr(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function todayStr() {
  return dateToStr(new Date());
}

// Date that is n days from today (negative = in the past)
function offsetDate(n) {
  var d = new Date();
  d.setDate(d.getDate() + n);
  return dateToStr(d);
}

function formatDate(str) {
  if (!str) return "-";
  var p = str.split("-");
  return Number(p[2]) + " " + MONTHS[Number(p[1]) - 1] + " " + p[0];
}

function formatMoney(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

// Short form for tight spaces: ₹85K, ₹1.2L, ₹2.5Cr
function formatCompact(n) {
  n = Number(n || 0);
  function trim(x) {
    return String(Math.round(x * 10) / 10).replace(/\.0$/, "");
  }
  if (n >= 10000000) return "₹" + trim(n / 10000000) + "Cr";
  if (n >= 100000) return "₹" + trim(n / 100000) + "L";
  if (n >= 1000) return "₹" + trim(n / 1000) + "K";
  return "₹" + n;
}

// Days from today until a date (negative = past)
function daysUntil(dateStr) {
  var today = new Date(todayStr());
  var target = new Date(dateStr);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function dueText(days) {
  if (days < 0) return Math.abs(days) + (days === -1 ? " day overdue" : " days overdue");
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return "Due in " + days + " days";
}

function dueClass(days) {
  if (days < 0) return "late";
  if (days <= 3) return "soon";
  return "";
}

function statusClass(status) {
  return "st-" + status.replace(/ /g, "-");
}

function chip(status) {
  return '<span class="chip ' + statusClass(status) + '">' + esc(status) + "</span>";
}

function findPolicy(id) {
  for (var i = 0; i < data.policies.length; i++) {
    if (data.policies[i].id === id) return data.policies[i];
  }
  return null;
}

function findClaim(id) {
  for (var i = 0; i < data.claims.length; i++) {
    if (data.claims[i].id === id) return data.claims[i];
  }
  return null;
}

function policyLabel(id) {
  var p = findPolicy(id);
  return p ? p.insurer + " (" + p.number + ")" : "Deleted policy";
}

function countDone(claim) {
  return claim.documents.filter(function (d) {
    return d.done;
  }).length;
}

// Gives each insurer its own colour, based on its name
function hueFor(text) {
  var h = 0;
  for (var i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) % 360;
  }
  return h;
}

// Small pop-up message
function toast(message, type) {
  var box = document.createElement("div");
  box.className = "toast" + (type === "error" ? " error" : "");
  box.textContent = message;
  el("toasts").appendChild(box);
  setTimeout(function () {
    box.remove();
  }, 3200);
}

// ---------- Page navigation ----------
function showPage(name) {
  var pages = ["dashboard", "policies", "claims", "detail"];
  for (var i = 0; i < pages.length; i++) {
    el("page-" + pages[i]).classList.add("hidden");
  }
  el("page-" + name).classList.remove("hidden");

  var navs = ["dashboard", "policies", "claims"];
  for (var j = 0; j < navs.length; j++) {
    el("nav-" + navs[j]).classList.remove("active");
  }
  // the detail page belongs under "Claims" in the menu
  var activeNav = name === "detail" ? "claims" : name;
  el("nav-" + activeNav).classList.add("active");

  renderAll();
  window.scrollTo(0, 0);
}

function renderAll() {
  renderDashboard();
  renderPolicies();
  renderFilterOptions();
  renderClaims();
  if (!el("page-detail").classList.contains("hidden")) {
    renderDetail();
  }
}

/* =====================================================
   POLICIES
   ===================================================== */
function openPolicyDialog(editId) {
  el("policyForm").reset();
  el("policyId").value = "";
  el("policyFormTitle").textContent = "Add policy";
  el("policySubmitBtn").textContent = "Save policy";

  if (editId) {
    var p = findPolicy(editId);
    el("policyId").value = p.id;
    el("pInsurer").value = p.insurer;
    el("pNumber").value = p.number;
    el("pHolder").value = p.holder;
    el("pType").value = p.type;
    el("pSum").value = p.sum;
    el("pStart").value = p.start;
    el("pEnd").value = p.end;
    el("policyFormTitle").textContent = "Edit policy";
    el("policySubmitBtn").textContent = "Update policy";
  }
  el("policyDialog").showModal();
}

el("policyForm").addEventListener("submit", function (e) {
  e.preventDefault();

  var start = el("pStart").value;
  var end = el("pEnd").value;
  if (end <= start) {
    toast("The end date must be after the start date.", "error");
    return;
  }

  var editId = el("policyId").value;
  var policy;

  if (editId) {
    policy = findPolicy(editId);
  } else {
    policy = { id: "P" + data.nextPolicyNo };
    data.nextPolicyNo++;
    data.policies.push(policy);
  }

  policy.insurer = el("pInsurer").value.trim();
  policy.number = el("pNumber").value.trim();
  policy.holder = el("pHolder").value.trim();
  policy.type = el("pType").value;
  policy.sum = Number(el("pSum").value);
  policy.start = start;
  policy.end = end;

  saveData();
  el("policyDialog").close();
  toast(editId ? "Policy updated" : "Policy added");
  renderAll();
});

function deletePolicy(id) {
  for (var i = 0; i < data.claims.length; i++) {
    if (data.claims[i].policyId === id) {
      toast("This policy has claims. Delete those claims first.", "error");
      return;
    }
  }
  if (confirm("Delete this policy?")) {
    data.policies = data.policies.filter(function (p) {
      return p.id !== id;
    });
    saveData();
    toast("Policy deleted");
    renderAll();
  }
}

// Amount of a policy's sum insured used by claims that were not rejected
function claimedAgainstPolicy(id) {
  var total = 0;
  data.claims.forEach(function (c) {
    if (c.policyId === id && c.status !== "Rejected") total += c.amount;
  });
  return total;
}

function renderPolicies() {
  var box = el("policyList");
  if (data.policies.length === 0) {
    box.innerHTML = '<div class="empty-state" style="grid-column:1/-1">' +
      "<h3>No policies yet</h3>" +
      "<p>Add the policy your claims will be filed under.</p>" +
      '<button class="btn" onclick="openPolicyDialog()">Add policy</button></div>';
    return;
  }

  var html = "";
  data.policies.forEach(function (p) {
    var daysLeft = daysUntil(p.end);
    var used = claimedAgainstPolicy(p.id);
    var percent = Math.min(100, Math.round((used / p.sum) * 100));
    var barClass = percent >= 90 ? "bad" : percent >= 60 ? "warn" : "";

    var tag;
    var validityNote;
    if (daysLeft < 0) {
      tag = '<span class="tag bad">Expired</span>';
      validityNote = "Expired " + Math.abs(daysLeft) + " days ago";
    } else if (daysLeft <= 30) {
      tag = '<span class="tag warn">Expiring soon</span>';
      validityNote = daysLeft + (daysLeft === 1 ? " day left" : " days left");
    } else {
      tag = '<span class="tag good">Active</span>';
      validityNote = daysLeft + " days left";
    }

    var count = data.claims.filter(function (c) {
      return c.policyId === p.id;
    }).length;

    html += '<article class="pcard" style="--h:' + hueFor(p.insurer) + '">' +
      '<div class="pcard-top"><div class="mono">' + esc(p.insurer.charAt(0).toUpperCase()) + "</div>" +
      "<div><div class=\"pcard-name\">" + esc(p.insurer) + '</div><div class="pcard-type">' + esc(p.type) + "</div></div>" + tag + "</div>" +
      '<div class="pcard-body">' +
      '<div class="kv"><span>Policy number</span><span>' + esc(p.number) + "</span></div>" +
      '<div class="kv"><span>Policyholder</span><span>' + esc(p.holder) + "</span></div>" +
      '<div class="kv"><span>Valid</span><span>' + formatDate(p.start) + " to " + formatDate(p.end) + "</span></div>" +
      '<div class="kv"><span>Term</span><span>' + validityNote + "</span></div>" +
      '<div class="usage"><div class="usage-text"><span><strong>' + formatMoney(used) + "</strong> claimed</span><span>of " + formatMoney(p.sum) + "</span></div>" +
      '<div class="bar ' + barClass + '"><i style="width:' + percent + '%"></i></div></div>' +
      "</div>" +
      '<div class="pcard-foot">' +
      '<button class="btn btn-sm btn-ghost" onclick="openClaimDialog(\'' + p.id + '\')">New claim</button>' +
      '<span class="spacer"></span>' +
      '<span class="cell-sub">' + count + (count === 1 ? " claim" : " claims") + "</span>" +
      '<button class="icon-btn" title="Edit policy" aria-label="Edit policy" onclick="openPolicyDialog(\'' + p.id + '\')">' + ICON.edit + "</button>" +
      '<button class="icon-btn danger" title="Delete policy" aria-label="Delete policy" onclick="deletePolicy(\'' + p.id + '\')">' + ICON.trash + "</button>" +
      "</div></article>";
  });
  box.innerHTML = html;
}

/* =====================================================
   CLAIMS - creating and listing
   ===================================================== */
function openClaimDialog(policyId) {
  el("claimForm").reset();
  // back to "new claim" mode (openEditClaim switches these for editing)
  el("claimEditId").value = "";
  el("claimDialogTitle").textContent = "New claim";
  el("claimSubmitBtn").textContent = "Create claim";
  el("cType").disabled = false;

  var select = el("cPolicy");
  if (data.policies.length === 0) {
    select.innerHTML = '<option value="">Add a policy first</option>';
    el("noPolicyNotice").classList.remove("hidden");
  } else {
    el("noPolicyNotice").classList.add("hidden");
    select.innerHTML = '<option value="">Select a policy</option>' +
      data.policies.map(function (p) {
        return '<option value="' + p.id + '">' + esc(p.insurer) + " - " + esc(p.number) + " (" + esc(p.holder) + ")</option>";
      }).join("");
    if (policyId) select.value = policyId;
  }
  el("claimDialog").showModal();
}

// Opens the same form, filled with an existing claim, so its details can be changed
function openEditClaim(id) {
  var c = findClaim(id);
  if (!c) return;
  openClaimDialog(c.policyId);
  el("claimEditId").value = c.id;
  el("claimDialogTitle").textContent = "Edit claim " + c.id;
  el("claimSubmitBtn").textContent = "Save changes";
  el("cPolicy").value = c.policyId;
  el("cPatient").value = c.patient;
  el("cHospital").value = c.hospital;
  el("cDiagnosis").value = c.diagnosis;
  el("cType").value = c.type;
  el("cType").disabled = true; // the document list depends on the type, so it stays fixed
  el("cAmount").value = c.amount;
  el("cDate").value = c.date;
  el("cNotes").value = c.notes;
}

el("claimForm").addEventListener("submit", function (e) {
  e.preventDefault();

  var policyId = el("cPolicy").value;
  var policy = findPolicy(policyId);
  if (!policy) {
    toast("Select a policy first. Add one if the list is empty.", "error");
    return;
  }

  var date = el("cDate").value;
  if (date < policy.start || date > policy.end) {
    toast("The treatment date is outside this policy's term (" +
      formatDate(policy.start) + " to " + formatDate(policy.end) + ").", "error");
    return;
  }

  var amount = Number(el("cAmount").value);
  if (amount > policy.sum) {
    if (!confirm("The claim amount is more than the sum insured. Continue anyway?")) return;
  }

  // Editing an existing claim: update its details and stop here
  var editId = el("claimEditId").value;
  if (editId) {
    var existing = findClaim(editId);
    if (existing.approvedAmount > amount) {
      toast("The claim amount cannot be less than the approved amount (" + formatMoney(existing.approvedAmount) + ").", "error");
      return;
    }
    existing.policyId = policyId;
    existing.patient = el("cPatient").value.trim();
    existing.hospital = el("cHospital").value.trim();
    existing.diagnosis = el("cDiagnosis").value.trim();
    existing.amount = amount;
    existing.date = date;
    existing.notes = el("cNotes").value.trim();
    saveData();
    el("claimDialog").close();
    toast("Claim " + existing.id + " updated");
    renderAll();
    return;
  }

  var type = el("cType").value;
  var docNames = type === "Cashless" ? DOCS_CASHLESS : DOCS_REIMBURSEMENT;
  var docs = docNames.map(function (name) {
    return { name: name, done: false };
  });

  var claim = {
    id: "CLM-" + String(data.nextClaimNo).padStart(3, "0"),
    policyId: policyId,
    patient: el("cPatient").value.trim(),
    hospital: el("cHospital").value.trim(),
    diagnosis: el("cDiagnosis").value.trim(),
    type: type,
    amount: amount,
    approvedAmount: 0,
    date: date,
    status: "Draft",
    notes: el("cNotes").value.trim(),
    documents: docs,
    timeline: [{ status: "Draft", date: todayStr(), note: "Claim created" }],
    reminders: []
  };
  data.nextClaimNo++;
  data.claims.push(claim);
  saveData();

  el("claimDialog").close();
  toast("Claim " + claim.id + " created");
  openClaim(claim.id);
});

function renderFilterOptions() {
  var fs = el("filterStatus");
  var currentStatus = fs.value;
  fs.innerHTML = '<option value="">All statuses</option>' +
    STATUSES.map(function (s) {
      return "<option>" + s + "</option>";
    }).join("");
  fs.value = currentStatus;

  var fp = el("filterPolicy");
  var currentPolicy = fp.value;
  fp.innerHTML = '<option value="">All policies</option>' +
    data.policies.map(function (p) {
      return '<option value="' + p.id + '">' + esc(p.insurer) + " - " + esc(p.number) + "</option>";
    }).join("");
  fp.value = currentPolicy;
}

function renderClaims() {
  var box = el("claimList");
  var text = el("searchBox").value.trim().toLowerCase();
  var statusFilter = el("filterStatus").value;
  var policyFilter = el("filterPolicy").value;
  var sortBy = el("sortBy").value;
  var dateFrom = el("dateFrom").value;
  var dateTo = el("dateTo").value;

  if (data.claims.length === 0) {
    box.innerHTML = '<div class="empty-state"><h3>No claims yet</h3>' +
      "<p>Create a claim to track its documents, status and reminders.</p>" +
      '<button class="btn" onclick="openClaimDialog()">New claim</button></div>';
    return;
  }

  var list = data.claims.filter(function (c) {
    if (statusFilter && c.status !== statusFilter) return false;
    if (policyFilter && c.policyId !== policyFilter) return false;
    if (dateFrom && c.date < dateFrom) return false;
    if (dateTo && c.date > dateTo) return false;
    if (text) {
      var haystack = (c.id + " " + c.patient + " " + c.hospital + " " + c.diagnosis).toLowerCase();
      if (haystack.indexOf(text) === -1) return false;
    }
    return true;
  });

  list.sort(function (a, b) {
    if (sortBy === "oldest") return a.date.localeCompare(b.date);
    if (sortBy === "amountHigh") return b.amount - a.amount;
    if (sortBy === "amountLow") return a.amount - b.amount;
    return b.date.localeCompare(a.date); // newest first
  });

  if (list.length === 0) {
    box.innerHTML = '<div class="empty-state"><h3>No claims match</h3>' +
      "<p>Try a different search or clear the filters.</p></div>";
    return;
  }

  var html = '<div class="table-panel"><table><thead><tr>' +
    "<th>Claim</th><th>Patient</th><th>Policy</th><th>Treatment date</th>" +
    '<th class="num">Amount</th><th>Documents</th><th>Status</th></tr></thead><tbody>';

  list.forEach(function (c) {
    var done = countDone(c);
    var total = c.documents.length;
    var percent = total === 0 ? 0 : Math.round((done / total) * 100);
    var p = findPolicy(c.policyId);
    html += '<tr tabindex="0" onclick="openClaim(\'' + c.id + '\')" onkeydown="if(event.key===\'Enter\')openClaim(\'' + c.id + '\')">' +
      '<td><div class="cell-title">' + esc(c.diagnosis) + '</div><div class="cell-sub">' + c.id + " at " + esc(c.hospital) + "</div></td>" +
      "<td>" + esc(c.patient) + "</td>" +
      "<td>" + esc(p ? p.insurer : "Deleted policy") + "</td>" +
      "<td>" + formatDate(c.date) + "</td>" +
      '<td class="num">' + formatMoney(c.amount) + "</td>" +
      '<td class="doc-cell"><small>' + done + " of " + total + '</small><div class="bar thin ' + (percent === 100 ? "good" : "") + '"><i style="width:' + percent + '%"></i></div></td>' +
      "<td>" + chip(c.status) + "</td></tr>";
  });

  html += "</tbody></table></div>";
  box.innerHTML = html;
}

/* =====================================================
   CLAIM DETAIL PAGE
   ===================================================== */
function clearFilters() {
  el("searchBox").value = "";
  el("filterStatus").value = "";
  el("filterPolicy").value = "";
  el("sortBy").value = "newest";
  el("dateFrom").value = "";
  el("dateTo").value = "";
  renderClaims();
}

function openClaim(id) {
  currentClaimId = id;
  showPage("detail");
}

// Works out the stages shown in the tracker at the top of a claim
function buildStages(c) {
  var path = ["Draft", "Submitted", "Under Review", "Approved", "Settled"];
  if (c.status === "Rejected") path = ["Draft", "Submitted", "Under Review", "Rejected"];

  var current = path.indexOf(c.status);
  if (c.status === "Query Raised") current = 2; // a query happens during review

  var html = '<ol class="stepper">';
  path.forEach(function (stage, i) {
    var cls = "step";
    if (i < current) cls += " done";
    if (i === current) cls += " current";
    if (i === path.length - 1) cls += " final";
    var flag = "";
    if (i === current && c.status === "Query Raised") {
      cls += " warn";
      flag = '<div class="step-flag">Query raised</div>';
    }
    if (stage === "Rejected" && i === current) {
      cls += " bad";
      flag = '<div class="step-flag">Claim rejected</div>';
    }

    // date of the first time this stage was reached
    var date = "";
    for (var t = 0; t < c.timeline.length; t++) {
      if (c.timeline[t].status === stage) {
        date = formatDate(c.timeline[t].date);
        break;
      }
    }

    var dot = "";
    if (i < current || (i === current && i === path.length - 1 && stage === "Settled")) dot = ICON.check;
    if (stage === "Rejected" && i === current) dot = ICON.close;

    html += '<li class="' + cls + '"><span class="step-dot">' + dot + "</span>" +
      '<div class="step-name">' + stage + "</div>" +
      '<div class="step-date">' + (date || "&nbsp;") + "</div>" + flag + "</li>";
  });
  html += "</ol>";
  return html;
}

function nextStatus(status) {
  var map = {
    "Draft": "Submitted",
    "Submitted": "Under Review",
    "Under Review": "Approved",
    "Query Raised": "Under Review",
    "Approved": "Settled"
  };
  return map[status] || status;
}

function renderDetail() {
  var c = findClaim(currentClaimId);
  var box = el("detailContent");
  if (!c) {
    box.innerHTML = '<div class="empty-state"><h3>Claim not found</h3></div>';
    return;
  }

  var policy = findPolicy(c.policyId);
  var done = countDone(c);
  var total = c.documents.length;
  var percent = total === 0 ? 0 : Math.round((done / total) * 100);
  var suggested = nextStatus(c.status);

  var html = "";

  // ----- Header, tracker and facts -----
  html += '<div class="panel">' +
    '<div class="d-head"><div><div class="d-id">' + c.id + "</div><h1>" + esc(c.patient) + "</h1>" +
    '<p class="sub">' + esc(c.diagnosis) + " at " + esc(c.hospital) + "</p></div>" +
    '<div class="d-actions">' + chip(c.status) +
    '<button class="btn btn-sm btn-ghost" onclick="openEditClaim(\'' + c.id + '\')">Edit details</button>' +
    '<button class="btn btn-sm btn-danger-ghost" onclick="deleteClaim(\'' + c.id + '\')">Delete claim</button></div></div>' +
    buildStages(c) +
    '<div class="facts">' +
    fact("Policy", policyLabel(c.policyId)) +
    fact("Policyholder", policy ? policy.holder : "-") +
    fact("Claim type", c.type) +
    fact("Treatment date", formatDate(c.date)) +
    fact("Claimed amount", formatMoney(c.amount)) +
    fact("Approved amount", c.approvedAmount ? formatMoney(c.approvedAmount) : "Not yet approved") +
    "</div></div>";

  html += '<div class="d-grid">';

  // ===== Left column =====
  html += '<div class="d-col">';

  // Document checklist
  html += '<div class="panel"><div class="panel-head"><h3>Documents</h3><span>' + done + " of " + total + " ready</span></div>" +
    '<div class="bar ' + (percent === 100 ? "good" : "") + '" style="margin-bottom:8px"><i style="width:' + percent + '%"></i></div>';
  c.documents.forEach(function (d, index) {
    html += '<div class="check' + (d.done ? " done" : "") + '">' +
      '<input type="checkbox" id="doc' + index + '" ' + (d.done ? "checked" : "") + ' onchange="toggleDoc(' + index + ')">' +
      '<label for="doc' + index + '">' + esc(d.name) + "</label>" +
      '<button class="icon-btn danger" title="Remove document" aria-label="Remove ' + esc(d.name) + '" onclick="removeDoc(' + index + ')">' + ICON.close + "</button></div>";
  });
  html += '<div class="add-row"><input type="text" id="newDocName" placeholder="Add another document" aria-label="New document name" onkeydown="if(event.key===\'Enter\')addDoc()">' +
    '<button class="btn" onclick="addDoc()">Add</button></div></div>';

  // Notes
  html += '<div class="panel"><div class="panel-head"><h3>Notes</h3><span>Saved when you click away</span></div>' +
    '<textarea id="claimNotes" rows="5" placeholder="Agent names, phone numbers, reference numbers" onchange="saveNotes()">' + esc(c.notes) + "</textarea></div>";

  // Reminders
  html += '<div class="panel"><h3>Reminders</h3>';
  if (c.reminders.length === 0) {
    html += '<p class="empty">No reminders yet. Add one so you remember to follow up.</p>';
  }
  c.reminders.forEach(function (r, index) {
    var days = daysUntil(r.date);
    html += '<div class="check' + (r.done ? " done" : "") + '">' +
      '<input type="checkbox" id="rem' + index + '" ' + (r.done ? "checked" : "") + ' onchange="toggleReminder(' + index + ')">' +
      '<label for="rem' + index + '">' + esc(r.text) + "</label>" +
      (r.done ? '<span class="due">' + formatDate(r.date) + "</span>" : '<span class="due ' + dueClass(days) + '">' + dueText(days) + "</span>") +
      '<button class="icon-btn danger" title="Remove reminder" aria-label="Remove reminder" onclick="removeReminder(' + index + ')">' + ICON.close + "</button></div>";
  });
  html += '<div class="add-row"><input type="text" id="remText" placeholder="e.g. Call insurer for an update" aria-label="Reminder text">' +
    '<input type="date" id="remDate" aria-label="Reminder date" style="max-width:160px">' +
    '<button class="btn" onclick="addReminder()">Add</button></div></div>';

  html += "</div>"; // end left column

  // ===== Right column =====
  html += '<div class="d-col">';

  // Update status
  html += '<div class="panel"><h3>Update status</h3><div class="status-form">' +
    '<label>Move to<select id="newStatus">' +
    STATUSES.map(function (s) {
      return "<option" + (s === suggested ? " selected" : "") + ">" + s + "</option>";
    }).join("") + "</select></label>" +
    '<label>Date<input type="date" id="statusDate" value="' + todayStr() + '"></label>' +
    '<label>Note (optional)<input type="text" id="statusNote" placeholder="e.g. Insurer asked for the discharge summary"></label>' +
    '<label>Approved amount in ₹ (if any)<input type="number" id="approvedAmt" min="0" value="' + (c.approvedAmount || "") + '"></label>' +
    '<button class="btn" onclick="updateStatus()" style="justify-content:center">Update status</button></div></div>';

  // Timeline
  html += '<div class="panel"><h3>History</h3><ol class="timeline">';
  for (var i = c.timeline.length - 1; i >= 0; i--) {
    var t = c.timeline[i];
    html += '<li class="' + statusClass(t.status) + '"><div class="t-top"><span class="t-status">' + esc(t.status) + "</span>" +
      '<span class="t-date">' + formatDate(t.date) + "</span></div>" +
      (t.note ? '<div class="t-note">' + esc(t.note) + "</div>" : "") + "</li>";
  }
  html += "</ol></div>";

  html += "</div></div>"; // end right column and grid

  box.innerHTML = html;
}

function fact(label, value) {
  return '<div><div class="fact-label">' + label + '</div><div class="fact-value">' + esc(value) + "</div></div>";
}

function updateStatus() {
  var c = findClaim(currentClaimId);
  var status = el("newStatus").value;
  var date = el("statusDate").value || todayStr();
  var note = el("statusNote").value.trim();
  var approved = Number(el("approvedAmt").value) || 0;

  if (approved > c.amount) {
    toast("The approved amount cannot be more than the claimed amount.", "error");
    return;
  }
  if ((status === "Approved" || status === "Settled") && approved === 0) {
    if (!confirm("No approved amount entered. Continue?")) return;
  }

  c.approvedAmount = approved;

  if (status === c.status && note === "") {
    saveData();
    toast("Approved amount saved");
    renderAll();
    return;
  }
  c.status = status;
  c.timeline.push({ status: status, date: date, note: note });
  saveData();
  toast("Status updated to " + status);
  renderAll();
}

function toggleDoc(index) {
  var c = findClaim(currentClaimId);
  c.documents[index].done = !c.documents[index].done;
  saveData();
  renderAll();
}

function addDoc() {
  var name = el("newDocName").value.trim();
  if (name === "") return;
  findClaim(currentClaimId).documents.push({ name: name, done: false });
  saveData();
  renderAll();
}

function removeDoc(index) {
  findClaim(currentClaimId).documents.splice(index, 1);
  saveData();
  renderAll();
}

function saveNotes() {
  findClaim(currentClaimId).notes = el("claimNotes").value.trim();
  saveData();
  toast("Notes saved");
}

function addReminder() {
  var text = el("remText").value.trim();
  var date = el("remDate").value;
  if (text === "" || date === "") {
    toast("Enter a reminder and pick a date.", "error");
    return;
  }
  findClaim(currentClaimId).reminders.push({ text: text, date: date, done: false });
  saveData();
  toast("Reminder added");
  renderAll();
}

function toggleReminder(index) {
  var c = findClaim(currentClaimId);
  c.reminders[index].done = !c.reminders[index].done;
  saveData();
  renderAll();
}

function removeReminder(index) {
  findClaim(currentClaimId).reminders.splice(index, 1);
  saveData();
  renderAll();
}

function deleteClaim(id) {
  if (confirm("Delete claim " + id + "? This cannot be undone.")) {
    data.claims = data.claims.filter(function (c) {
      return c.id !== id;
    });
    saveData();
    toast("Claim deleted");
    showPage("claims");
  }
}

/* =====================================================
   OVERVIEW (dashboard)
   ===================================================== */
function renderDashboard() {
  var claims = data.claims;

  // greeting line with today's date
  var now = new Date();
  var dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  el("todayText").textContent = dayNames[now.getDay()] + ", " + now.getDate() + " " + MONTHS[now.getMonth()] + " " + now.getFullYear();

  el("emptyBanner").classList.toggle("hidden", data.policies.length > 0 || claims.length > 0);

  // ----- Summary strip -----
  var totalClaimed = 0;
  var totalApproved = 0;
  var open = 0;
  claims.forEach(function (c) {
    totalClaimed += c.amount;
    totalApproved += c.approvedAmount || 0;
    if (c.status !== "Settled" && c.status !== "Rejected") open++;
  });

  var pending = getPendingReminders();
  var overdue = pending.filter(function (r) {
    return daysUntil(r.date) < 0;
  }).length;
  var dueSoon = pending.filter(function (r) {
    return daysUntil(r.date) <= 3;
  }).length;

  var activePolicies = data.policies.filter(function (p) {
    return daysUntil(p.end) >= 0;
  }).length;

  // reminders that are due today or already overdue
  var urgent = pending.filter(function (r) {
    return daysUntil(r.date) <= 0;
  });
  var alertBox = el("reminderAlert");
  if (urgent.length > 0) {
    alertBox.classList.remove("hidden");
    alertBox.innerHTML = "<span>" + urgent.length + (urgent.length === 1 ? " reminder is" : " reminders are") +
      " overdue or due today. First up: " + esc(urgent[0].text) + " (" + urgent[0].claimId + ")</span>" +
      '<button class="btn btn-sm" onclick="openClaim(\'' + urgent[0].claimId + '\')">Open claim</button>';
  } else {
    alertBox.classList.add("hidden");
  }
  var badge = el("claimsBadge");
  badge.textContent = urgent.length;
  badge.classList.toggle("hidden", urgent.length === 0);
  document.title = (urgent.length ? "(" + urgent.length + ") " : "") + "Health Insurance Claim Tracker";

  el("summaryStrip").innerHTML =
    stat("Open claims", open, claims.length + " in total", false) +
    stat("Total claimed", formatCompact(totalClaimed), "Across all claims", false) +
    stat("Total approved", formatCompact(totalApproved), totalClaimed ? Math.round((totalApproved / totalClaimed) * 100) + "% of claimed" : "Nothing claimed yet", false) +
    stat("Reminders due soon", dueSoon, overdue ? overdue + " overdue" : "None overdue", overdue > 0) +
    stat("Active policies", activePolicies, data.policies.length + " on file", false);

  // ----- Pipeline -----
  var pipe = "";
  STATUSES.forEach(function (s) {
    var inLane = claims.filter(function (c) {
      return c.status === s;
    });
    pipe += '<div class="lane ' + statusClass(s) + '"><div class="lane-head"><span class="dot"></span>' + s +
      '<span class="count">' + inLane.length + "</span></div>";
    if (inLane.length === 0) {
      pipe += '<div class="lane-empty">Nothing here</div>';
    }
    inLane.forEach(function (c) {
      var done = countDone(c);
      var total = c.documents.length;
      var percent = total === 0 ? 0 : Math.round((done / total) * 100);
      pipe += '<button class="mini" onclick="openClaim(\'' + c.id + '\')">' +
        '<div class="mini-id">' + c.id + '</div><div class="mini-name">' + esc(c.patient) + "</div>" +
        '<div class="mini-row"><strong>' + formatCompact(c.amount) + "</strong><span title=\"Documents ready\">" + done + "/" + total + " docs</span></div>" +
        '<div class="bar thin ' + (percent === 100 ? "good" : "") + '"><i style="width:' + percent + '%"></i></div></button>';
    });
    pipe += "</div>";
  });
  el("pipeline").innerHTML = pipe;

  // ----- Reminders -----
  if (pending.length === 0) {
    el("reminderList").innerHTML = '<p class="empty">You are all caught up. Add reminders from inside a claim.</p>';
  } else {
    var rhtml = "";
    pending.slice(0, 6).forEach(function (r) {
      var days = daysUntil(r.date);
      rhtml += '<div class="row-item">' +
        '<button class="row-main row-link" onclick="openClaim(\'' + r.claimId + '\')">' +
        '<div class="row-title">' + esc(r.text) + '</div><div class="row-sub">' + r.claimId + " for " + esc(r.patient) + "</div></button>" +
        '<span class="due ' + dueClass(days) + '">' + dueText(days) + "</span></div>";
    });
    el("reminderList").innerHTML = rhtml;
  }

  // ----- Coverage -----
  if (data.policies.length === 0) {
    el("coverageList").innerHTML = '<p class="empty">Add a policy to see how much of your cover is used.</p>';
  } else {
    var chtml = "";
    data.policies.forEach(function (p) {
      var used = claimedAgainstPolicy(p.id);
      var percent = Math.min(100, Math.round((used / p.sum) * 100));
      var barClass = percent >= 90 ? "bad" : percent >= 60 ? "warn" : "";
      chtml += '<div class="row-item"><div class="row-main">' +
        '<div class="usage-text" style="margin-bottom:6px"><span><strong style="color:var(--text)">' + esc(p.insurer) + "</strong> " + esc(p.number) + "</span>" +
        "<span>" + formatCompact(used) + " of " + formatCompact(p.sum) + "</span></div>" +
        '<div class="bar ' + barClass + '"><i style="width:' + percent + '%"></i></div></div></div>';
    });
    el("coverageList").innerHTML = chtml;
  }
}

function stat(label, value, note, isBad) {
  return '<div class="strip-item"><div class="strip-label">' + label + '</div><div class="strip-value">' + value +
    '</div><div class="strip-note' + (isBad ? " bad" : "") + '">' + note + "</div></div>";
}

// Collect all reminders that are not done, sorted by date
function getPendingReminders() {
  var list = [];
  data.claims.forEach(function (c) {
    c.reminders.forEach(function (r) {
      if (!r.done) {
        list.push({ text: r.text, date: r.date, claimId: c.id, patient: c.patient });
      }
    });
  });
  list.sort(function (a, b) {
    return a.date.localeCompare(b.date);
  });
  return list;
}

/* =====================================================
   SAMPLE DATA / RESET
   ===================================================== */
function loadSampleData() {
  if (data.policies.length > 0 || data.claims.length > 0) {
    if (!confirm("This will replace your current data with sample data. Continue?")) return;
  }

  // dates are worked out from today so the sample always looks current
  data = {
    policies: [
      { id: "P1", insurer: "Star Health", number: "SH-784512", holder: "Rakesh Kumar", type: "Family Floater",
        sum: 500000, start: offsetDate(-230), end: offsetDate(135) },
      { id: "P2", insurer: "HDFC Ergo", number: "HE-209933", holder: "Rakesh Kumar", type: "Individual",
        sum: 300000, start: offsetDate(-340), end: offsetDate(25) }
    ],
    claims: [
      {
        id: "CLM-001", policyId: "P1", patient: "Meena Kumar", hospital: "Fortis Hospital",
        diagnosis: "Appendicitis surgery", type: "Reimbursement", amount: 85000, approvedAmount: 0,
        date: offsetDate(-66), status: "Under Review", notes: "Agent contact: Mr. Sharma, 98xxxxxx10",
        documents: [
          { name: "Claim form (signed)", done: true },
          { name: "Policy copy / e-card", done: true },
          { name: "ID proof", done: true },
          { name: "Discharge summary", done: true },
          { name: "Hospital bills (original)", done: false },
          { name: "Payment receipts", done: false },
          { name: "Doctor's prescriptions", done: true },
          { name: "Diagnostic reports", done: true },
          { name: "Cancelled cheque / bank details", done: false }
        ],
        timeline: [
          { status: "Draft", date: offsetDate(-58), note: "Claim created" },
          { status: "Submitted", date: offsetDate(-53), note: "Sent documents by courier" },
          { status: "Under Review", date: offsetDate(-43), note: "Insurer acknowledged receipt" }
        ],
        reminders: [
          { text: "Call insurer for a status update", date: offsetDate(-3), done: false },
          { text: "Send original bills", date: offsetDate(2), done: false }
        ]
      },
      {
        id: "CLM-002", policyId: "P2", patient: "Rakesh Kumar", hospital: "Apollo Clinic",
        diagnosis: "Dental treatment", type: "Cashless", amount: 22000, approvedAmount: 20000,
        date: offsetDate(-137), status: "Settled", notes: "",
        documents: [
          { name: "Pre-authorisation form", done: true },
          { name: "Policy copy / e-card", done: true },
          { name: "ID proof", done: true },
          { name: "Doctor's admission note", done: true },
          { name: "Diagnostic reports", done: true },
          { name: "Final hospital bill", done: true }
        ],
        timeline: [
          { status: "Draft", date: offsetDate(-137), note: "Claim created" },
          { status: "Submitted", date: offsetDate(-136), note: "" },
          { status: "Under Review", date: offsetDate(-133), note: "" },
          { status: "Approved", date: offsetDate(-130), note: "Rs 2,000 deducted as co-pay" },
          { status: "Settled", date: offsetDate(-122), note: "Paid directly to the hospital" }
        ],
        reminders: []
      },
      {
        id: "CLM-003", policyId: "P1", patient: "Aarav Kumar", hospital: "City Child Care",
        diagnosis: "Viral fever hospitalisation", type: "Reimbursement", amount: 18500, approvedAmount: 0,
        date: offsetDate(-16), status: "Query Raised", notes: "Insurer wants a clearer discharge summary.",
        documents: [
          { name: "Claim form (signed)", done: true },
          { name: "Policy copy / e-card", done: true },
          { name: "ID proof", done: true },
          { name: "Discharge summary", done: false },
          { name: "Hospital bills (original)", done: true },
          { name: "Payment receipts", done: true },
          { name: "Doctor's prescriptions", done: true },
          { name: "Diagnostic reports", done: true },
          { name: "Cancelled cheque / bank details", done: true }
        ],
        timeline: [
          { status: "Draft", date: offsetDate(-13), note: "Claim created" },
          { status: "Submitted", date: offsetDate(-10), note: "Submitted online" },
          { status: "Under Review", date: offsetDate(-7), note: "" },
          { status: "Query Raised", date: offsetDate(-4), note: "Discharge summary unclear" }
        ],
        reminders: [
          { text: "Get a new discharge summary from the hospital", date: offsetDate(1), done: false }
        ]
      },
      {
        id: "CLM-004", policyId: "P2", patient: "Meena Kumar", hospital: "LensCare Eye Centre",
        diagnosis: "Cataract surgery", type: "Cashless", amount: 64000, approvedAmount: 58000,
        date: offsetDate(-30), status: "Approved", notes: "",
        documents: [
          { name: "Pre-authorisation form", done: true },
          { name: "Policy copy / e-card", done: true },
          { name: "ID proof", done: true },
          { name: "Doctor's admission note", done: true },
          { name: "Diagnostic reports", done: true },
          { name: "Final hospital bill", done: false }
        ],
        timeline: [
          { status: "Draft", date: offsetDate(-30), note: "Claim created" },
          { status: "Submitted", date: offsetDate(-29), note: "" },
          { status: "Under Review", date: offsetDate(-24), note: "" },
          { status: "Approved", date: offsetDate(-9), note: "Approved for Rs 58,000" }
        ],
        reminders: []
      },
      {
        id: "CLM-005", policyId: "P1", patient: "Rakesh Kumar", hospital: "Sunrise Diagnostics",
        diagnosis: "Annual health check-up", type: "Reimbursement", amount: 6500, approvedAmount: 0,
        date: offsetDate(-5), status: "Draft", notes: "",
        documents: [
          { name: "Claim form (signed)", done: false },
          { name: "Policy copy / e-card", done: true },
          { name: "ID proof", done: true },
          { name: "Discharge summary", done: false },
          { name: "Hospital bills (original)", done: false },
          { name: "Payment receipts", done: false },
          { name: "Doctor's prescriptions", done: false },
          { name: "Diagnostic reports", done: false },
          { name: "Cancelled cheque / bank details", done: false }
        ],
        timeline: [
          { status: "Draft", date: offsetDate(-4), note: "Claim created" }
        ],
        reminders: []
      }
    ],
    nextPolicyNo: 3,
    nextClaimNo: 6
  };
  saveData();
  toast("Sample data loaded");
  renderAll();
}

function clearAllData() {
  if (confirm("Delete ALL policies and claims? This cannot be undone.")) {
    data = { policies: [], claims: [], nextPolicyNo: 1, nextClaimNo: 1 };
    saveData();
    toast("All data cleared");
    showPage("dashboard");
  }
}

// ---------- Dialog helpers ----------
// Clicking the dark area behind a dialog closes it
["policyDialog", "claimDialog"].forEach(function (id) {
  el(id).addEventListener("click", function (e) {
    if (e.target === el(id)) el(id).close();
  });
});

// ---------- Start the app ----------
renderAll();

// When the page opens, remind the user about anything due today or overdue
var dueOnOpen = getPendingReminders().filter(function (r) {
  return daysUntil(r.date) <= 0;
});
if (dueOnOpen.length > 0) {
  toast("You have " + dueOnOpen.length + (dueOnOpen.length === 1 ? " reminder" : " reminders") + " due today or overdue.", "error");
}
