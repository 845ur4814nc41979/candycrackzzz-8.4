import { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAppContext } from '@/context/AppContext';
import { Badge } from '@/components/ui/badge';
import { OrderStatus } from '@/types';
import { ChevronDown, Package, User, Calendar, MapPin, CreditCard, StickyNote, Navigation, AlertTriangle } from 'lucide-react';
import { awardCompletedOrderRewards } from '@/lib/rewards';
import { buildGoogleMapsDirectionsUrl, hasUsableAddress } from '@/lib/directions';
import { Button } from '@/components/ui/button';

const ALL_STATUSES: OrderStatus[] = ['new', 'pending', 'confirmed', 'ready', 'picked-up', 'completed', 'cancelled'];

const STATUS_STYLES: Record<OrderStatus, string> = {
  new: 'bg-blue-500 text-white',
  pending: 'bg-yellow-500 text-black',
  confirmed: 'bg-primary text-primary-foreground',
  ready: 'bg-accent text-accent-foreground',
  'picked-up': 'bg-teal-500 text-white',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive text-destructive-foreground',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New',
  pending: 'Pending',
  confirmed: 'Confirmed',
  ready: 'Ready',
  'picked-up': 'Picked Up',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function AdminOrdersReferralBadges() {
  const { orders, setOrders, settings, rewardProfiles, setRewardProfiles } = useAppContext();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredOrders = orders
    .filter(o => statusFilter === 'all' || o.status === statusFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const updateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    const targetOrder = orders.find(order => order.id === orderId);
    if (!targetOrder) return;

    let awardedPoints = 0;
    let referralReferrerPointsAwarded = 0;
    let referralReferredCustomerPointsAwarded = 0;
    let redemptionFinalized = false;

    if (
      newStatus === 'completed' &&
      settings.rewardsAwardOnCompletedOrder &&
      !targetOrder.rewardsAwardedAt
    ) {
      const result = awardCompletedOrderRewards({
        order: targetOrder,
        settings,
        rewardProfiles,
      });
      awardedPoints = result.awardedPoints;
      referralReferrerPointsAwarded = result.referralReferrerPointsAwarded;
      referralReferredCustomerPointsAwarded = result.referralReferredCustomerPointsAwarded;
      redemptionFinalized = result.redemptionFinalized;
      if (result.updatedProfiles !== rewardProfiles) {
        setRewardProfiles(result.updatedProfiles);
      }
    }

    const completedAt = new Date().toISOString();
    const wasPendingRedemption = targetOrder.rewardsRedemptionStatus === 'pending';

    setOrders(prev => prev.map(o => o.id === orderId ? {
      ...o,
      status: newStatus,
      rewardsPointsAwarded: newStatus === 'completed' && !o.rewardsAwardedAt ? awardedPoints : o.rewardsPointsAwarded,
      rewardsAwardedAt: newStatus === 'completed' && !o.rewardsAwardedAt && awardedPoints >= 0 ? completedAt : o.rewardsAwardedAt,
      referralReferrerPointsAwarded: newStatus === 'completed' && !o.rewardsAwardedAt ? referralReferrerPointsAwarded : o.referralReferrerPointsAwarded,
      referralReferredCustomerPointsAwarded: newStatus === 'completed' && !o.rewardsAwardedAt ? referralReferredCustomerPointsAwarded : o.referralReferredCustomerPointsAwarded,
      referralAwardedAt: newStatus === 'completed' && !o.rewardsAwardedAt && (referralReferrerPointsAwarded > 0 || referralReferredCustomerPointsAwarded > 0) ? completedAt : o.referralAwardedAt,
      // Reward redemption lifecycle:
      // - On completion with a pending redemption that succeeded: mark applied + redeemedAt
      // - On cancellation with a pending redemption: mark cancelled (no points were ever deducted, so nothing to refund)
      rewardsRedemptionStatus:
        newStatus === 'completed' && wasPendingRedemption && redemptionFinalized
          ? 'applied'
          : newStatus === 'cancelled' && wasPendingRedemption
            ? 'cancelled'
            : o.rewardsRedemptionStatus,
      rewardsRedeemedAt:
        newStatus === 'completed' && wasPendingRedemption && redemptionFinalized
          ? completedAt
          : o.rewardsRedeemedAt,
    } : o));
  };

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-1">Orders</h1>
          <p className="text-muted-foreground font-bold">{orders.length} total requests</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setStatusFilter('all')} className={`px-4 py-2 rounded-full text-sm font-black uppercase tracking-wider border transition-colors ${statusFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}>
          All ({orders.length})
        </button>
        {ALL_STATUSES.map(s => {
          const count = orders.filter(o => o.status === s).length;
          if (count === 0 && statusFilter !== s) return null;
          return (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-2 rounded-full text-sm font-black uppercase tracking-wider border transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}>
              {STATUS_LABEL[s]} ({count})
            </button>
          );
        })}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <p className="text-muted-foreground font-bold text-lg">No orders found.</p>
          <p className="text-sm text-muted-foreground mt-2">Orders submitted by customers will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <div key={order.id} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="font-black text-base leading-tight truncate">{order.customerName}</div>
                    <div className="text-xs text-muted-foreground font-medium mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString()} · {order.items.length} item{order.items.length !== 1 ? 's' : ''} · ${order.total.toFixed(2)}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {order.referralCodeUsed ? (
                        <span className="text-[10px] font-black px-2 py-1 rounded-full bg-secondary/15 text-secondary uppercase tracking-wider">Referral used</span>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-1 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">No referral</span>
                      )}
                      {!!order.referralAwardedAt && (
                        <span className="text-[10px] font-black px-2 py-1 rounded-full bg-primary/15 text-primary uppercase tracking-wider">Referral bonus awarded</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${STATUS_STYLES[order.status]}`}>{STATUS_LABEL[order.status]}</span>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${expandedId === order.id ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {expandedId === order.id && (
                <div className="border-t border-border p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-background rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground mb-2"><User className="w-4 h-4" /> Customer</div>
                      <div className="font-bold">{order.customerName}</div>
                      <div className="text-sm text-muted-foreground">{order.phone}</div>
                      <div className="text-sm text-muted-foreground">{order.email}</div>
                    </div>

                    <div className="bg-background rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground mb-2"><Calendar className="w-4 h-4" /> Logistics</div>
                      <Badge variant="outline" className="uppercase text-[10px] font-black tracking-wider">{order.pickupOrDelivery}</Badge>
                      <div className="text-sm font-bold text-secondary">{new Date(order.requestedDate).toLocaleDateString()} @ {order.requestedTime}</div>
                      {order.pickupOrDelivery === 'delivery' && order.deliveryAddress && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />{order.deliveryAddress}</div>
                          {settings.deliveryDirectionsButtonEnabled && (
                            hasUsableAddress(settings.businessAddress) ? (
                              <Button
                                asChild
                                size="sm"
                                className="w-full font-black uppercase tracking-wider"
                              >
                                <a
                                  href={buildGoogleMapsDirectionsUrl(settings.businessAddress, order.deliveryAddress)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Navigation className="w-4 h-4 mr-2" /> Open Directions
                                </a>
                              </Button>
                            ) : (
                              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-xs font-bold text-amber-100">
                                  Add your business address in Settings → General to enable route directions.
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-background rounded-xl p-4">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground mb-3"><Package className="w-4 h-4" /> Items</div>
                    <div className="space-y-2">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span className="font-bold">{item.quantity}× {item.name}</span>
                          <span className="text-muted-foreground font-medium">{item.price ? `$${(item.price * item.quantity).toFixed(2)}` : 'Price TBD'}</span>
                        </div>
                      ))}
                      <div className="border-t border-border pt-2 flex justify-between font-black"><span>Total</span><span>${order.total.toFixed(2)}</span></div>
                    </div>
                  </div>

                  {(order.specialInstructions || order.notes || order.eventType) && (
                    <div className="bg-background rounded-xl p-4">
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground mb-3"><StickyNote className="w-4 h-4" /> Notes</div>
                      {order.eventType && <div className="text-sm font-bold mb-1">Event: {order.eventType}</div>}
                      {order.specialInstructions && <div className="text-sm text-muted-foreground italic">&quot;{order.specialInstructions}&quot;</div>}
                      {order.notes && <div className="text-sm text-muted-foreground">{order.notes}</div>}
                    </div>
                  )}

                  {(order.paymentMethod || order.referralCodeUsed || typeof order.rewardsPointsAwarded === 'number') && (
                    <div className="bg-background rounded-xl p-4">
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground mb-2"><CreditCard className="w-4 h-4" /> Rewards / Payment</div>
                      {order.paymentMethod && <><div className="text-sm font-bold capitalize">{order.paymentMethod}</div><div className="text-sm text-muted-foreground">{order.paymentStatus}</div></>}
                      {typeof order.rewardsPointsAwarded === 'number' && order.rewardsAwardedAt && <div className="text-sm font-bold text-primary mt-2">Rewards awarded: {order.rewardsPointsAwarded} pts</div>}
                      {order.referralCodeUsed && <div className="text-sm font-bold text-secondary mt-2">Referral code used: {order.referralCodeUsed}</div>}
                      {!!order.referralReferredCustomerPointsAwarded && <div className="text-sm text-primary mt-1">Referred customer bonus: {order.referralReferredCustomerPointsAwarded} pts</div>}
                      {!!order.referralReferrerPointsAwarded && <div className="text-sm text-primary mt-1">Referrer bonus: {order.referralReferrerPointsAwarded} pts</div>}
                    </div>
                  )}

                  <div className="bg-muted/30 rounded-xl p-4">
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">Update Status</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {ALL_STATUSES.map(s => (
                        <button key={s} onClick={() => updateOrderStatus(order.id, s)} className={`px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${order.status === s ? STATUS_STYLES[s] + ' ring-2 ring-offset-1 ring-offset-card ring-white/40' : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
