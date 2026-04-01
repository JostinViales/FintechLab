import React from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppContext } from '../../App';
import { TransactionList } from '../../components/transactions/TransactionList';

export const TransactionsPage: React.FC = () => {
  const { transactions, accounts, openTransactionModal, handleDeleteTransaction } =
    useOutletContext<AppContext>();

  return (
    <TransactionList
      transactions={transactions}
      accounts={accounts}
      onEdit={openTransactionModal}
      onDelete={handleDeleteTransaction}
    />
  );
};
