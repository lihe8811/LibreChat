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
  shoes: FootprintsIcon,
  decoration: PaletteIcon,
  underwear: UnderlineIcon,
  garment: ShirtIcon,
  scarf: WormIcon,
  others: BlocksIcon,
  kitchen: CookingPotIcon,
  accessories: GemIcon,
  kids: BabyIcon,
};

const categoryColorMap: Record<string, string> = {
  kitchen: 'text-red-500',
  shoes: 'text-blue-300',
  scarf: 'text-purple-400',
  garment: 'text-yellow-500/90 dark:text-yellow-300 ',
  underwear: 'text-purple-400',
  accessories: 'text-yellow-500/90 dark:text-yellow-300 ',
  others: 'text-orange-400',
  decoration: 'text-orange-400',
  kids: 'text-blue-300',
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
