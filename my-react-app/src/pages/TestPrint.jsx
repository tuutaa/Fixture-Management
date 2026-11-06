import { useState } from 'react';

export default function TestPrint() {
  const [text, setText] = useState('FIXTURE-001');
  const [size, setSize] = useState(150);
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;

  function print() {
    const w = window.open('');
    w.document.write(`<img src="${url}" /><p>${text}</p>`);
    w.print();
  }

  return (
    <div>
      <div className="header"><h1>Test Print (QR Sticker)</h1></div>
      <div className="search-panel-advanced">
        <div className="search-columns">
          <div className="search-col">
            <div className="search-field"><label>Text</label><input value={text} onChange={(e)=>setText(e.target.value)} /></div>
          </div>
          <div className="search-col">
            <div className="search-field"><label>Size</label><input type="number" value={size} onChange={(e)=>setSize(Number(e.target.value))} /></div>
          </div>
          <div className="search-col">
            <button className="btn-query" onClick={print}>Print</button>
          </div>
        </div>
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <img src={url} alt="qr" style={{ border: '1px solid #ddd' }} />
          <p>{text}</p>
        </div>
      </div>
    </div>
  );
}