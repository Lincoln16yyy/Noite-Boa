import type { ComponentType } from 'react';
import {
  type IconProps,
  BarChartIcon,
  GearIcon,
  ListIcon,
  MoonIcon,
  PlusIcon,
  StarIcon,
  UsersIcon,
} from '../components/ui/icons';

/**
 * Itens de navegação do app logado (issues #209 e #217).
 *
 * Fonte única para o desktop e o celular: a barra inferior (celular) e o menu
 * superior (desktop) usam os mesmos rótulos e os mesmos ícones de traço, então
 * as duas navegações não podem divergir por acaso.
 */
export interface NavItem {
  path: string;
  label: string;
  Icone: ComponentType<IconProps>;
}

/**
 * Abas principais, em ordem. No celular são as 5 abas da barra inferior; no
 * desktop aparecem primeiro no menu do cabeçalho (issue #217).
 */
export const NAV_PRINCIPAL: NavItem[] = [
  { path: '/hoje', label: 'Hoje', Icone: MoonIcon },
  { path: '/registrar', label: 'Registrar', Icone: PlusIcon },
  { path: '/historico', label: 'Histórico', Icone: ListIcon },
  { path: '/dashboard', label: 'Dashboard', Icone: BarChartIcon },
  { path: '/amigos', label: 'Amigos', Icone: UsersIcon },
];

/**
 * Itens secundários: no celular ficam dentro do menu "Mais" da barra
 * inferior; no desktop são links diretos no cabeçalho (issue #217).
 */
export const NAV_SECUNDARIA: NavItem[] = [
  { path: '/sons', label: 'Sons', Icone: StarIcon },
  { path: '/configuracoes', label: 'Configurações', Icone: GearIcon },
];
