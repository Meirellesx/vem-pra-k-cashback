import React, { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency } from '@/lib/cashbackUtils';
import { Search, QrCode, X, Camera, AlertTriangle, Loader2 } from 'lucide-react';

export default function QuickCustomerSearch({ onSelect }) {
  const [code, setCode] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const detectorRef = useRef(null);

  // Locate customers whose identifier_code matches the typed/scanned value.
  const lookupByCode = useCallback(async (rawCode) => {
    const value = (rawCode || '').trim().toUpperCase();
    if (!value) { setResults([]); setNotFound(false); return; }
    setSearching(true);
    setNotFound(false);
    try {
      const all = await base44.entities.Customer.list('-created_date', 200);
      const matches = all.filter(
        c => c.is_active !== false && !c.is_demo && c.identifier_code &&
          c.identifier_code.toUpperCase().includes(value)
      );
      const exact = matches.find(c => c.identifier_code.toUpperCase() === value);
      if (exact) {
        // Exact match — go straight to the sale for fastest checkout
        setResults([]);
        setCode(exact.identifier_code);
        onSelect(exact);
      } else if (matches.length > 0) {
        setResults(matches.slice(0, 5));
      } else {
        setResults([]);
        setNotFound(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  }, [onSelect]);

  // Debounced lookup while the cashier types the code
  useEffect(() => {
    const t = setTimeout(() => { if (code) lookupByCode(code); }, 350);
    return () => clearTimeout(t);
  }, [code, lookupByCode]);

  const handleSubmit = (e) => { e.preventDefault(); lookupByCode(code); };

  // ---- QR scanning via the native BarcodeDetector API ----
  const stopScan = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    detectorRef.current = null;
    setScanning(false);
  }, []);

  const startScan = useCallback(async () => {
    setScanError('');
    setScanning(true);
    try {
      if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
        throw new Error('Leitura de QR não é suportada neste dispositivo/navegador.');
      }
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      detectorRef.current = detector;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const tick = async () => {
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length > 0) {
            const raw = codes[0].rawValue || '';
            stopScan();
            setCode(raw);
            lookupByCode(raw);
            return;
          }
        } catch (err) { /* ignore per-frame errors */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setScanError(e.message || 'Não foi possível acessar a câmera.');
      setScanning(false);
    }
  }, [lookupByCode, stopScan]);

  // Release the camera when the component unmounts
  useEffect(() => () => stopScan(), [stopScan]);

  return (
    <div className="mb-4">
      <form onSubmit={handleSubmit} className="bg-[#0A0A0A] rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <QrCode className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-bold text-orange-400 uppercase tracking-wide">Busca rápida</span>
          {searching && <Loader2 className="w-3 h-3 text-orange-400 animate-spin ml-auto" />}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Digite o código do cliente..."
              className="w-full pl-10 pr-4 py-3 bg-white/10 text-white placeholder-gray-500 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-mono uppercase tracking-wider"
            />
          </div>
          <button type="button" onClick={startScan}
            className="flex items-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm whitespace-nowrap">
            <Camera className="w-4 h-4" /> Escanear
          </button>
        </div>
        {notFound && (
          <p className="text-xs text-red-300 mt-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Nenhum cliente encontrado com este código.
          </p>
        )}
      </form>

      {results.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden mt-2 bg-white">
          {results.map(c => (
            <button key={c.id} type="button"
              onClick={() => { setResults([]); setCode(c.identifier_code); onSelect(c); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 text-left border-b border-gray-100 last:border-0 transition-colors">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">
                {c.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">{c.name}</div>
                <div className="text-xs text-gray-400 font-mono">{c.identifier_code}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-green-600 font-bold">{formatCurrency(c.available_balance)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {scanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-bold">Escanear QR Code</span>
              <button type="button" onClick={stopScan} className="text-white p-1"><X className="w-6 h-6" /></button>
            </div>
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-900">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }}>
                <div className="absolute" style={{ top: '20%', left: '20%', right: '20%', bottom: '20%', border: '3px solid #FF6B00', borderRadius: '1rem' }} />
              </div>
            </div>
            {scanError ? (
              <p className="text-red-400 text-sm text-center mt-3 flex items-center justify-center gap-1">
                <AlertTriangle className="w-4 h-4" /> {scanError}
              </p>
            ) : (
              <p className="text-gray-400 text-xs text-center mt-3">Aponte a câmera para o QR Code do cliente</p>
            )}
            <button type="button" onClick={stopScan}
              className="w-full mt-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl">
              {scanError ? 'Fechar' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}