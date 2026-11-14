import React, { useEffect, useMemo, useState } from "react";
import { api, getApiKey, saveApiKey } from "./api.js";

const money = (minor, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency }).format((minor || 0) / 100);

export default function App() {
  const [key, setKey] = useState(getApiKey());
  const [connected, setConnected] = useState(false);
  const [payments, setPayments] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("12500");
  const [description, setDescription] = useState("Demo purchase");
  const [customerReference, setCustomerReference] = useState("customer-demo-001");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("payments");

  async function refresh() {
    const [p, l, w] = await Promise.all([
      api("/payments"), api("/ledger"), api("/webhook-deliveries")
    ]);
    setPayments(p); setLedger(l); setWebhooks(w); setConnected(true);
  }

  useEffect(() => {
    if (key) refresh().catch(e => { setConnected(false); setNotice(e.message); });
  }, []);

  async function connect(e) {
    e.preventDefault();
    saveApiKey(key);
    try { await refresh(); setNotice("Connected to PayFlow API."); }
    catch (e) { setConnected(false); setNotice(e.message); }
  }

  async function createPayment(e) {
    e.preventDefault(); setBusy(true); setNotice("");
    try {
      const result = await api("/payments", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          amount: Number(amount), currency: "INR", description, customerReference
        })
      });
      setNotice(`Payment created: ${result.payment._id}`);
      await refresh();
    } catch (e) { setNotice(e.message); }
    finally { setBusy(false); }
  }

  async function action(id, actionName) {
    setBusy(true); setNotice("");
    try {
      const result = await api(`/payments/${id}/${actionName}`, { method: "POST", body: "{}" });
      setNotice(`${actionName} successful. Status: ${result.payment.status}`);
      await refresh();
      if (selected?._id === id) await inspect(result.payment);
    } catch (e) { setNotice(e.message); }
    finally { setBusy(false); }
  }

  async function inspect(payment) {
    setSelected(payment);
    try { setEvents(await api(`/payments/${payment._id}/events`)); }
    catch (e) { setNotice(e.message); }
  }

  const totals = useMemo(() => ({
    count: payments.length,
    captured: payments.filter(p => p.status === "CAPTURED").length,
    pending: payments.filter(p => ["CREATED", "AUTHORIZED"].includes(p.status)).length,
    volume: payments.filter(p => p.status === "CAPTURED").reduce((sum, p) => sum + p.capturedAmount, 0)
  }), [payments]);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-mark">P</div><h2>PayFlow</h2><p>Merchant console</p>
      <nav>
        {["payments", "ledger", "webhooks"].map(item =>
          <button key={item} className={tab === item ? "nav active" : "nav"} onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        )}
      </nav>
      <div className="side-note"><span className="dot"/> Sandbox simulator</div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div><span className="eyebrow">PAYMENT OPERATIONS</span><h1>Overview</h1></div>
        <span className={connected ? "connection online" : "connection"}>{connected ? "API connected" : "Not connected"}</span>
      </header>

      <section className="connect panel">
        <form onSubmit={connect}>
          <label>Merchant API key
            <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Paste key printed by npm run seed" required/>
          </label>
          <button>Connect</button>
        </form>
        <small>The demo API key is stored only in this browser session.</small>
      </section>

      {notice && <div className="notice">{notice}</div>}

      <section className="metrics">
        <Metric label="Transactions" value={totals.count}/>
        <Metric label="Captured" value={totals.captured}/>
        <Metric label="Pending" value={totals.pending}/>
        <Metric label="Captured volume" value={money(totals.volume)}/>
      </section>

      {tab === "payments" && <>
        <section className="panel">
          <div className="section-title"><div><span className="eyebrow">CHECKOUT SIMULATOR</span><h2>Create payment</h2></div></div>
          <form className="payment-form" onSubmit={createPayment}>
            <label>Amount (paise)<input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} required/></label>
            <label>Description<input value={description} onChange={e => setDescription(e.target.value)} maxLength="240"/></label>
            <label>Customer reference<input value={customerReference} onChange={e => setCustomerReference(e.target.value)} maxLength="120"/></label>
            <button disabled={busy || !connected}>Create payment</button>
          </form>
          <small>Example: 12500 paise = ₹125.00. This creates a simulated transaction only.</small>
        </section>
        <section className="panel">
          <div className="section-title"><div><span className="eyebrow">MERCHANT ACTIVITY</span><h2>Recent payments</h2></div><button className="button-light" onClick={() => refresh().catch(e => setNotice(e.message))}>Refresh</button></div>
          <div className="table-wrap"><table><thead><tr><th>Payment</th><th>Amount</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>{payments.map(p => <tr key={p._id}>
            <td><button className="text-button" onClick={() => inspect(p)}>{p._id.slice(-10)}</button></td>
            <td>{money(p.amount, p.currency)}</td><td><Status value={p.status}/></td>
            <td>{new Date(p.createdAt).toLocaleString()}</td>
            <td className="actions">
              {p.status === "CREATED" && <button onClick={() => action(p._id, "authorize")} disabled={busy}>Authorize</button>}
              {p.status === "AUTHORIZED" && <button onClick={() => action(p._id, "capture")} disabled={busy}>Capture</button>}
              {p.status === "CAPTURED" && <button className="button-light" onClick={() => action(p._id, "refund")} disabled={busy}>Refund</button>}
            </td>
          </tr>)}</tbody></table>{!payments.length && <Empty text="No payments yet. Create your first simulated payment."/>}</div>
        </section>
        {selected && <section className="panel">
          <div className="section-title"><h2>Payment timeline · {selected._id.slice(-10)}</h2><button className="button-light" onClick={() => setSelected(null)}>Close</button></div>
          {events.map(ev => <div className="timeline" key={ev._id}><b>{ev.type}</b><span>{ev.fromStatus || "—"} → {ev.toStatus || "—"}</span><small>{new Date(ev.createdAt).toLocaleString()}</small></div>)}
        </section>}
      </>}

      {tab === "ledger" && <section className="panel"><h2>Double-entry ledger</h2><div className="table-wrap"><table><thead><tr><th>Journal</th><th>Payment</th><th>Account</th><th>Side</th><th>Amount</th><th>Time</th></tr></thead><tbody>
        {ledger.map(x => <tr key={x._id}><td className="mono">{x.journalId}</td><td>{String(x.paymentId).slice(-8)}</td><td>{x.account}</td><td>{x.side}</td><td>{money(x.amount, x.currency)}</td><td>{new Date(x.createdAt).toLocaleString()}</td></tr>)}
      </tbody></table>{!ledger.length && <Empty text="Ledger entries appear after a payment is captured or refunded."/>}</div></section>}

      {tab === "webhooks" && <section className="panel"><h2>Webhook delivery attempts</h2><div className="table-wrap"><table><thead><tr><th>Event ID</th><th>Payment</th><th>Status</th><th>Attempts</th><th>Created</th></tr></thead><tbody>
        {webhooks.map(w => <tr key={w._id}><td className="mono">{w.eventId.slice(0, 12)}</td><td>{String(w.paymentId).slice(-8)}</td><td><Status value={w.status}/></td><td>{w.attempts}</td><td>{new Date(w.createdAt).toLocaleString()}</td></tr>)}
      </tbody></table>{!webhooks.length && <Empty text="Webhook delivery records will appear after payment events."/>}</div></section>}

      <footer>Educational payment simulator · No real money or card data is processed.</footer>
    </main>
  </div>;
}

function Metric({ label, value }) { return <article className="metric"><small>{label}</small><strong>{value}</strong></article>; }
function Status({ value }) { return <span className={`status ${String(value).toLowerCase()}`}>{value}</span>; }
function Empty({ text }) { return <p className="empty">{text}</p>; }
