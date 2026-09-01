import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const statusMeta = (s) => {
  if (['failed', 'error'].includes(s)) return { Icon: XCircle, cls: 'text-red-500', label: 'Falhou' };
  if (['pending', 'running', 'in_progress'].includes(s)) return { Icon: Loader2, cls: 'text-orange-500', label: 'Executando', spin: true };
  return { Icon: CheckCircle2, cls: 'text-green-600', label: 'Concluído' };
};

function FunctionDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const s = statusMeta(toolCall.status);
  const Icon = s.Icon;
  let parsed;
  try { parsed = JSON.parse(toolCall.arguments_string); } catch { parsed = toolCall.arguments_string; }
  let result;
  try { result = typeof toolCall.results === 'string' ? JSON.parse(toolCall.results) : toolCall.results; } catch { result = toolCall.results; }
  return (
    <div className="mt-2 text-xs border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100">
        <Icon className={`w-3.5 h-3.5 ${s.cls} ${s.spin ? 'animate-spin' : ''}`} />
        <span className="font-semibold text-gray-700">{toolCall.name}</span>
        <span className={`ml-auto ${s.cls}`}>{s.label}</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      {expanded && (
        <div className="px-3 py-2 space-y-1 border-t border-gray-200">
          <div className="text-gray-500">Parâmetros:</div>
          <pre className="bg-white rounded p-2 overflow-x-auto text-[11px]">{JSON.stringify(parsed, null, 2)}</pre>
          <div className="text-gray-500">Resultado:</div>
          <pre className="bg-white rounded p-2 overflow-x-auto text-[11px]">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${isUser ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
        {message.content && (isUser
          ? <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          : <ReactMarkdown className="text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0">{message.content}</ReactMarkdown>)}
        {message.tool_calls?.map((tc, i) => <FunctionDisplay key={i} toolCall={tc} />)}
      </div>
    </div>
  );
}