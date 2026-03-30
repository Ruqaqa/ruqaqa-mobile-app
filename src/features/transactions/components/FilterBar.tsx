import React from 'react';
import { useTranslation } from 'react-i18next';
import { FilterBar as SharedFilterBar } from '@/components/finance/FilterBar';

interface TransactionFilterBarProps {
  showOwn: boolean;
  onShowOwnChange: (value: boolean) => void;
  canViewAll: boolean;
  hasActiveFilters: boolean;
  onSearchPress: () => void;
  onClearFilters: () => void;
}

export const FilterBar = React.memo(function FilterBar(props: TransactionFilterBarProps) {
  const { t } = useTranslation();
  return (
    <SharedFilterBar
      {...props}
      ownLabel={t('myTransactions')}
      allLabel={t('allTransactions')}
    />
  );
});
