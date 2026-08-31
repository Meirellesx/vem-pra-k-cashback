export const LOGO_URL = "https://media.base44.com/files/public/user_68df03321ddb88e340d96028/9df156de3_Logo.pdf";

// Conta Base44 "mestra": logada nos aparelhos compartilhados da loja.
// Quem opera nela é identificado pelo login interno (usuário + senha).
export const MASTER_STAFF_EMAIL = "vendas.wilmaflor@gmail.com";

export const BRAND = {
  orange: "#FF6B00",
  orangeLight: "#FF8C33",
  orangeDark: "#CC5500",
  black: "#0A0A0A",
  blackSoft: "#1A1A1A",
};

export const CASHBACK_STATUS = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800 border border-yellow-300" },
  disponivel: { label: "Disponível", color: "bg-green-100 text-green-800 border border-green-300" },
  usado: { label: "Usado", color: "bg-blue-100 text-blue-800 border border-blue-300" },
  expirado: { label: "Expirado", color: "bg-gray-100 text-gray-600 border border-gray-300" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700 border border-red-300" },
};

export const TRANSACTION_TYPE = {
  gerado: { label: "Gerado", icon: "Plus", color: "text-green-600" },
  liberado: { label: "Liberado", icon: "Unlock", color: "text-blue-600" },
  utilizado: { label: "Utilizado", icon: "ShoppingCart", color: "text-orange-600" },
  expirado: { label: "Expirado", icon: "Clock", color: "text-gray-500" },
  cancelado: { label: "Cancelado", icon: "X", color: "text-red-600" },
  ajuste_manual: { label: "Ajuste Manual", icon: "Edit", color: "text-purple-600" },
};

export const PAYMENT_METHODS = {
  dinheiro: "Dinheiro",
  cartao_debito: "Cartão de Débito",
  cartao_credito: "Cartão de Crédito",
  pix: "PIX",
  misto: "Misto",
};

export const USER_ROLES = {
  admin: "Administrador",
  operador: "Operador de Caixa",
  cliente: "Cliente",
};

export const STAFF_ROLES = {
  admin: "Administrador",
  manager: "Gerente",
  cashier: "Operador de Caixa",
  viewer: "Consulta",
  operador: "Operador de Caixa",
  cliente: "Cliente",
  user: "Cliente",
};

export const USER_STATUS = {
  active: { label: "Ativo", color: "bg-green-100 text-green-800 border border-green-300" },
  blocked: { label: "Bloqueado", color: "bg-red-100 text-red-700 border border-red-300" },
  pending: { label: "Pendente de ativação", color: "bg-yellow-100 text-yellow-800 border border-yellow-300" },
};

export const STAFF_ROLE_PERMISSIONS = {
  admin: {
    label: "Administrador",
    description: "Acesso completo ao sistema",
    permissions: [
      "Gerenciar usuários e funcionários",
      "Alterar configurações do cashback",
      "Consultar e exportar relatórios",
      "Fazer ajustes manuais com justificativa",
      "Consultar auditoria",
      "Gerenciar clientes, vendas e movimentações",
    ],
  },
  manager: {
    label: "Gerente",
    description: "Supervisão com permissões limitadas",
    permissions: [
      "Consultar clientes, vendas, cashback e relatórios",
      "Registrar cancelamentos e estornos",
      "Fazer ajustes limitados com justificativa",
      "Consultar auditoria",
    ],
    restrictions: [
      "Não pode criar ou excluir administradores",
      "Não pode alterar configurações críticas sem autorização",
    ],
  },
  cashier: {
    label: "Operador de Caixa",
    description: "Operação de caixa do dia a dia",
    permissions: [
      "Localizar e cadastrar clientes",
      "Registrar vendas",
      "Consultar saldo de cashback",
      "Registrar utilização do cashback",
      "Consultar extrato do cliente",
    ],
    restrictions: [
      "Não pode alterar regras do programa",
      "Não pode acessar dados financeiros gerais",
      "Não pode excluir vendas ou movimentações",
      "Não pode criar outros usuários",
    ],
  },
  viewer: {
    label: "Consulta",
    description: "Somente leitura",
    permissions: [
      "Visualizar clientes, vendas e relatórios",
      "Consultar indicadores autorizados",
    ],
    restrictions: [
      "Não pode registrar, alterar, cancelar ou excluir informações",
    ],
  },
};

export const DEFAULT_SETTINGS = {
  cashback_percentage: 5,
  min_purchase_to_use: 50,
  max_cashback_payment_percentage: 50,
  release_days: 0,
  balance_validity_days: 365,
  is_active: true,
  program_name: "Vem Pra K Cashback",
};