export function getBalancedMobileGridClass(
  count: number,
  extraClasses = ''
): string {
  const base =
    count <= 1
      ? 'grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center'
      : 'grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center';
  return extraClasses ? `${base} ${extraClasses}` : base;
}

export function getBalancedMobileItemSpan(
  index: number,
  count: number
): string {
  if (count > 1 && count % 2 === 1 && index === count - 1) {
    return 'col-span-2 sm:col-span-1';
  }
  return '';
}
