"use client";

import { icons, HelpCircle, type LucideProps } from "lucide-react";

// Gera um tipo seguro com todos os nomes de ícones disponíveis
export type IconName = keyof typeof icons;

// Define as propriedades do nosso componente
interface LucideIconProps extends LucideProps {
  name: IconName;
}

export function LucideIcon({ name, ...props }: LucideIconProps) {
  // Pega o componente do ícone pelo nome
  const IconComponent = icons[name];

  // Se o nome do ícone for inválido, usa o ícone HelpCircle que importamos diretamente
  if (!IconComponent) {
    return <HelpCircle {...props} />;
  }

  // Renderiza o ícone correto
  return <IconComponent {...props} />;
}

export default LucideIcon;