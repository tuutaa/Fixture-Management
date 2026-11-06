import { loadDb, saveDb, uid } from './db';

const delay = (ms = 50) => new Promise((r) => setTimeout(r, ms));

function db() { return loadDb(); }

export const api = {
  // Auth
  async login(username, password) {
    await delay();
    const d = db();
    const u = d.users.find((x) => x.UserID === username && x.Password === password);
    if (u && u.Status === 'signed') {
      return { success: true, name: u.Name, userId: u.UserID, lastName: u.LastName || '', role: u.Authorization || '' };
    }
    if (u) return { success: false, message: 'บัญชีของคุณยังไม่ได้รับการอนุมัติ' };
    return { success: false, message: 'Invalid UserID or Password' };
  },
  async register(user) {
    await delay();
    const d = db();
    if (d.users.some((x) => x.UserID === user.UserID)) return { success: false, message: 'UserID นี้ถูกใช้งานแล้ว!' };
    d.users.push({ _id: uid('u'), UserID: user.UserID, Password: user.Password, Name: user.Name, LastName: user.LastName, Status: 'unsigned', Authorization: '' });
    saveDb(d);
    return { success: true, message: 'Register Success!' };
  },

  // Fixtures
  async getFixtures() {
    await delay();
    return [...db().fixtures];
  },
  async checkStatus(sn) {
    await delay();
    const f = db().fixtures.find((x) => x.SN === sn);
    if (!f) return { found: false, message: 'ไม่พบข้อมูล Serial Number นี้ในระบบ' };
    return { found: true, status: f.Status, name: f.Name, model: f.Model, currentLine: f.Line, withdrawBy: f.WithdrawBy || '-' };
  },
  async getInUse({ model, line } = {}) {
    await delay();
    let q = db().fixtures.filter((x) => x.Status === 'In Use');
    if (model) q = q.filter((x) => x.Model === model);
    if (line) q = q.filter((x) => x.Line === line);
    return q;
  },
  async getByModel({ model, line } = {}) {
    await delay();
    let q = db().fixtures;
    if (model) q = q.filter((x) => x.Model === model);
    if (line) q = q.filter((x) => x.Line === line);
    return q;
  },
  async getOptions() {
    await delay();
    const d = db();
    return { models: d.models.map((x) => ({ Model: x.Model, Description: x.Description })), lines: d.lines.map((x) => ({ Line: x.Line, Description: x.Description })) };
  },
  async bulkRegister(items) {
    await delay();
    const d = db();
    const inserted = items.map((it) => ({ _id: uid('f'), ...it }));
    d.fixtures.push(...inserted);
    saveDb(d);
    return { success: true, count: inserted.length };
  },
  async bulkIssue({ items }) {
    await delay();
    const d = db();
    for (const it of items) {
      const f = d.fixtures.find((x) => x.SN === it.SN);
      if (f) {
        f.Status = 'In Use';
        f.Line = it.Line;
        f.Model = it.Model;
        f.OrderID = it.OrderID;
        f.Usage = { ...(f.Usage || {}), MaxUsed: it.MaxUsed, ExpiredDate: it.ExpiredDate };
        f.WithdrawBy = it.WithdrawBy;
      }
    }
    saveDb(d);
    return { success: true };
  },
  async bulkReturn({ items, targetStatus }) {
    await delay();
    const d = db();
    const sns = items.map((i) => i.SN);
    const final = targetStatus || 'In Stock';
    for (const f of d.fixtures) {
      if (sns.includes(f.SN)) {
        f.Status = final;
        f.Line = 'N/A';
        f.Model = 'N/A';
        f.OrderID = '';
        f.WithdrawBy = null;
        f.Usage = { ...(f.Usage || {}), ExpiredDate: null, MaxUsed: null, CurrentUsed: 0 };
      }
    }
    saveDb(d);
    return { success: true, message: `Returned to ${final} successfully` };
  },
  async returnInstant({ serialNumber, targetStatus }) {
    await delay();
    const d = db();
    const f = d.fixtures.find((x) => x.SN === serialNumber);
    if (!f) return { success: false, message: 'ไม่พบ Serial Number นี้ในระบบ' };
    const final = targetStatus || 'In Stock';
    f.Status = final;
    f.Line = 'N/A';
    f.Model = 'N/A';
    f.OrderID = '';
    f.WithdrawBy = null;
    f.Usage = { ...(f.Usage || {}), ExpiredDate: null, MaxUsed: null, CurrentUsed: 0 };
    saveDb(d);
    return { success: true };
  },
  async updateFixtureBySn(sn, payload) {
    await delay();
    const d = db();
    const f = d.fixtures.find((x) => x.SN === sn);
    if (!f) return { success: false, message: 'Fixture not found' };
    Object.assign(f, payload);
    if (payload.Usage) f.Usage = { ...(f.Usage || {}), ...payload.Usage };
    if (payload.Registed) f.Registed = { ...(f.Registed || {}), ...payload.Registed };
    saveDb(d);
    return { success: true, message: 'Update success', data: f };
  },
  async deleteFixtureBySn(sn) {
    await delay();
    const d = db();
    const idx = d.fixtures.findIndex((x) => x.SN === sn);
    if (idx === -1) return { success: false, message: 'Fixture not found' };
    d.fixtures.splice(idx, 1);
    saveDb(d);
    return { success: true, message: 'Delete success' };
  },

  // Fixture bases
  async getFixtureBases() { await delay(); return [...db().fixture_bases]; },
  async deleteFixtureBase(id) { await delay(); const d=db(); const i=d.fixture_bases.findIndex(x=>x._id===id); if(i>-1){d.fixture_bases.splice(i,1);saveDb(d);} return {success:true}; },
  async upsertFixtureBase(payload) {
    await delay();
    const d = db();
    let b = d.fixture_bases.find((x) => x.SN === payload.SN);
    if (b) { b.Name=payload.Name; b.Description=payload.Description||''; b.Location=payload.Location||''; }
    else { b={_id:uid('b'), SN:payload.SN, Name:payload.Name, Description:payload.Description||'', Location:payload.Location||'', ImagePath:'' }; d.fixture_bases.push(b); }
    saveDb(d);
    return { success: true, data: b };
  },
  async basesCount() {
    await delay();
    const counts = {};
    for (const f of db().fixtures) {
      const k = f.FixtureBase || 'Unknown';
      counts[k] = (counts[k]||0)+1;
    }
    return Object.keys(counts).map((k)=>({name:k, qty:counts[k]}));
  },
  async uploadImage(sn, file) {
    await delay(100);
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const d = db();
    let b = d.fixture_bases.find((x)=>x.SN===sn);
    if (!b) { b={_id:uid('b'),SN:sn,Name:sn,Description:'',Location:'',ImagePath:dataUrl}; d.fixture_bases.push(b);}
    else b.ImagePath = dataUrl;
    saveDb(d);
    const filename = `${sn}-${Date.now()}`;
    b.ImagePath = dataUrl;
    saveDb(d);
    return { success: true, filename };
  },

  // Storages
  async getStorages() { await delay(); return [...db().storages].sort((a,b)=>String(a.StorageLocation).localeCompare(String(b.StorageLocation))); },
  async createStorage(p) { await delay(); const d=db(); if(d.storages.some(x=>String(x.StorageLocation).toLowerCase()===String(p.StorageLocation).toLowerCase())) return {success:false,message:'ชื่อสถานที่นี้มีอยู่แล้ว'}; d.storages.push({_id:uid('s'),...p}); saveDb(d); return {success:true}; },
  async updateStorage(id,p) { await delay(); const d=db(); const x=d.storages.find(z=>z._id===id); if(x){Object.assign(x,p);saveDb(d);} return {success:true}; },
  async deleteStorage(id) { await delay(); const d=db(); const i=d.storages.findIndex(x=>x._id===id); if(i>-1){d.storages.splice(i,1);saveDb(d);} return {success:true}; },

  // Models
  async getModels() { await delay(); return [...db().models].sort((a,b)=>String(a.Model).localeCompare(String(b.Model))); },
  async createModel(p) { await delay(); const d=db(); if(d.models.some(x=>String(x.Model).toLowerCase()===String(p.Model).toLowerCase())) return {success:false,message:'ชื่อ Model นี้มีอยู่แล้ว'}; d.models.push({_id:uid('m'),Model:p.Model,Description:p.Description||'',FixtureList:[]}); saveDb(d); return {success:true}; },
  async updateModel(id,p) { await delay(); const d=db(); const x=d.models.find(z=>z._id===id); if(x){if(p.Model!==undefined)x.Model=p.Model; if(p.Description!==undefined)x.Description=p.Description; saveDb(d);} return {success:true}; },
  async deleteModel(id) { await delay(); const d=db(); const i=d.models.findIndex(x=>x._id===id); if(i>-1){d.models.splice(i,1);saveDb(d);} return {success:true}; },
  async updateModelList(id, list) { await delay(); const d=db(); const x=d.models.find(z=>z._id===id); if(x){x.FixtureList=list;saveDb(d);return {success:true,data:x};} return {success:false,message:'ไม่พบ Model ID ในระบบ'}; },

  // Lines
  async getLines() { await delay(); return [...db().lines].sort((a,b)=>String(a.Line).localeCompare(String(b.Line))); },
  async createLine(p) { await delay(); const d=db(); if(d.lines.some(x=>String(x.Line).toLowerCase()===String(p.Line).toLowerCase())) return {success:false,message:'ชื่อ Line นี้มีอยู่แล้ว'}; d.lines.push({_id:uid('l'),...p}); saveDb(d); return {success:true}; },
  async updateLine(id,p) { await delay(); const d=db(); const x=d.lines.find(z=>z._id===id); if(x){Object.assign(x,p);saveDb(d);} return {success:true}; },
  async deleteLine(id) { await delay(); const d=db(); const i=d.lines.findIndex(x=>x._id===id); if(i>-1){d.lines.splice(i,1);saveDb(d);} return {success:true}; },

  // Employees
  async getEmployees() { await delay(); return [...db().employees].sort((a,b)=>String(a.UserID).localeCompare(String(b.UserID))); },

  // Fixture Requests
  async getFixtureRequests() { await delay(); return [...db().fixture_requests].sort((a,b)=>new Date(b.RequestTime)-new Date(a.RequestTime)); },
  async createFixtureRequest(payload) {
    await delay();
    const d = db();
    const now = new Date();
    const prefix = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    const count = d.fixture_requests.filter((x)=>String(x.OrderNo).startsWith(`REQ-${prefix}`)).length;
    const orderNo = `REQ-${prefix}-${String(count+1).padStart(3,'0')}`;
    const nr = {
      _id: uid('r'),
      OrderNo: orderNo,
      Status: 'Waiting',
      WaitingTime: 0,
      ProcessTime: 0,
      FinishedTime: null,
      ReadyTime: null,
      InProgressTime: null,
      Model: payload.model,
      Line: payload.line,
      Type: payload.type,
      RequestID: payload.requestID,
      AcceptID: null,
      ReceiveBy: null,
      Fixtures: payload.fixtures || [],
      requested_fixture_list: payload.requested_fixture_list || [],
      Description: payload.description || '',
      RequestTime: now.toISOString(),
    };
    d.fixture_requests.push(nr);
    saveDb(d);
    return { success: true, orderNo };
  },
  async acceptOnly(orderNo, { acceptID }) {
    await delay();
    const d = db();
    const r = d.fixture_requests.find((x)=>x.OrderNo===orderNo.trim());
    if (!r) return { success: false, message: 'Order not found' };
    r.Status='In-progress';
    r.AcceptID=acceptID;
    r.WaitingTime = new Date()-new Date(r.RequestTime);
    r.InProgressTime = new Date().toISOString();
    saveDb(d);
    return { success: true, message:'updated', updatedDocument:r };
  },
  async accept(orderNo, { fixtures }) {
    await delay();
    const d = db();
    const r = d.fixture_requests.find((x)=>x.OrderNo===orderNo.trim());
    if (!r) return { success:false, message:'Order not found' };
    r.Status='Ready';
    r.Fixtures = fixtures || [];
    r.ReadyTime = new Date().toISOString();
    saveDb(d);
    return { success: true, message:'updated', updatedDocument:r };
  },
  async complete(orderNo, { receiveBy }) {
    await delay();
    if (!receiveBy) return { success:false, message:'กรุณาระบุชื่อผู้รับ' };
    const d = db();
    const r = d.fixture_requests.find((x)=>x.OrderNo===orderNo);
    if (!r) return { success:false, message:'Order not found' };
    const currentTime = new Date();
    const processTime = r.InProgressTime ? currentTime - new Date(r.InProgressTime) : 0;
    r.Status='Finished';
    r.FinishedTime=currentTime.toISOString();
    r.ProcessTime=processTime;
    r.ReceiveBy=receiveBy;
    if (!r.ReadyTime) r.ReadyTime=currentTime.toISOString();
    if (r.Fixtures && r.Fixtures.length) {
      const sns = r.Fixtures.map((f)=> (typeof f==='string'?f:f.SN));
      for (const f of d.fixtures) if (sns.includes(f.SN)) f.WithdrawBy = receiveBy;
    }
    saveDb(d);
    return { success:true, message:'updated' };
  },

  // Issue Drafts
  async getIssueDrafts() { await delay(); return [...db().issue_drafts].sort((a,b)=>new Date(b.UpdatedAt)-new Date(a.UpdatedAt)); },
  async createIssueDraft(p) { await delay(); const d=db(); d.issue_drafts.push({_id:uid('d'),...p,UpdatedAt:new Date().toISOString()}); saveDb(d); return {success:true}; },
  async deleteIssueDraft(id) { await delay(); const d=db(); const i=d.issue_drafts.findIndex(x=>x._id===id); if(i>-1){d.issue_drafts.splice(i,1);saveDb(d);} return {success:true}; },
};