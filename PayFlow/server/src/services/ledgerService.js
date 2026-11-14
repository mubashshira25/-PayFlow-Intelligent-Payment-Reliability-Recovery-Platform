import LedgerEntry from "../models/LedgerEntry.js";

export async function postJournal({ journalId, merchantId, paymentId, amount, currency, debitAccount, creditAccount, memo }, session) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Ledger amount must be a positive integer");
  if (debitAccount === creditAccount) throw new Error("Debit and credit accounts must differ");

  const entries = [
    { journalId, merchantId, paymentId, account: debitAccount, side: "DEBIT", amount, currency, memo },
    { journalId, merchantId, paymentId, account: creditAccount, side: "CREDIT", amount, currency, memo }
  ];

  const debit = entries.filter(x => x.side === "DEBIT").reduce((s, x) => s + x.amount, 0);
  const credit = entries.filter(x => x.side === "CREDIT").reduce((s, x) => s + x.amount, 0);
  if (debit !== credit) throw new Error("Unbalanced journal rejected");

  await LedgerEntry.create(entries, { session });
}
