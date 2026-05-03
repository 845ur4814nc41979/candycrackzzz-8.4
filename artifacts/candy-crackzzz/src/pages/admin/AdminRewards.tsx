import { useMemo, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Award, CheckCircle2, Gift, RotateCcw, Search, Users } from 'lucide-react';
import { calculateEstimatedPoints, ensureRewardProfileReferralCode, normalizePhone } from '@/lib/rewards';
import type { RewardProfile, RewardsEntryType, Settings } from '@/types';
import ReferralShareButton from '@/components/referrals/ReferralShareButton';

function updateEntryTypeLabel(type: RewardsEntryType) {
  return type === 'earned' ? 'Earned' : type === 'redeemed' ? 'Redeemed' : type === 'adjusted' ? 'Adjusted' : 'Bonus';
}

export default function AdminRewards() {
  const { settings, setSettings, rewardProfiles, setRewardProfiles, orders } = useAppContext();
  const { toast } = useToast();
  const [formData, setFormData] = useState<Settings>(settings);
  const [lookupPhone, setLookupPhone] = useState('');
  const [selectedPhone, setSelectedPhone] = useState('');
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustNote, setAdjustNote] = useState('');

  const set = (field: Partial<Settings>) => setFormData(prev => ({ ...prev, ...field }));
  const selectedProfile = useMemo(() => rewardProfiles.find(profile => normalizePhone(profile.phone) === normalizePhone(selectedPhone)) ?? null, [rewardProfiles, selectedPhone]);

  const matchedOrders = useMemo(() => {
    if (!selectedProfile) return [];
    return orders.filter(order => normalizePhone(order.phone) === normalizePhone(selectedProfile.phone));
  }, [orders, selectedProfile]);

  const rewardPreview = useMemo(() => calculateEstimatedPoints({
    settings: formData,
    orderTotal: 25,
    rewardsOptIn: true,
    matchedRewardProfile: selectedProfile ?? undefined,
  }), [formData, selectedProfile]);

  const handleSave = () => {
    setSettings(formData);
    toast({ title: 'Rewards saved', description: 'Rewards and referral settings have been updated.' });
  };

  const handleSelectProfile = (phone: string) => {
    setSelectedPhone(phone);
    setLookupPhone(phone);
  };

  const handleLookup = () => {
    const normalized = normalizePhone(lookupPhone);
    const found = rewardProfiles.find(profile => normalizePhone(profile.phone) === normalized);
    if (!found) {
      toast({ title: 'No profile found', description: 'Try a different phone number.', variant: 'destructive' });
      return;
    }
    handleSelectProfile(found.phone);
  };

  const handleAdjust = () => {
    if (!selectedProfile || !adjustPoints || !adjustNote.trim()) return;
    const now = new Date().toISOString();
    setRewardProfiles(prev => prev.map(profile => normalizePhone(profile.phone) !== normalizePhone(selectedProfile.phone) ? profile : {
      ...profile,
      currentPoints: profile.currentPoints + adjustPoints,
      lifetimePointsEarned: profile.lifetimePointsEarned + Math.max(0, adjustPoints),
      lifetimePointsRedeemed: profile.lifetimePointsRedeemed + Math.max(0, -adjustPoints),
      rewardsHistory: [{
        id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'adjusted',
        points: adjustPoints,
        note: adjustNote.trim(),
        createdAt: now,
      }, ...profile.rewardsHistory],
    }));
    setAdjustPoints(0);
    setAdjustNote('');
    toast({ title: 'Points updated', description: 'Manual adjustment saved.' });
  };

  const totalPoints = rewardProfiles.reduce((sum, profile) => sum + profile.currentPoints, 0);

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-1">Rewards</h1>
          <p className="text-muted-foreground font-bold">{rewardProfiles.length} profiles · {totalPoints} total points</p>
        </div>
        <Button size="lg" onClick={handleSave} className="font-black uppercase tracking-wider">
          <CheckCircle2 className="w-5 h-5 mr-2" /> Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gift className="w-5 h-5" /> Rewards Controls</CardTitle>
            <CardDescription>Manage earning rules, referral bonuses, and customer rewards.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between p-3 border rounded-xl">
              <div><Label className="font-bold">Enable Rewards</Label></div>
              <Switch checked={formData.enableRewards} onCheckedChange={v => set({ enableRewards: v })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="font-bold">Points per Dollar</Label><Input type="number" value={formData.rewardsPointsPerDollar} onChange={e => set({ rewardsPointsPerDollar: parseFloat(e.target.value) || 0 })} /></div>
              <div className="space-y-2"><Label className="font-bold">Completed Order Award</Label><Switch checked={formData.rewardsAwardOnCompletedOrder} onCheckedChange={v => set({ rewardsAwardOnCompletedOrder: v })} /></div>
              <div className="space-y-2"><Label className="font-bold">First Order Bonus</Label><Input type="number" value={formData.rewardsFirstOrderBonusPoints} onChange={e => set({ rewardsFirstOrderBonusPoints: parseFloat(e.target.value) || 0 })} /></div>
              <div className="space-y-2"><Label className="font-bold">Spend Threshold Bonus</Label><Input type="number" value={formData.rewardsSpendThresholdAmount} onChange={e => set({ rewardsSpendThresholdAmount: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="font-bold">Referral Referrer Bonus</Label><Input type="number" value={formData.referralReferrerBonusPoints} onChange={e => set({ referralReferrerBonusPoints: parseFloat(e.target.value) || 0 })} /></div>
              <div className="space-y-2"><Label className="font-bold">Referral Friend Bonus</Label><Input type="number" value={formData.referralReferredCustomerBonusPoints} onChange={e => set({ referralReferredCustomerBonusPoints: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <Textarea value={formData.referralProgramDescription} onChange={e => set({ referralProgramDescription: e.target.value })} className="min-h-[90px]" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Award className="w-5 h-5" /> Reward Simulator</CardTitle>
            <CardDescription>Preview how a $25 order scores under the current settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-4xl font-black text-primary">{rewardPreview} pts</div>
            <p className="text-sm text-muted-foreground">This is based on the currently edited settings, not the saved state yet.</p>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Customer Profiles</CardTitle>
            <CardDescription>Look up a customer, review history, and apply manual point adjustments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input value={lookupPhone} onChange={e => setLookupPhone(e.target.value)} placeholder="Phone number" />
              <Button onClick={handleLookup} className="font-black uppercase tracking-wider"><Search className="w-4 h-4 mr-2" /> Find</Button>
            </div>
            {selectedProfile && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border rounded-2xl p-4 space-y-2">
                  <div className="font-black text-lg">{selectedProfile.customerName}</div>
                  <div className="text-sm text-muted-foreground">{selectedProfile.phone}</div>
                  <div className="text-sm">Current: <span className="font-black">{selectedProfile.currentPoints}</span></div>
                  <div className="text-sm flex items-center gap-2 flex-wrap">Referral code: <span className="font-black">{ensureRewardProfileReferralCode(selectedProfile)}</span><ReferralShareButton code={ensureRewardProfileReferralCode(selectedProfile)} size="sm" variant="ghost" iconOnly label="Share referral code" /></div>
                </div>
                <div className="space-y-3 border rounded-2xl p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Input type="number" value={adjustPoints} onChange={e => setAdjustPoints(parseInt(e.target.value || '0', 10))} placeholder="Points" />
                    <Button onClick={handleAdjust} className="font-black uppercase tracking-wider">Apply</Button>
                  </div>
                  <Input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="Adjustment note" />
                </div>
                <div className="lg:col-span-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedProfile.rewardsHistory.slice(0, 10).map(entry => (
                        <TableRow key={entry.id}>
                          <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
                          <TableCell>{updateEntryTypeLabel(entry.type)}</TableCell>
                          <TableCell>{entry.points}</TableCell>
                          <TableCell>{entry.note || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}