/**
 * Optimize settlements to minimize the number of transactions.
 * 
 * Algorithm:
 * 1. Compute net balance for each user (totalPaid - totalOwed)
 * 2. Separate into debtors (negative balance) and creditors (positive balance)
 * 3. Greedily match highest debtor with highest creditor
 * 4. Return minimal list of transfers
 * 
 * @param {Array} expenses - All expenses in the group
 * @param {Array} completedSettlements - Already completed settlements
 * @returns {Array} Optimized list of {from, to, amount}
 */
export function optimizeSettlements(expenses, completedSettlements = []) {
  const balances = {};

  // Calculate net balances from expenses
  for (const expense of expenses) {
    const payerId = expense.paidBy.toString();

    // Payer paid the full amount
    if (!balances[payerId]) balances[payerId] = 0;
    balances[payerId] += expense.amount;

    // Each person in the split owes their share
    for (const split of expense.splits) {
      const userId = split.user.toString();
      if (!balances[userId]) balances[userId] = 0;
      balances[userId] -= split.amount;
    }
  }

  // Adjust for already completed settlements
  for (const settlement of completedSettlements) {
    const fromId = settlement.fromUser.toString();
    const toId = settlement.toUser.toString();
    // fromUser paid toUser, so fromUser's debt decreases, toUser's credit decreases
    if (!balances[fromId]) balances[fromId] = 0;
    if (!balances[toId]) balances[toId] = 0;
    balances[fromId] += settlement.amount;
    balances[toId] -= settlement.amount;
  }

  // Separate into debtors and creditors
  const debtors = []; // owe money (negative balance)
  const creditors = []; // are owed money (positive balance)

  for (const [userId, balance] of Object.entries(balances)) {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded < -0.01) {
      debtors.push({ userId, amount: Math.abs(rounded) });
    } else if (rounded > 0.01) {
      creditors.push({ userId, amount: rounded });
    }
  }

  // Sort both by amount descending
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  // Greedily match
  const transfers = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const transferAmount = Math.min(debtors[i].amount, creditors[j].amount);
    const rounded = Math.round(transferAmount * 100) / 100;

    if (rounded > 0) {
      transfers.push({
        from: debtors[i].userId,
        to: creditors[j].userId,
        amount: rounded
      });
    }

    debtors[i].amount -= transferAmount;
    creditors[j].amount -= transferAmount;

    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return transfers;
}
