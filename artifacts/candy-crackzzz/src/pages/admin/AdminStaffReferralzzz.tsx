import { useMemo } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { roleLabels } from '@/lib/permissions';
import {
  buildStaffReferralLink,
  getStaffReferralSettings,
  getStaffReferralStats,
  staffReferralShareText,
  staffReferralCodeForUser,
  normalizeStaffReferralCode,
  type StaffReferralUser,
} from '@/lib/staffReferral';
import { Copy, DollarSign, Gift, Link2, Share2, Users, Banknote } from 'lucide-react';

const currency = (value: number) => `$${value.toFixed(2)}`;

function NumberField({ label, value, onChange, prefix, suffix, min = 0, step = 1 }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  step?: number;
}) {
  return (
    <div className="space-y-2">
      <Label className="font-bold">{label}</Label>
      <div className="flex items-center gap-2">
        {prefix && <span className="font-black text-muted-foreground">{prefix}</span>}
        <Input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="bg-background font-bold h-11"
        />
        {suffix && <span className="font-black text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 border border-border rounded-xl bg-background/60">
      <div>
        <Label className="font-bold">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

const BONUS_STATUS_STYLES: Record<string, string> = {
  none: 'bg-muted text-muted-foreground',
  ineligible: 'bg-muted text-muted-foreground',
  pending: 'bg-yellow-500 text-black',
  approved: 'bg-emerald-500 text-white',
  paid: 'bg-primary text-primary-foreground',
  cancelled: 'bg-destructive text-destructive-foreground',
};

export default function AdminStaffReferralzzz() {
  const { settings, setSettings, orders, setOrders, rewardProfiles } = useAppContext();
  const { adminUsers, currentUser } = useAuth();
  const { toast } = useToast();
  const staffSettings = getStaffReferralSettings(settings);

  const setStaffSetting = (field: string, value: unknown) => {
    setSettings(prev => ({ ...(prev as any), [field]: value } as any));
  };

  const referralUsers = useMemo(
    () => adminUsers.filter(user => user.status !== 'disabled' && user.role !== 'viewer'),
    [adminUsers],
  );

  const stats = useMemo(
    () => referralUsers.map(user => ({ user, stats: getStaffReferralStats({ user: user as StaffReferralUser, orders, rewardProfiles }) })),
    [referralUsers, orders, rewardProfiles],
  );

  const totals = stats.reduce((acc, row) => {
    acc.signups += row.stats.signupCount;
    acc.completed += row.stats.completedOrderCount;
    acc.pending += row.stats.pendingBonus;
    acc.approved += row.stats.approvedBonus;
    acc.paid += row.stats.paidBonus;
    acc.lifetime += row.stats.lifetimeBonus;
    return acc;
  }, { signups: 0, completed: 0, pending: 0, approved: 0, paid: 0, lifetime: 0 });

  const updateStaffBonus = (orderId: string, newBonusStatus: 'pending' | 'approved' | 'paid' | 'cancelled') => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, employeeReferralBonusStatus: newBonusStatus } : o));
  };

  // Orders with actionable staff bonuses (pending or approved, with a positive amount)
  const actionableBonusOrders = useMemo(
    () => orders.filter(o =>
      o.employeeReferralCodeUsed &&
      o.employeeReferralBonusCalculatedAt &&
      (o.employeeReferralBonusAmount ?? 0) > 0 &&
      (o.employeeReferralBonusStatus === 'pending' || o.employeeReferralBonusStatus === 'approved'),
    ),
    [orders],
  );

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied`, description: 'Ready to paste or share.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Copy it manually instead.', variant: 'destructive' });
    }
  };

  const shareStaff = async (user: StaffReferralUser) => {
    const url = buildStaffReferralLink(user);
    const text = staffReferralShareText(user);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Candy CrackZZZ Rewardzzz', text, url });
        return;
      }
    } catch {
      return;
    }
    await copy(text, 'Share message');
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Staff Referralzzz</h1>
            <p className="text-sm text-muted-foreground font-bold mt-1 max-w-3xl">
              Adjustable Candy Crew Bonus tracking. Staff can share their own link, and Builder/Admin can review pending, approved, and paid bonus cash manually.
            </p>
          </div>
          {currentUser && (
            <Button variant="outline" className="font-black uppercase tracking-wider" onClick={() => void copy(staffReferralCodeForUser(currentUser as StaffReferralUser), 'Your code')}>
              <Gift className="w-4 h-4 mr-2" /> My Code
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            ['Signups', totals.signups.toString(), Users],
            ['Completed', totals.completed.toString(), Gift],
            ['Pending', currency(totals.pending), DollarSign],
            ['Approved', currency(totals.approved), DollarSign],
            ['Paid', currency(totals.paid), DollarSign],
            ['Lifetime', currency(totals.lifetime), DollarSign],
          ].map(([label, value, Icon]) => (
            <div key={label as string} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground mb-2"><Icon className="w-4 h-4" />{label as string}</div>
              <div className="text-2xl font-black">{value as string}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-3xl p-5 space-y-4">
            <h2 className="text-xl font-black uppercase tracking-wider">Program Togglezzz</h2>
            <ToggleRow
              label="Enable Staff Referralzzz Program"
              description="Master switch. When off, staff codes can still exist but bonuses do not calculate."
              checked={staffSettings.enableStaffReferralProgram}
              onChange={v => setStaffSetting('enableStaffReferralProgram', v)}
            />
            <ToggleRow
              label="Allow staff referral linkzzz"
              checked={staffSettings.allowStaffReferralLinks}
              onChange={v => setStaffSetting('allowStaffReferralLinks', v)}
            />
            <ToggleRow
              label="Show Staff Referralzzz card on staff dashboard"
              checked={staffSettings.showStaffReferralCard}
              onChange={v => setStaffSetting('showStaffReferralCard', v)}
            />
            <ToggleRow
              label="Approval required before payable"
              description="Recommended. Bonuses stay pending until Builder/Admin approves them."
              checked={staffSettings.staffReferralApprovalRequired}
              onChange={v => setStaffSetting('staffReferralApprovalRequired', v)}
            />
            <ToggleRow
              label="Prevent self-referralzzz"
              checked={staffSettings.staffReferralPreventSelfReferrals}
              onChange={v => setStaffSetting('staffReferralPreventSelfReferrals', v)}
            />
          </div>

          <div className="bg-card border border-border rounded-3xl p-5 space-y-4">
            <h2 className="text-xl font-black uppercase tracking-wider">Bonus Rulezzz</h2>
            <ToggleRow
              label="Allow signup bonus"
              description="Optional. Usually keep this off until you trust the flow."
              checked={staffSettings.staffReferralAllowSignupBonus}
              onChange={v => setStaffSetting('staffReferralAllowSignupBonus', v)}
            />
            <ToggleRow
              label="Allow first completed order bonus"
              checked={staffSettings.staffReferralAllowFirstOrderBonus}
              onChange={v => setStaffSetting('staffReferralAllowFirstOrderBonus', v)}
            />
            <ToggleRow
              label="Allow every completed order bonus"
              description="Optional recurring bonus for repeat orders from referred customers."
              checked={staffSettings.staffReferralAllowEveryCompletedOrder}
              onChange={v => setStaffSetting('staffReferralAllowEveryCompletedOrder', v)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <NumberField label="Fixed signup bonus" prefix="$" step={0.25} value={staffSettings.staffReferralFixedSignupBonus} onChange={v => setStaffSetting('staffReferralFixedSignupBonus', v)} />
              <NumberField label="Fixed first-order bonus" prefix="$" step={0.25} value={staffSettings.staffReferralFixedFirstOrderBonus} onChange={v => setStaffSetting('staffReferralFixedFirstOrderBonus', v)} />
              <NumberField label="First-order percentage" suffix="%" step={0.25} value={staffSettings.staffReferralFirstOrderBonusPercent} onChange={v => setStaffSetting('staffReferralFirstOrderBonusPercent', v)} />
              <NumberField label="Every-order percentage" suffix="%" step={0.25} value={staffSettings.staffReferralRecurringOrderBonusPercent} onChange={v => setStaffSetting('staffReferralRecurringOrderBonusPercent', v)} />
              <NumberField label="Minimum order total" prefix="$" step={1} value={staffSettings.staffReferralMinimumOrderTotal} onChange={v => setStaffSetting('staffReferralMinimumOrderTotal', v)} />
              <NumberField label="Max bonus per order" prefix="$" step={1} value={staffSettings.staffReferralMaxBonusPerOrder} onChange={v => setStaffSetting('staffReferralMaxBonusPerOrder', v)} />
            </div>
          </div>
        </div>

        {/* ── Bonus Queue ─────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-3">
            <Banknote className="w-5 h-5 text-yellow-500" />
            <div>
              <h2 className="text-xl font-black uppercase tracking-wider">Bonus Queuezzz</h2>
              <p className="text-sm text-muted-foreground font-bold mt-0.5">Orders with a pending or approved staff bonus waiting for action.</p>
            </div>
            {actionableBonusOrders.length > 0 && (
              <span className="ml-auto bg-yellow-500 text-black text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">{actionableBonusOrders.length} pending</span>
            )}
          </div>
          {actionableBonusOrders.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground font-bold">No pending bonuses. They appear here when a referred customer's order is completed.</div>
          ) : (
            <div className="divide-y divide-border">
              {actionableBonusOrders.map(order => {
                const staffCode = normalizeStaffReferralCode(order.employeeReferralCodeUsed ?? '');
                const staffUser = referralUsers.find(u => {
                  const uCode = normalizeStaffReferralCode(staffReferralCodeForUser(u as StaffReferralUser));
                  return uCode === staffCode;
                });
                return (
                  <div key={order.id} className="p-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-4 items-center">
                    <div>
                      <div className="font-black">{order.customerName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{order.phone} · {new Date(order.createdAt).toLocaleDateString()}</div>
                      <div className="text-xs font-bold text-primary mt-1">Order #{order.id} · ${order.total.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">Staff Member</div>
                      <div className="font-black">{staffUser?.username ?? staffCode}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-black tracking-widest text-primary">{staffCode}</span>
                        <span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${BONUS_STATUS_STYLES[order.employeeReferralBonusStatus ?? 'none']}`}>
                          {order.employeeReferralBonusStatus ?? 'none'}
                        </span>
                      </div>
                      <div className="text-lg font-black mt-1">${(order.employeeReferralBonusAmount ?? 0).toFixed(2)}</div>
                      {order.employeeReferralBonusNote && <div className="text-xs text-muted-foreground mt-0.5">{order.employeeReferralBonusNote}</div>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {order.employeeReferralBonusStatus === 'pending' && (
                        <Button size="sm" className="font-black bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => updateStaffBonus(order.id, 'approved')}>
                          Approve
                        </Button>
                      )}
                      {order.employeeReferralBonusStatus === 'approved' && (
                        <Button size="sm" className="font-black bg-primary text-primary-foreground" onClick={() => updateStaffBonus(order.id, 'paid')}>
                          Mark Paid
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" className="font-black" onClick={() => updateStaffBonus(order.id, 'cancelled')}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Crew Links ───────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-xl font-black uppercase tracking-wider">Candy Crew Linkzzz</h2>
            <p className="text-sm text-muted-foreground font-bold mt-1">These are safe public links that send customers to Join Rewardzzz with a staffRef attached.</p>
          </div>
          <div className="divide-y divide-border">
            {stats.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground font-bold">No active staff users found.</div>
            ) : stats.map(({ user, stats: userStats }) => (
              <div key={user.id} className="p-5 grid grid-cols-1 xl:grid-cols-[1fr_1.5fr_1fr] gap-4 items-center">
                <div>
                  <div className="font-black text-lg">{user.username}</div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{roleLabels[user.role] ?? user.role}</div>
                  <div className="mt-2 inline-flex items-center rounded-full bg-primary/15 text-primary px-2 py-1 text-xs font-black tracking-wider">{userStats.code}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-1">Referral Link</div>
                  <div className="text-sm font-mono bg-background border border-border rounded-xl px-3 py-2 truncate">{userStats.link}</div>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background rounded-xl p-2 border border-border"><b>{userStats.signupCount}</b><br />signupzzz</div>
                    <div className="bg-background rounded-xl p-2 border border-border"><b>{userStats.completedOrderCount}</b><br />completed</div>
                    <div className="bg-background rounded-xl p-2 border border-border"><b>{currency(userStats.pendingBonus)}</b><br />pending</div>
                    <div className="bg-background rounded-xl p-2 border border-border"><b>{currency(userStats.paidBonus)}</b><br />paid</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void copy(userStats.link, 'Referral link')} className="font-bold"><Link2 className="w-4 h-4 mr-1" /> Copy</Button>
                    <Button size="sm" onClick={() => void shareStaff(user as StaffReferralUser)} className="font-bold"><Share2 className="w-4 h-4 mr-1" /> Share</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
