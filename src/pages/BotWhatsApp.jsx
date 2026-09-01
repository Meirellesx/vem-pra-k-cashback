import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isMasterAccount } from '@/lib/internalAuth';
import MessageBubble from '@/components/bot/MessageBubble';
import { MessageCircle, Send, Plus, ArrowLeft, ShieldAlert, Loader2 } from 'lucide-react';

const AGENT_NAME = 'whatsapp_cashback_bot';

const unwrap = (res) => res?.data ?? res ?? [];

export default function BotWhatsApp() {
  const { user, internalUser } = useAuth();
  const isMaster = isMasterAccount(user);
  const role = isMaster ? internalUser?.role : user?.role;

  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null); // conversation object
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [sending, setSending] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);
  const scrollRef = useRef(null);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      setConversations(list);
    } catch {
      setConversations([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const openConversation = useCallback(async (conv) => {
    setSelected(conv);
    setMobileChat(true);
    setMessages([]);
    try {
      const full = unwrap(await base44.agents.getConversation(conv.id));
      setMessages(full?.messages ?? []);
    } catch { setMessages([]); }
  }, []);

  useEffect(() => {
    if (!selected?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(selected.id, (data) => {
      setMessages(data?.messages ?? []);
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [selected?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleNew = async () => {
    try {
      const conv = unwrap(await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: 'Nova conversa' },
      }));
      await loadConversations();
      if (conv?.id) {
        const found = (await base44.agents.listConversations({ agent_name: AGENT_NAME }));
        const list = Array.isArray(found) ? found : (Array.isArray(found?.data) ? found.data : []);
        const target = list.find((c) => c.id === conv.id) || list[0];
        if (target) openConversation(target);
      }
    } catch (e) { /* ignore */ }
  };

  const handleSend = async () => {
    if (!input.trim() || !selected || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      await base44.agents.addMessage(selected, { role: 'user', content: text });
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `❌ Erro ao enviar: ${e.message}` }]);
    } finally {
      setSending(false);
    }
  };

  if (!['admin', 'manager'].includes(role)) {
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <ShieldAlert className="w-12 h-12 text-orange-500 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-gray-900 mb-1">Acesso restrito</h1>
        <p className="text-gray-500 text-sm">Apenas administradores e gerentes podem acessar o painel do bot.</p>
      </div>
    );
  }

  const connectUrl = base44.agents.getWhatsAppConnectURL(AGENT_NAME);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-orange-500" /> Bot WhatsApp
        </h1>
        <p className="text-gray-500 text-sm mt-1">Atendimento de clientes e funcionários pelo WhatsApp.</p>
      </div>

      {/* Conectar o número da loja */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 mb-6 text-white shadow-lg shadow-orange-500/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black">Conectar o WhatsApp da loja</h2>
            <p className="text-white/80 text-sm mt-1 max-w-md">
              Conecte um número de WhatsApp para que clientes e funcionários conversem com o bot. Depois de conectado, compartilhe o link com a equipe.
            </p>
          </div>
          <a
            href={connectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white text-orange-600 font-bold px-5 py-3 rounded-xl shadow-md hover:bg-orange-50 transition-all flex-shrink-0"
          >
            <MessageCircle className="w-5 h-5" /> Conectar WhatsApp
          </a>
        </div>
      </div>

      {/* Painel de conversas */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 h-[600px]">
          {/* Lista */}
          <div className={`border-r border-gray-100 flex flex-col ${mobileChat ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <span className="font-bold text-sm text-gray-700">Conversas</span>
              <button onClick={handleNew} className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:bg-orange-50 px-2 py-1 rounded-lg">
                <Plus className="w-3.5 h-3.5" /> Nova
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingList ? (
                <div className="flex items-center justify-center h-24 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm px-4">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhuma conversa ainda. Conecte o WhatsApp e inicie um atendimento.
                </div>
              ) : (
                conversations.map((c) => {
                  const active = selected?.id === c.id;
                  const name = c.metadata?.name || 'Conversa';
                  return (
                    <button
                      key={c.id}
                      onClick={() => openConversation(c)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${active ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                    >
                      <div className="font-semibold text-sm text-gray-900 truncate">{name}</div>
                      <div className="text-xs text-gray-400 truncate">{c.id}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat */}
          <div className={`md:col-span-2 flex flex-col ${mobileChat ? 'flex' : 'hidden md:flex'}`}>
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Selecione uma conversa para começar.
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-gray-100 flex items-center gap-2">
                  <button onClick={() => setMobileChat(false)} className="md:hidden text-gray-500 hover:text-gray-700">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <span className="font-bold text-sm text-gray-700 truncate">
                    {selected.metadata?.name || 'Conversa'}
                  </span>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-10">Diga olá para o bot começar. 🎉</div>
                  ) : (
                    messages.map((m, i) => <MessageBubble key={i} message={m} />)
                  )}
                </div>
                <div className="p-3 border-t border-gray-100 flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Mensagem..."
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !input.trim()}
                    className="w-10 h-10 flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white rounded-xl disabled:opacity-50 transition-all"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}