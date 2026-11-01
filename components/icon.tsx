import {
  mdiAlertCircle, mdiBullhornOutline, mdiCartOutline, mdiCashMultiple, mdiCashRefund, mdiCheckCircle, mdiChevronLeft, mdiChevronRight,
  mdiCogOutline, mdiLockOutline, mdiLogout, mdiMagnify, mdiPackageVariantClosed, mdiReceiptTextOutline, mdiScaleBalance, mdiShopping,
  mdiStar, mdiTrendingDown, mdiTrendingUp, mdiViewDashboardOutline, mdiWeatherNight, mdiWhiteBalanceSunny,
} from '@mdi/js';

const PATHS = {
  'alert-circle': mdiAlertCircle, 'bullhorn-outline': mdiBullhornOutline, 'cart-outline': mdiCartOutline, 'cash-multiple': mdiCashMultiple,
  'cash-refund': mdiCashRefund, 'check-circle': mdiCheckCircle, 'chevron-left': mdiChevronLeft, 'chevron-right': mdiChevronRight,
  'cog-outline': mdiCogOutline, 'lock-outline': mdiLockOutline, logout: mdiLogout, magnify: mdiMagnify,
  'package-variant-closed': mdiPackageVariantClosed, 'receipt-text-outline': mdiReceiptTextOutline, 'scale-balance': mdiScaleBalance,
  shopping: mdiShopping, star: mdiStar, 'trending-down': mdiTrendingDown, 'trending-up': mdiTrendingUp,
  'view-dashboard-outline': mdiViewDashboardOutline, 'weather-night': mdiWeatherNight, 'white-balance-sunny': mdiWhiteBalanceSunny,
};

export type IconName = keyof typeof PATHS;

/** Inline SVG icon (Material Design Icons paths); sized by the surrounding font size. */
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`inline-block h-[1em] w-[1em] fill-current align-[-0.125em] ${className}`}>
      <path d={PATHS[name]} />
    </svg>
  );
}
