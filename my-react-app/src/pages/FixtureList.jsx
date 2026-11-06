import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function FixtureList() {
  const [tab, setTab] = useState('models');
  const [models, setModels] = useState([]);
  const [storageList, setStorages] = useState([]);
  const [lines, setLines] = useState([]);
  const [bases, setBases] = useState([]);
  const [newModel, setNewModel] = useState({ Model: '', Description: '' });
  const [newStorage, setNewStorage] = useState({ StorageLocation: '', Description: '' });
  const [newLine, setNewLine] = useState({ Line: '', Description: '' });
  const [editingModel, setEditingModel] = useState(null);
  const [listText, setListText] = useState('[]');

  async function refresh() {
    const [m, s, l, b] = await Promise.all([api.getModels(), api.getStorages(), api.getLines(), api.getFixtureBases()]);
    setModels(m); setStorages(s); setLines(l); setBases(b);
  }
  useEffect(() => { refresh(); }, []);

  async function addModel(e) {
    e.preventDefault();
    await api.createModel(newModel);
    setNewModel({ Model: '', Description: '' });
    refresh();
  }
  async function addStorage(e) {
    e.preventDefault();
    await api.createStorage(newStorage);
    setNewStorage({ StorageLocation: '', Description: '' });
    refresh();
  }
  async function addLine(e) {
    e.preventDefault();
    await api.createLine(newLine);
    setNewLine({ Line: '', Description: '' });
    refresh();
  }

  function editModel(m) {
    setEditingModel(m);
    setListText(JSON.stringify(m.FixtureList || [], null, 2));
  }
  async function saveList() {
    try {
      const list = JSON.parse(listText);
      await api.updateModelList(editingModel._id, list);
      setEditingModel(null);
      refresh();
    } catch (e) { alert('JSON ไม่ถูกต้อง'); }
  }

  return (
    <div>
      <div className="header"><h1>Fixture List / Catalogs</h1></div>
      <div className="action-buttons" style={{ marginBottom: 12 }}>
        <button className={tab === 'models' ? 'btn-query' : 'btn-reset'} onClick={() => setTab('models')}>Models</button>
        <button className={tab === 'storages' ? 'btn-query' : 'btn-reset'} onClick={() => setTab('storages')}>Storages</button>
        <button className={tab === 'lines' ? 'btn-query' : 'btn-reset'} onClick={() => setTab('lines')}>Lines</button>
        <button className={tab === 'bases' ? 'btn-query' : 'btn-reset'} onClick={() => setTab('bases')}>Bases</button>
      </div>

      {tab === 'models' && (
        <div className="data-container">
          <form onSubmit={addModel} className="search-columns">
            <div className="search-col"><input placeholder="Model" value={newModel.Model} onChange={(e)=>setNewModel({...newModel,Model:e.target.value})} required /></div>
            <div className="search-col"><input placeholder="Description" value={newModel.Description} onChange={(e)=>setNewModel({...newModel,Description:e.target.value})} /></div>
            <div className="search-col"><button type="submit" className="btn-query">Add Model</button></div>
          </form>
          <table>
            <thead><tr><th>Model</th><th>Description</th><th>FixtureList Count</th><th>Actions</th></tr></thead>
            <tbody>
              {models.map((m) => (
                <tr key={m._id}><td>{m.Model}</td><td>{m.Description}</td><td>{m.FixtureList?.length || 0}</td>
                  <td style={{ display:'flex',gap:6 }}>
                    <button className="btn-browse" onClick={()=>editModel(m)}>Edit List</button>
                    <button className="btn-reset" onClick={async()=>{await api.deleteModel(m._id);refresh();}}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {editingModel && (
            <div className="search-panel-advanced" style={{ marginTop: 12 }}>
              <h3>Edit FixtureList: {editingModel.Model}</h3>
              <textarea value={listText} onChange={(e)=>setListText(e.target.value)} rows={12} style={{ width:'100%' }} />
              <div className="action-buttons" style={{ marginTop: 8 }}>
                <button className="btn-query" onClick={saveList}>Save</button>
                <button className="btn-reset" onClick={()=>setEditingModel(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'storages' && (
        <div className="data-container">
          <form onSubmit={addStorage} className="search-columns">
            <div className="search-col"><input placeholder="StorageLocation" value={newStorage.StorageLocation} onChange={(e)=>setNewStorage({...newStorage,StorageLocation:e.target.value})} required /></div>
            <div className="search-col"><input placeholder="Description" value={newStorage.Description} onChange={(e)=>setNewStorage({...newStorage,Description:e.target.value})} /></div>
            <div className="search-col"><button type="submit" className="btn-query">Add Storage</button></div>
          </form>
          <table>
            <thead><tr><th>StorageLocation</th><th>Description</th><th>Actions</th></tr></thead>
            <tbody>
              {storageList.map((s) => (
                <tr key={s._id}><td>{s.StorageLocation}</td><td>{s.Description}</td>
                  <td><button className="btn-reset" onClick={async()=>{await api.deleteStorage(s._id);refresh();}}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'lines' && (
        <div className="data-container">
          <form onSubmit={addLine} className="search-columns">
            <div className="search-col"><input placeholder="Line" value={newLine.Line} onChange={(e)=>setNewLine({...newLine,Line:e.target.value})} required /></div>
            <div className="search-col"><input placeholder="Description" value={newLine.Description} onChange={(e)=>setNewLine({...newLine,Description:e.target.value})} /></div>
            <div className="search-col"><button type="submit" className="btn-query">Add Line</button></div>
          </form>
          <table>
            <thead><tr><th>Line</th><th>Description</th><th>Actions</th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l._id}><td>{l.Line}</td><td>{l.Description}</td>
                  <td><button className="btn-reset" onClick={async()=>{await api.deleteLine(l._id);refresh();}}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'bases' && (
        <div className="data-container">
          <table>
            <thead><tr><th>SN</th><th>Name</th><th>Location</th><th>ImagePath</th></tr></thead>
            <tbody>
              {bases.map((b) => (
                <tr key={b._id}><td>{b.SN}</td><td>{b.Name}</td><td>{b.Location}</td><td>{b.ImagePath ? 'has image' : '-'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}