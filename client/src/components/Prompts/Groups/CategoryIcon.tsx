import React from 'react';
import {
  PaletteIcon,
  UnderlineIcon,
  ShirtIcon,
  CookingPotIcon,
  WormIcon,
  GemIcon,
  BabyIcon,
  BlocksIcon,
  FootprintsIcon,
} from 'lucide-react';
import { cn } from '~/utils';

const categoryIconMap: Record<string, React.ElementType> = {
  misc: FootprintsIcon,
  roleplay: PaletteIcon,
  write: UnderlineIcon,
  idea: ShirtIcon,
  shop: WormIcon,
  finance: BlocksIcon,
  code: CookingPotIcon,
  travel: GemIcon,
  teach_or_explain: BabyIcon,
};

const categoryColorMap: Record<string, string> = {
  code: 'text-red-500',
  misc: 'text-blue-300',
  shop: 'text-purple-400',
  idea: 'text-yellow-500/90 dark:text-yellow-300 ',
  write: 'text-purple-400',
  travel: 'text-yellow-500/90 dark:text-yellow-300 ',
  finance: 'text-orange-400',
  roleplay: 'text-orange-400',
  teach_or_explain: 'text-blue-300',
};

export default function CategoryIcon({
  category,
  className = '',
}: {
  category: string;
  className?: string;
}) {
  const IconComponent = categoryIconMap[category];
  const colorClass = categoryColorMap[category] + ' ' + className;
  if (!IconComponent) {
    return null;
  }
  return <IconComponent className={cn(colorClass, className)} aria-hidden="true" />;
}
