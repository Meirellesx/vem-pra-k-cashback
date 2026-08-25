export const LOGO_URL = "https://media.base44.com/files/public/user_68df03321ddb88e340d96028/9df156de3_Logo.pdf";

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

export const DEFAULT_SETTINGS = {
  cashback_percentage: 5,
  min_purchase_to_use: 50,
  max_cashback_payment_percentage: 50,
  release_days: 0,
  balance_validity_days: 365,
  is_active: true,
  program_name: "Vem Pra K Cashback",
};