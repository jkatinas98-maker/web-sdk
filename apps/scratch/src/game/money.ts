import { stateBet } from 'state-shared';
import { numberToCurrencyString } from 'utils-shared/amount';

// Every amount shown to the player goes through here, so it follows the
// currency Stake sends (USD, EUR, BTC, Stake.us coins GC/SC, ...) instead
// of a hard-coded "$". Falls back to plain "$" formatting if the i18n
// formatter isn't ready yet (e.g. during the very first render).
export const money = (value: number): string => {
	try {
		void stateBet.currency; // keep templates reactive to currency changes
		return numberToCurrencyString(value);
	} catch {
		return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
};
