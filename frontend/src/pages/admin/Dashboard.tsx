import { useEffect, useMemo, useState } from 'react';
import { ApiError, formatPrice, statsApi, type Stats } from '../../api';
import { BarChart } from '../../components/charts/BarChart';
import { HBars } from '../../components/charts/HBars';
import { StatTile } from '../../components/charts/StatTile';
import { Icon } from '../../components/Icon';
import { navigate } from '../../router';
import { RangePicker, defaultRange, type Range } from './RangePicker';
import { fullDay, shortDay } from './dateRange';

const delta = (now: number, before: number) => (before > 0 ? (now - before) / before : null);
const dh = (v: number) => formatPrice(v);

export function Dashboard() {
  const [range, setRange] = useState<Range>(defaultRange);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bestBy, setBestBy] = useState<'quantity' | 'revenue'>('quantity');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    statsApi
      .summary(range.from, range.to)
      .then((s) => !cancelled && setStats(s))
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : 'Erreur réseau'));
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const t = stats?.totals;
  const p = stats?.previous;

  const dayData = useMemo(
    () =>
      (stats?.byDay ?? []).map((d) => ({
        label: shortDay(d.day),
        title: fullDay(d.day),
        value: d.revenue,
        detail: `${d.orders} commande${d.orders > 1 ? 's' : ''}`,
      })),
    [stats],
  );

  const hourData = useMemo(
    () =>
      (stats?.byHour ?? [])
        .filter((h) => h.hour >= 6 || h.revenue > 0) // cafés rarely sell at 3 am; keep it if they did
        .map((h) => ({
          label: `${h.hour}h`,
          title: `${h.hour}h – ${h.hour + 1}h`,
          value: h.revenue,
          detail: `${h.orders} commande${h.orders > 1 ? 's' : ''}`,
        })),
    [stats],
  );

  const best = useMemo(() => {
    const list = bestBy === 'quantity' ? stats?.bestSellers.byQuantity : stats?.bestSellers.byRevenue;
    return (list ?? []).map((x) =>
      bestBy === 'quantity'
        ? { label: x.name, value: x.quantity, sub: dh(x.revenue) }
        : { label: x.name, value: x.revenue, sub: `${x.quantity} vendus` },
    );
  }, [stats, bestBy]);

  const cats = useMemo(
    () => (stats?.byCategory ?? []).map((c) => ({ label: c.name, value: c.revenue, sub: `${c.quantity} articles` })),
    [stats],
  );

  const paid = (t?.cash ?? 0) + (t?.card ?? 0);
  const cashPct = paid ? (t!.cash / paid) * 100 : 0;

  return (
    <div className="dashboard">
      <div className="dash-head">
        <div>
          <h2 className="page-title">Tableau de bord</h2>
          {stats && (
            <div className="muted">
              {stats.range.days === 1 ? fullDay(stats.range.from) : `${fullDay(stats.range.from)} → ${fullDay(stats.range.to)}`}
            </div>
          )}
        </div>
        <RangePicker value={range} onChange={setRange} />
      </div>

      {error && <div className="error">{error}</div>}

      <div className="stat-row">
        <StatTile label="Chiffre d'affaires" value={dh(t?.revenue ?? 0)} delta={t && p ? delta(t.revenue, p.revenue) : null} hint="Commandes encaissées" />
        <StatTile label="Commandes" value={String(t?.orders ?? 0)} delta={t && p ? delta(t.orders, p.orders) : null} hint="Encaissées sur la période" />
        <StatTile label="Ticket moyen" value={dh(t?.averageTicket ?? 0)} delta={t && p ? delta(t.averageTicket, p.averageTicket) : null} hint="CA ÷ commandes" />
        <StatTile label="Articles vendus" value={String(t?.items ?? 0)} delta={t && p ? delta(t.items, p.items) : null} hint="Toutes catégories" />
      </div>

      <div className="dash-grid">
        <section className="card span-2">
          <div className="card-head">
            <h3>Chiffre d'affaires par jour</h3>
            <span className="muted">{dh(t?.revenue ?? 0)} au total</span>
          </div>
          {stats?.range.days === 1 ? (
            <p className="chart-empty">Sélectionnez plusieurs jours pour voir l'évolution. Les heures de la journée sont ci-dessous.</p>
          ) : (
            <BarChart data={dayData} format={dh} height={220} />
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Encaissements</h3>
          </div>
          <div className="split-bar" role="img" aria-label={`Espèces ${cashPct.toFixed(0)} %, carte ${(100 - cashPct).toFixed(0)} %`}>
            {paid > 0 ? (
              <>
                <div className="split-seg is-cash" style={{ width: `${cashPct}%` }} />
                <div className="split-seg is-card" style={{ width: `${100 - cashPct}%` }} />
              </>
            ) : (
              <div className="split-seg is-empty" />
            )}
          </div>
          <ul className="legend">
            <li>
              <span className="swatch is-cash" /> Espèces
              <b>{dh(t?.cash ?? 0)}</b>
              <span className="muted">{paid ? `${cashPct.toFixed(0)} %` : '—'}</span>
            </li>
            <li>
              <span className="swatch is-card" /> Carte
              <b>{dh(t?.card ?? 0)}</b>
              <span className="muted">{paid ? `${(100 - cashPct).toFixed(0)} %` : '—'}</span>
            </li>
          </ul>
          <dl className="facts">
            <div>
              <dt>Sur place</dt>
              <dd>{t?.dineIn ?? 0}</dd>
            </div>
            <div>
              <dt>À emporter</dt>
              <dd>{t?.takeaway ?? 0}</dd>
            </div>
            <div>
              <dt>Remises accordées</dt>
              <dd>{dh(t?.discounts ?? 0)}</dd>
            </div>
            <div>
              <dt>Commandes annulées</dt>
              <dd>{t?.cancelled ?? 0}</dd>
            </div>
          </dl>
        </section>

        <section className="card span-2">
          <div className="card-head">
            <h3>Heures d'affluence</h3>
            <span className="muted">CA par heure de la journée</span>
          </div>
          <BarChart data={hourData} format={dh} height={180} labelEvery={2} />
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Meilleures ventes</h3>
            <div className="segmented segmented-sm">
              <button type="button" className={bestBy === 'quantity' ? 'is-active' : ''} onClick={() => setBestBy('quantity')}>
                Quantité
              </button>
              <button type="button" className={bestBy === 'revenue' ? 'is-active' : ''} onClick={() => setBestBy('revenue')}>
                CA
              </button>
            </div>
          </div>
          <HBars data={best} format={(v) => (bestBy === 'quantity' ? `${v}` : dh(v))} empty="Aucune vente sur la période" />
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Par catégorie</h3>
          </div>
          <HBars data={cats} format={dh} empty="Aucune vente sur la période" />
        </section>

        <section className="card span-2">
          <div className="card-head">
            <h3>Produits sans vente</h3>
            <span className="muted">{stats?.unsold.length ?? 0} produit(s) visibles jamais vendus sur la période</span>
          </div>
          {stats && stats.unsold.length > 0 ? (
            <ul className="unsold">
              {stats.unsold.map((u) => (
                <li key={u.productId}>
                  <span>{u.name}</span>
                  <span className="muted">
                    {dh(u.price)} · stock {u.stock}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="chart-empty">Tous les produits visibles ont été vendus. 👍</p>
          )}
        </section>
      </div>

      <div className="dash-foot">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('admin/ventes')}>
          <Icon name="list" size={16} /> Voir le détail des ventes
        </button>
      </div>
    </div>
  );
}
